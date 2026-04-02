const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

let pool;

const getPool = () => {
    /* eslint-disable require-atomic-updates -- lazy singleton pool */
    if (!pool) {
        const pwd = Object.prototype.hasOwnProperty.call(process.env, 'ZHIMENG_MYSQL_PASSWORD') ?
            process.env.ZHIMENG_MYSQL_PASSWORD :
            '';
        pool = mysql.createPool({
            host: process.env.ZHIMENG_MYSQL_HOST || '127.0.0.1',
            port: Number(process.env.ZHIMENG_MYSQL_PORT || 3306),
            user: process.env.ZHIMENG_MYSQL_USER || 'root',
            password: pwd,
            database: process.env.ZHIMENG_MYSQL_DATABASE || 'zhimeng',
            waitForConnections: true,
            connectionLimit: 10,
            namedPlaceholders: true,
            connectTimeout: Number(process.env.ZHIMENG_MYSQL_CONNECT_TIMEOUT || 10000)
        });
    }
    /* eslint-enable require-atomic-updates */
    return pool;
};

const closePool = async () => {
    const current = pool;
    if (!current) {
        return;
    }
    await current.end();
    /* eslint-disable-next-line require-atomic-updates -- clear singleton after close */
    pool = null;
};

const initSchema = async () => {
    const p = getPool();
    await p.query(`
        CREATE TABLE IF NOT EXISTS users (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(64) NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            nickname VARCHAR(128) NOT NULL DEFAULT '',
            permission_student TINYINT(1) NOT NULL DEFAULT 1,
            permission_educator TINYINT(1) NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_users_username (username)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await p.query(`
        CREATE TABLE IF NOT EXISTS entitlements (
            user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
            status VARCHAR(32) NOT NULL DEFAULT 'inactive',
            plan VARCHAR(64) NOT NULL DEFAULT '',
            features_json JSON NOT NULL,
            device_limit INT NOT NULL DEFAULT 3,
            subscription_expires_at DATETIME NULL,
            CONSTRAINT fk_ent_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await p.query(`
        CREATE TABLE IF NOT EXISTS user_devices (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED NOT NULL,
            device_id VARCHAR(128) NOT NULL,
            device_name VARCHAR(255) NOT NULL DEFAULT '',
            last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_user_device (user_id, device_id),
            CONSTRAINT fk_dev_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await p.query(`
        CREATE TABLE IF NOT EXISTS refresh_tokens (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED NOT NULL,
            token_hash CHAR(64) NOT NULL,
            expires_at DATETIME NOT NULL,
            UNIQUE KEY uq_rt_hash (token_hash),
            KEY idx_rt_user (user_id),
            CONSTRAINT fk_rt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
};

const seedDemoUser = async () => {
    const p = getPool();
    const [rows] = await p.query(
        'SELECT id FROM users WHERE username = ? LIMIT 1',
        ['demo']
    );
    if (rows.length > 0) {
        return;
    }
    const hash = bcrypt.hashSync('123456', 10);
    const features = JSON.stringify(['cloud_save', 'share', 'community', 'backpack']);
    const subExpires = new Date(Date.now() + (365 * 24 * 60 * 60 * 1000));
    const [result] = await p.query(
        `INSERT INTO users (username, password_hash, nickname, permission_student, permission_educator)
         VALUES (?, ?, ?, 1, 0)`,
        ['demo', hash, '知萌体验账号']
    );
    const userId = result.insertId;
    await p.query(
        `INSERT INTO entitlements (user_id, status, plan, features_json, device_limit, subscription_expires_at)
         VALUES (?, 'active', 'family_yearly', ?, 3, ?)`,
        [userId, features, subExpires]
    );
};

const findUserByUsername = async username => {
    const p = getPool();
    const [rows] = await p.query(
        `SELECT u.id, u.username, u.password_hash, u.nickname, u.permission_student, u.permission_educator,
                e.status, e.plan, e.features_json, e.device_limit, e.subscription_expires_at
         FROM users u
         LEFT JOIN entitlements e ON e.user_id = u.id
         WHERE u.username = ?
         LIMIT 1`,
        [username]
    );
    return rows[0] || null;
};

const findUserById = async id => {
    const p = getPool();
    const [rows] = await p.query(
        `SELECT u.id, u.username, u.nickname, u.permission_student, u.permission_educator,
                e.status, e.plan, e.features_json, e.device_limit, e.subscription_expires_at
         FROM users u
         LEFT JOIN entitlements e ON e.user_id = u.id
         WHERE u.id = ?
         LIMIT 1`,
        [id]
    );
    return rows[0] || null;
};

const listDevices = async userId => {
    const p = getPool();
    const [rows] = await p.query(
        `SELECT device_id AS device_id, device_name AS device_name, last_seen_at AS last_seen_at
         FROM user_devices WHERE user_id = ? ORDER BY last_seen_at DESC`,
        [userId]
    );
    return rows.map(r => ({
        device_id: r.device_id,
        device_name: r.device_name,
        last_seen_at: r.last_seen_at instanceof Date ? r.last_seen_at.toISOString() : r.last_seen_at
    }));
};

const insertRefreshToken = async (userId, tokenHash, expiresAt) => {
    const p = getPool();
    await p.query(
        'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
        [userId, tokenHash, expiresAt]
    );
};

const findRefreshToken = async tokenHash => {
    const p = getPool();
    const [rows] = await p.query(
        `SELECT rt.user_id AS user_id, rt.expires_at AS expires_at
         FROM refresh_tokens rt WHERE rt.token_hash = ? LIMIT 1`,
        [tokenHash]
    );
    return rows[0] || null;
};

const deleteRefreshToken = async tokenHash => {
    const p = getPool();
    await p.query('DELETE FROM refresh_tokens WHERE token_hash = ?', [tokenHash]);
};

const bindDevice = async (userId, deviceId, deviceName) => {
    const p = getPool();
    const row = await findUserById(userId);
    if (!row || !row.device_limit) {
        throw new Error('User not found');
    }
    const [countRows] = await p.query(
        'SELECT COUNT(*) AS c FROM user_devices WHERE user_id = ?',
        [userId]
    );
    const [existing] = await p.query(
        'SELECT id FROM user_devices WHERE user_id = ? AND device_id = ? LIMIT 1',
        [userId, deviceId]
    );
    if (existing.length > 0) {
        const updateSql =
            'UPDATE user_devices SET device_name = ?, last_seen_at = CURRENT_TIMESTAMP ' +
            'WHERE user_id = ? AND device_id = ?';
        await p.query(updateSql, [deviceName || 'unknown-device', userId, deviceId]);
        return countRows[0].c;
    }
    if (countRows[0].c >= row.device_limit) {
        const err = new Error('Device limit exceeded');
        err.statusCode = 409;
        throw err;
    }
    await p.query(
        'INSERT INTO user_devices (user_id, device_id, device_name) VALUES (?, ?, ?)',
        [userId, deviceId, deviceName || 'unknown-device']
    );
    return countRows[0].c + 1;
};

const unbindDevice = async (userId, deviceId) => {
    const p = getPool();
    await p.query(
        'DELETE FROM user_devices WHERE user_id = ? AND device_id = ?',
        [userId, deviceId]
    );
};

module.exports = {
    getPool,
    closePool,
    initSchema,
    seedDemoUser,
    findUserByUsername,
    findUserById,
    listDevices,
    insertRefreshToken,
    findRefreshToken,
    deleteRefreshToken,
    bindDevice,
    unbindDevice,
    bcrypt
};
