#!/usr/bin/env python3
"""Activate a verified prebuilt API bundle; never build or migrate a database."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import sys
import tarfile
import time
import uuid

SPECS = {
    'zhimeng-api-test': ('zhimeng', 3102, 'backend/server.js', '/health'),
    'zhimeng-api-prod': ('zhimeng', 3101, 'backend/server.js', '/health'),
    'xianglin-api-test': ('xianglin', 3202, 'dist/src/main.js', '/healthz'),
    'xianglin-api-prod': ('xianglin', 3201, 'dist/src/main.js', '/healthz'),
}
BASE = Path('/opt/codevalley/releases')
STATE = Path('/etc/codevalley-ops/releases')


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def sha(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1048576), b''):
            value.update(block)
    return value.hexdigest()


def command(args, timeout=30):
    # PM2 output and environment may contain secrets; never print raw output.
    return subprocess.check_output(args, stderr=subprocess.PIPE,
                                   universal_newlines=True, timeout=timeout)


def pm2_config(app):
    e = app['pm2_env']
    result = {'name': app['name'], 'cwd': e['pm_cwd'], 'script': e['pm_exec_path'],
              'interpreter': e['exec_interpreter'], 'env': dict(e['env']),
              'args': e.get('args') or [], 'node_args': e.get('node_args') or [],
              'out_file': e['pm_out_log_path'], 'error_file': e['pm_err_log_path']}
    for key in ('max_memory_restart', 'kill_timeout', 'min_uptime', 'max_restarts', 'restart_delay'):
        if e.get(key) is not None:
            result[key] = e[key]
    return result



def read_pm2_state():
    """Read existing RPC state; never launch a daemon as a side effect of a query."""
    require(command(['systemctl', 'is-active', 'pm2-root']).strip() == 'active', 'PM2 service is not active')
    pid = int(command(['systemctl', 'show', 'pm2-root', '-p', 'MainPID', '--value']).strip())
    require(pid > 1 and int(Path('/root/.pm2/pm2.pid').read_text().strip()) == pid,
            'PM2 daemon does not match the system service')
    require(Path('/root/.pm2/rpc.sock').is_socket(), 'Existing PM2 RPC socket is not available')
    node = os.readlink('/proc/%d/exe' % pid)
    query = """
