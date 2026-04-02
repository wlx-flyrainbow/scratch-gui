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
        console.error('Failed to start auth server:', err);
        process.exit(1);
    });
