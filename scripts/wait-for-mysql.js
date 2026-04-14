/**
 * Wait until TCP connects to MySQL (container ready). Uses env after load-local-env.
 */
const net = require('net');
const path = require('path');

require(path.join(__dirname, '../backend/load-local-env.js'));

const host = process.env.ZHIMENG_MYSQL_HOST || '127.0.0.1';
const port = Number(process.env.ZHIMENG_MYSQL_PORT || 3307);
const maxMs = Number(process.env.ZHIMENG_MYSQL_WAIT_MS || 120000);
const interval = 400;

const tryOnce = () => new Promise((resolve, reject) => {
    const s = net.createConnection({host, port}, () => {
        s.end();
        resolve();
    });
    s.on('error', reject);
});

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
    const start = Date.now();
    process.stderr.write(`Waiting for MySQL at ${host}:${port} (up to ${maxMs / 1000}s)...\n`);
    for (;;) {
        try {
            await tryOnce();
            process.stderr.write('MySQL is reachable.\n');
            process.exit(0);
        } catch (e) {
            if (Date.now() - start > maxMs) {
                process.stderr.write(
                    `Timed out: ${e.message}. Is Docker running? Try: npm run docker:mysql\n`
                );
                process.exit(1);
            }
            await sleep(interval);
        }
    }
})();