const axon = require('/usr/local/lib/node_modules/pm2/modules/pm2-axon');
const rpc = require('/usr/local/lib/node_modules/pm2/modules/pm2-axon-rpc');
const socket = axon.socket('req');
const client = new rpc.Client(socket);
const timeout = setTimeout(() => process.exit(2), 7000);
socket.once('error', () => process.exit(2));
socket.once('connect', () => client.call('getMonitorData', {}, (error, apps) => {
  if (error || !Array.isArray(apps)) process.exit(2);
  clearTimeout(timeout);
  process.stdout.write(JSON.stringify(apps), () => process.exit(0));
}));
socket.connect('/root/.pm2/rpc.sock');
"""
    result = json.loads(command([node, '-e', query], 10))
    require(isinstance(result, list), 'Unexpected PM2 RPC response')
    return result


def read_bundle(archive, family):
    members = archive.getmembers()
    require(len(members) <= 30000, 'Too many bundle entries')
    require(sum(m.size for m in members) <= 1024 ** 3, 'Bundle is too large')
    names = set()
    for member in members:
        p = PurePosixPath(member.name)
        require(member.isfile() and not p.is_absolute() and '..' not in p.parts,
                'Bundle must contain regular relative files only')
        require(str(p) == member.name and member.name not in names, 'Duplicate or noncanonical entry')
        require(not any(x.startswith('.') or x == 'node_modules' for x in p.parts),
                'Bundle contains an environment, hidden, or dependency file')
        names.add(member.name)
    require('release-manifest.json' in names, 'Missing bundle manifest')
    require(archive.getmember('release-manifest.json').size < 8 * 1024 ** 2, 'Manifest too large')
    manifest = json.load(archive.extractfile('release-manifest.json'))
    require(manifest.get('schema') == 1 and manifest.get('family') == family, 'Wrong bundle family')
    require(manifest.get('node_major') == 24, 'Wrong runtime version')
    require(set(manifest['files']) == names - {'release-manifest.json'}, 'Manifest does not cover all files')
    prefixes = ('backend/', 'website/', 'scripts/') if family == 'zhimeng' else ('dist/', 'src/', 'schemas/')
    for name in manifest['files']:
        require(name in ('package.json', 'package-lock.json') or name.startswith(prefixes), 'Unexpected runtime path')
        require(not name.startswith('website/data/') or name == 'website/data/teacher-channels.json',
                'Live website data cannot be deployed in a bundle')
        digest = hashlib.sha256(archive.extractfile(name).read()).hexdigest()
        require(digest == manifest['files'][name], 'Bundle file checksum mismatch')
    require(manifest['files'].get('package-lock.json') == manifest.get('dependency_lock_sha256'),
            'Invalid dependency lock hash')
    return manifest


def check_runtime(name, config, port, endpoint):
    deadline = time.monotonic() + 60
    while True:
        try:
            command(['curl', '-fsS', '--max-time', '3', '-o', '/dev/null',
                     'http://127.0.0.1:%d%s' % (port, endpoint)], 5)
            break
        except (subprocess.SubprocessError, OSError):
            if time.monotonic() > deadline:
                raise RuntimeError('Application health check failed')
            time.sleep(1)
    app = next(a for a in read_pm2_state() if a['name'] == name)
    e = app['pm2_env']
    require(e['status'] == 'online' and e['pm_cwd'] == config['cwd'] and
            e['pm_exec_path'] == config['script'], 'PM2 is not running the requested release')
    require(Path('/proc/%s/exe' % app['pid']).resolve() == Path(config['interpreter']).resolve(),
            'Unexpected Node executable')
    require(Path('/proc/%s/cwd' % app['pid']).resolve() == Path(config['cwd']), 'Unexpected process cwd')
    listeners = command(['ss', '-H', '-lntp', 'sport = :%d' % port]).splitlines()
    require(listeners and all(x.split()[3] == '127.0.0.1:%d' % port for x in listeners),
            'Application listener is not restricted to loopback')
    return app


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('app', choices=sorted(SPECS))
    parser.add_argument('--bundle', required=True, type=Path)
    parser.add_argument('--check', action='store_true', help='Validate without creating or switching a release')
    parser.add_argument('--redis-db', type=int, choices=range(16),
                        help='Select the Xianglin Redis database in this release and saved startup state')
    args = parser.parse_args()
    os.umask(0o077)
    os.environ['PATH'] = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
    os.environ['PM2_HOME'] = '/root/.pm2'
    require(os.geteuid() == 0, 'Run with sudo')
    family, port, entry, endpoint = SPECS[args.app]
    require(args.redis_db is None or family == 'xianglin', '--redis-db is only supported for Xianglin')
    STATE.mkdir(parents=True, mode=0o700, exist_ok=True)
    lock = (STATE / 'publish.lock').open('a')
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    before = read_pm2_state()
    app = next(a for a in before if a['name'] == args.app)
    previous = pm2_config(app)
    current = Path(previous['cwd']).resolve()
    require(current.parent == BASE / args.app, 'Current app is outside its independent release directory')
    deps = (current / 'node_modules').resolve()
    require(str(deps).startswith('/opt/codevalley/dependencies/' + family + '/'), 'Unexpected dependency directory')
    require(command([previous['interpreter'], '--version']).strip().startswith('v24.'), 'Node 24 is required')
    with tarfile.open(str(args.bundle), 'r:gz') as archive:
        manifest = read_bundle(archive, family)
        require(entry in manifest['files'], 'Missing application entry point')
        require(sha(current / 'package-lock.json') == manifest['dependency_lock_sha256'],
                'Dependency changes require a separately validated Linux dependency release')
        check_runtime(args.app, previous, port, endpoint)
        require(shutil.disk_usage(str(BASE)).free > 1024 ** 3 + sum(m.size for m in archive.getmembers()),
                'Insufficient disk headroom')
        if args.check:
            print(json.dumps({'validated': True, 'app': args.app, 'files': len(manifest['files']),
                              'source_revision': manifest.get('source_revision'), 'server_build': False}))
            return
        tag = time.strftime('%Y%m%dT%H%M%SZ', time.gmtime()) + '-' + uuid.uuid4().hex[:8]
        release = BASE / args.app / tag
        release.mkdir(mode=0o700)
        for member in archive.getmembers():
            destination = release / member.name
            destination.parent.mkdir(parents=True, exist_ok=True)
            with destination.open('xb') as output:
                shutil.copyfileobj(archive.extractfile(member), output)
            destination.chmod(0o600)
        (release / 'node_modules').symlink_to(deps)
        if (current / '.env').is_file():
            shutil.copy2(str(current / '.env'), str(release / '.env'))
        if args.redis_db is not None:
            env_file = release / '.env'
            lines = env_file.read_text().splitlines() if env_file.exists() else []
            lines = [line for line in lines if not line.startswith('REDIS_DB=')]
            env_file.write_text('\n'.join(lines + ['REDIS_DB=' + str(args.redis_db)]) + '\n')
            env_file.chmod(0o600)
        data = current / 'website/data'
        require(not data.exists() or all(p.name == 'teacher-channels.json' and p.is_file() for p in data.iterdir()),
                'Move live website data to an external configured path before deploying')
    command([previous['interpreter'], '--check', str(release / entry)])
    tx = STATE / (args.app + '-' + tag)
    tx.mkdir(mode=0o700)
    rollback_config = tx / 'previous.json'
    rollback_config.write_text(json.dumps({'apps': [previous]}, indent=2))
    desired = dict(previous, cwd=str(release), script=str(release / entry))
    desired['env'] = dict(previous['env'], HOST='127.0.0.1', ZHIMENG_AUTH_HOST='127.0.0.1')
    if args.redis_db is not None:
        desired['env']['REDIS_DB'] = str(args.redis_db)
    candidate = tx / 'candidate.json'
    candidate.write_text(json.dumps({'apps': [desired]}, indent=2))
    rollback = tx / 'rollback.py'
    rollback.write_text('''#!/usr/bin/python3
import os,subprocess
os.environ['PM2_HOME']='/root/.pm2'
os.environ['PATH']='/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
subprocess.run(['pm2','delete',%r],stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=30)
subprocess.run(['pm2','start',%r,'--only',%r],stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=True,timeout=90)
subprocess.run(['pm2','save'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=True,timeout=30)
''' % (args.app, str(rollback_config), args.app))
    timer = 'codevalley-publish-' + args.app + '-' + tag
    command(['systemd-run', '--unit=' + timer, '--on-active=4m', '/usr/bin/python3', str(rollback)])
    require(command(['systemctl', 'is-active', timer + '.timer']).strip() == 'active', 'Rollback timer was not armed')
    try:
        command(['pm2', 'delete', args.app])
        command(['pm2', 'start', str(candidate), '--only', args.app], 90)
        running = check_runtime(args.app, desired, port, endpoint)
        # Hold for a second check to catch an immediately crashing application.
        time.sleep(3)
        require(check_runtime(args.app, desired, port, endpoint)['pid'] == running['pid'], 'New app restarted unexpectedly')
        after = read_pm2_state()
        require({a['name']: a['pid'] for a in before if a['name'] != args.app} ==
                {a['name']: a['pid'] for a in after if a['name'] != args.app}, 'An unrelated app changed')
        command(['pm2', 'save'])
        saved = next(a for a in json.loads(Path('/root/.pm2/dump.pm2').read_text()) if a['name'] == args.app)
        require(saved['pm_cwd'] == str(release), 'Saved PM2 state has the wrong release')
        command(['systemctl', 'stop', timer + '.timer'])
        receipt = {'app': args.app, 'release': str(release), 'previous': str(current),
                   'source_revision': manifest.get('source_revision'), 'bundle_sha256': sha(args.bundle),
                   'node': command([desired['interpreter'], '--version']).strip(), 'health': 'ok',
                   'rollback_command': '/usr/bin/python3 ' + str(rollback), 'checked_epoch': int(time.time())}
        (tx / 'receipt.json').write_text(json.dumps(receipt, indent=2))
        print(json.dumps(receipt))
    except BaseException:
        try:
            command(['/usr/bin/python3', str(rollback)], 120)
            check_runtime(args.app, previous, port, endpoint)
            command(['systemctl', 'stop', timer + '.timer'])
            print(json.dumps({'app': args.app, 'rolled_back': True}))
        except Exception:
            print(json.dumps({'app': args.app, 'timed_rollback_remains_armed': True}))
        raise


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        # Avoid printing subprocess arguments, database credentials, or PM2 output.
        print('Release failed: ' + (str(exc) if isinstance(exc, RuntimeError) else type(exc).__name__), file=sys.stderr)
        sys.exit(1)
