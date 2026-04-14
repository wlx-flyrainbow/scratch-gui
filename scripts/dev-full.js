/**
 * One-shot local stack: optional docker compose, wait for MySQL, then auth + webpack.
 * Set ZHIMENG_DEV_SKIP_DOCKER=1 if MySQL is already running (e.g. native 3306 + .env).
 */
const path = require('path');
const {spawnSync} = require('child_process');

const root = path.join(__dirname, '..');
require(path.join(root, 'backend/load-local-env.js'));

if (process.env.ZHIMENG_DEV_SKIP_DOCKER !== '1') {
    const d = spawnSync('docker', ['compose', 'up', '-d'], {
        cwd: root,
        stdio: 'inherit',
        shell: true
    });
    if (d.status !== 0) {
        process.stderr.write(
            'docker compose failed. Start Docker Desktop, or use ZHIMENG_DEV_SKIP_DOCKER=1 if MySQL is already up.\n'
        );
        process.exit(d.status || 1);
    }
}

const w = spawnSync(process.execPath, [path.join(__dirname, 'wait-for-mysql.js')], {
    cwd: root,
    stdio: 'inherit'
});
if (w.status !== 0) {
    process.exit(w.status || 1);
}

const s = spawnSync('npm', ['run', 'dev:full:serve'], {
    cwd: root,
    stdio: 'inherit',
    shell: true
});
process.exit(s.status === null ? 1 : s.status);
