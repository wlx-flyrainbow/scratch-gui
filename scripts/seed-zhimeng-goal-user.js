const db = require('../backend/db');

const username = process.env.ZHIMENG_CHECK_USERNAME || 'zhimeng_goal_inactive';
const password = process.env.ZHIMENG_CHECK_PASSWORD || '123456';

const main = async () => {
    await db.initSchema();
    const pool = db.getPool();
    const passwordHash = db.bcrypt.hashSync(password, 10);
    const features = JSON.stringify([]);

    const [existingRows] = await pool.query(
        'SELECT id FROM users WHERE username = ? LIMIT 1',
        [username]
    );
    if (existingRows.length > 0) {
        await pool.query('DELETE FROM users WHERE id = ?', [existingRows[0].id]);
    }

    const [result] = await pool.query(
        `INSERT INTO users (username, password_hash, nickname, permission_student, permission_educator)
         VALUES (?, ?, ?, 1, 0)`,
        [username, passwordHash, '新祥编程目标验收账号']
    );
    await pool.query(
        `INSERT INTO entitlements (user_id, status, plan, features_json, device_limit, subscription_expires_at)
         VALUES (?, 'inactive', '', ?, 3, NULL)`,
        [result.insertId, features]
    );

    // eslint-disable-next-line no-console
    console.log(`Seeded inactive zhimeng goal user: ${username}`);
};

main()
    .then(() => db.closePool())
    .catch(async err => {
        // eslint-disable-next-line no-console
        console.error(err.message || err);
        await db.closePool();
        process.exit(1);
    });
