const {createApp} = require('./app');

const PORT = Number(process.env.ZHIMENG_AUTH_PORT || 3001);

createApp()
    .then(app => {
        app.listen(PORT, () => {
            // eslint-disable-next-line no-console
            console.log(`Zhimeng auth server listening on http://localhost:${PORT}`);
        });
    })
    .catch(err => {
        // eslint-disable-next-line no-console
        console.error('Failed to start auth server:', err.message || err);
        if (err.code === 'ECONNREFUSED') {
            const host = process.env.ZHIMENG_MYSQL_HOST || '127.0.0.1';
            const port = process.env.ZHIMENG_MYSQL_PORT || '3306';
            // eslint-disable-next-line no-console
            console.error(
                `MySQL is not accepting connections at ${host}:${port}. ` +
                'Start it (e.g. `docker compose up -d` and match ZHIMENG_MYSQL_PORT to the compose host port, ' +
                'often 3307), or point ZHIMENG_MYSQL_PORT at your local instance (often 3306). ' +
                'See docs/zhimeng-backend-local-dev.md.'
            );
        }
        process.exit(1);
    });
