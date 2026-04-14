const {spawnSync} = require('child_process');
const mysql = require('mysql2/promise');

const CONTAINER_NAME = 'zhimeng-mysql-test';
const MYSQL_PASSWORD = process.env.ZHIMENG_MYSQL_PASSWORD || 'root';
const TEST_DB = process.env.ZHIMENG_MYSQL_DATABASE || 'zhimeng_test';

const run = (cmd, args, opts = {}) => {
    const result = spawnSync(cmd, args, {
        stdio: 'pipe',
        encoding: 'utf8',
        ...opts
    });
    if (result.status !== 0) {
        const stderr = (result.stderr || '').trim();
        const stdout = (result.stdout || '').trim();
        throw new Error(`${cmd} ${args.join(' ')} failed\n${stderr || stdout}`);
    }
    return (result.stdout || '').trim();
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const waitForMysql = async ip => {
    const timeoutMs = Number(process.env.ZHIMENG_MYSQL_WAIT_MS || 240000);
    const stepMs = 2500;
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        try {
            const ping = spawnSync('docker', [
                'exec',
                CONTAINER_NAME,
                'mysqladmin',
                'ping',
                '-h',
                '127.0.0.1',
                '-uroot',
                `-p${MYSQL_PASSWORD}`
            ], {
                stdio: 'ignore'
            });
            if (ping.status !== 0) {
                await sleep(stepMs);
                continue;
            }
            const conn = await mysql.createConnection({
                host: ip,
                port: 3306,
                user: 'root',
                password: MYSQL_PASSWORD,
                connectTimeout: 4000
            });
            await conn.query(
                `CREATE DATABASE IF NOT EXISTS \`${TEST_DB}\` ` +
                'CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
            );
            await conn.end();
            return;
        } catch (err) {
            await sleep(stepMs);
        }
    }
    const logs = spawnSync('docker', ['logs', CONTAINER_NAME], {
        stdio: 'pipe',
        encoding: 'utf8'
    });
    const tailLogs = (logs.stderr || logs.stdout || '')
        .split('\n')
        .slice(-20)
        .join('\n');
    throw new Error(
        `MySQL did not become ready in ${timeoutMs}ms\n${tailLogs}`
    );
};

const cleanup = () => {
    try {
        run('docker', ['rm', '-f', CONTAINER_NAME]);
    } catch (e) {
        // Ignore cleanup failures.
    }
};

const main = async () => {
    cleanup();
    run('docker', [
        'run', '-d',
        '--name', CONTAINER_NAME,
        '-e', `MYSQL_ROOT_PASSWORD=${MYSQL_PASSWORD}`,
        '-e', 'MYSQL_DATABASE=zhimeng',
        'mysql:8.0',
        '--character-set-server=utf8mb4',
        '--collation-server=utf8mb4_unicode_ci'
    ]);

    const ip = run('docker', [
        'inspect',
        '-f',
        '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}',
        CONTAINER_NAME
    ]);
    if (!ip) {
        throw new Error('Could not resolve MySQL container IP');
    }

    await waitForMysql(ip);

    const env = {
        ...process.env,
        ZHIMENG_MYSQL_HOST: ip,
        ZHIMENG_MYSQL_PORT: '3306',
        ZHIMENG_MYSQL_USER: 'root',
        ZHIMENG_MYSQL_PASSWORD: MYSQL_PASSWORD,
        ZHIMENG_MYSQL_DATABASE: TEST_DB
    };
    const jestResult = spawnSync(
        process.platform === 'win32' ? 'npm.cmd' : 'npm',
        ['run', 'test:backend'],
        {
            stdio: 'inherit',
            env
        }
    );
    if (jestResult.status !== 0) {
        throw new Error(`Backend tests failed with exit code ${jestResult.status}`);
    }
};

main()
    .then(() => {
        if (!process.env.ZHIMENG_KEEP_MYSQL_CONTAINER) cleanup();
    })
    .catch(err => {
        // eslint-disable-next-line no-console
        console.error(err.message || err);
        if (!process.env.ZHIMENG_KEEP_MYSQL_CONTAINER) cleanup();
        process.exit(1);
    });
