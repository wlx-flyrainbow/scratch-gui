const http = require('http');

/**
 * Send one HTTP request to an Express app without supertest (Jest 21 + supertest 7 conflict on node: imports).
 * @param {import('express').Express} app
 * @param {{ path: string, method?: string, headers?: object, body?: object }} opts
 * @returns {Promise<{ status: number, body: object|string }>}
 */
const inject = (app, opts) => new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
        const {port} = server.address();
        const method = opts.method || 'GET';
        const req = http.request({
            hostname: '127.0.0.1',
            port,
            path: opts.path,
            method,
            headers: opts.headers || {}
        }, res => {
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => {
                const raw = Buffer.concat(chunks).toString('utf8');
                let body;
                if (raw.length === 0) {
                    body = null;
                } else {
                    try {
                        body = JSON.parse(raw);
                    } catch (e) {
                        body = raw;
                    }
                }
                server.close(() => resolve({status: res.statusCode, body}));
            });
        });
        req.on('error', err => {
            server.close(() => reject(err));
        });
        if (opts.body !== undefined) {
            req.setHeader('Content-Type', 'application/json');
            req.write(JSON.stringify(opts.body));
        }
        req.end();
    });
});

module.exports = {inject};
