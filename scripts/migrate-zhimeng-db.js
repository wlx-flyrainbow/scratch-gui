require('../backend/load-local-env');

const db = require('../backend/db');

const main = async () => {
    await db.initSchema();
    // eslint-disable-next-line no-console
    console.log('Zhimeng database schema is ready.');
};

main()
    .then(() => db.closePool())
    .catch(async err => {
        // eslint-disable-next-line no-console
        console.error(err.message || err);
        await db.closePool();
        process.exit(1);
    });
