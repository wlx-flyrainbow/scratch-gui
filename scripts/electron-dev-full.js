/**
 * One-shot local desktop stack: optional docker compose, wait for MySQL,
 * build renderer, then run auth server and Electron together.
 */
const path = require('path');
const {spawn, spawnSync} = require('child_process');

const root = path.join(__dirname, '..');
require(path.join(root, 'backend/load-local-env.js'));

const run = (command, args, options = {}) => {
    const result = spawnSync(command, args, {
        cwd: root,
        stdio: 'inherit',
        shell: true,
        env: {
            ...process.env,
            ...(options.env || {})
        }
    });
    if (result.status !== 0) {
        process.exit(result.status || 1);
    }
};

if (process.env.ZHIMENG_DEV_SKIP_DOCKER !== '1') {
    run('docker', ['compose', 'up', '-d']);
}

run(process.execPath, [path.join(__dirname, 'wait-for-mysql.js')]);
run('npm', ['run', 'build'], {
    env: {
        ZHIMENG_AUTH_API_BASE: process.env.ZHIMENG_AUTH_API_BASE || 'http://localhost:3001'
    }
});

const childEnv = {
    ...process.env,
    ZHIMENG_AUTH_API_BASE: process.env.ZHIMENG_AUTH_API_BASE || 'http://localhost:3001',
    ZHIMENG_PLAN_FAMILY_YEARLY_AMOUNT_CENTS: process.env.ZHIMENG_PLAN_FAMILY_YEARLY_AMOUNT_CENTS || '1'
};

const auth = spawn(process.execPath, [path.join(root, 'backend/server.js')], {
    cwd: root,
    stdio: 'inherit',
    env: childEnv
});

const electron = spawn(
    path.join(root, 'node_modules', '.bin', 'electron'),
    ['.'],
    {
        cwd: root,
        stdio: 'inherit',
        shell: true,
        env: childEnv
    }
);

let exiting = false;
const shutdown = code => {
    if (exiting) return;
    exiting = true;
    if (!auth.killed) auth.kill('SIGTERM');
    process.exit(code);
};

auth.on('exit', code => {
    if (!exiting && code !== 0) {
        shutdown(code || 1);
    }
});

electron.on('exit', code => {
    shutdown(code || 0);
});

process.on('SIGINT', () => shutdown(130));
process.on('SIGTERM', () => shutdown(143));
