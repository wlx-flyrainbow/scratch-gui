const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

let pool;

const ORDER_STATUS = {
    CREATED: 'created',
    PAID: 'paid',
    FULFILLED: 'fulfilled'
};

const ENTITLEMENT_FEATURES = ['cloud_save', 'share', 'community', 'backpack'];
const DAY_MS = 24 * 60 * 60 * 1000;

const PLAN_DURATIONS_DAYS = {
    bootcamp_7d: 7,
    family_yearly: 365
};

const planDurationDays = plan => PLAN_DURATIONS_DAYS[plan] || 365;

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

const ping = async () => {
    const p = getPool();
    await p.query('SELECT 1');
};

const ensureColumn = async (p, tableName, columnName, columnSql) => {
    const [rows] = await p.query(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?
         LIMIT 1`,
        [tableName, columnName]
    );
    if (rows.length === 0) {
        await p.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnSql}`);
    }
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
            status_reason VARCHAR(255) NULL,
            status_note TEXT NULL,
            status_operator VARCHAR(128) NULL,
            status_updated_at DATETIME NULL,
            CONSTRAINT fk_ent_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await p.query(`
        CREATE TABLE IF NOT EXISTS entitlement_events (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED NOT NULL,
            action VARCHAR(64) NOT NULL,
            operator VARCHAR(128) NOT NULL DEFAULT '',
            reason VARCHAR(255) NOT NULL DEFAULT '',
            note TEXT NULL,
            payload_json JSON NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_entitlement_events_user (user_id),
            CONSTRAINT fk_ent_event_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
    await p.query(`
        CREATE TABLE IF NOT EXISTS orders (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED NOT NULL,
            plan VARCHAR(64) NOT NULL,
            channel VARCHAR(32) NOT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'created',
            provider VARCHAR(32) NULL,
            provider_trade_no VARCHAR(128) NULL,
            amount_cents INT NULL,
            currency VARCHAR(8) NULL,
            return_url VARCHAR(1024) NULL,
            paid_at DATETIME NULL,
            fulfilled_at DATETIME NULL,
            expires_at DATETIME NULL,
            payment_proof_token_hash CHAR(64) NULL,
            audit_json JSON NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_orders_user (user_id),
            KEY idx_orders_status (status),
            CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await ensureColumn(p, 'orders', 'provider', 'provider VARCHAR(32) NULL');
    await ensureColumn(p, 'orders', 'provider_trade_no', 'provider_trade_no VARCHAR(128) NULL');
    await ensureColumn(p, 'orders', 'amount_cents', 'amount_cents INT NULL');
    await ensureColumn(p, 'orders', 'currency', 'currency VARCHAR(8) NULL');
    await ensureColumn(p, 'orders', 'fulfilled_at', 'fulfilled_at DATETIME NULL');
    await ensureColumn(p, 'orders', 'expires_at', 'expires_at DATETIME NULL');
    await ensureColumn(p, 'orders', 'payment_proof_json', 'payment_proof_json JSON NULL');
    await ensureColumn(p, 'orders', 'payment_proof_token_hash', 'CHAR(64) NULL');
    await ensureColumn(p, 'orders', 'audit_json', 'audit_json JSON NULL');
    await ensureColumn(p, 'entitlements', 'status_reason', 'status_reason VARCHAR(255) NULL');
    await ensureColumn(p, 'entitlements', 'status_note', 'status_note TEXT NULL');
    await ensureColumn(p, 'entitlements', 'status_operator', 'status_operator VARCHAR(128) NULL');
    await ensureColumn(p, 'entitlements', 'status_updated_at', 'status_updated_at DATETIME NULL');
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
    const features = JSON.stringify(ENTITLEMENT_FEATURES);
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

const createUser = async ({username, passwordHash, nickname}) => {
    const p = getPool();
    const conn = await p.getConnection();
    try {
        await conn.beginTransaction();
        const [result] = await conn.query(
            `INSERT INTO users (username, password_hash, nickname, permission_student, permission_educator)
             VALUES (?, ?, ?, 1, 0)`,
            [username, passwordHash, nickname || '']
        );
        const userId = result.insertId;
        await conn.query(
            `INSERT INTO entitlements (user_id, status, plan, features_json, device_limit, subscription_expires_at)
             VALUES (?, 'inactive', '', ?, 3, NULL)`,
            [userId, JSON.stringify([])]
        );
        await conn.commit();
        return userId;
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

const findUserByUsername = async username => {
    const p = getPool();
    const [rows] = await p.query(
        `SELECT u.id, u.username, u.password_hash, u.nickname, u.permission_student, u.permission_educator,
                e.status, e.plan, e.features_json, e.device_limit, e.subscription_expires_at,
                e.status_reason, e.status_note, e.status_operator, e.status_updated_at
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
                e.status, e.plan, e.features_json, e.device_limit, e.subscription_expires_at,
                e.status_reason, e.status_note, e.status_operator, e.status_updated_at
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

const deleteExpiredRefreshTokens = async () => {
    const p = getPool();
    await p.query('DELETE FROM refresh_tokens WHERE expires_at < CURRENT_TIMESTAMP');
};

const bindDevice = async (userId, deviceId, deviceName) => {
    const p = getPool();
    const row = await findUserById(userId);
    if (!row || !row.device_limit) {
        throw new Error('User not found');
    }
    if (row.status === 'frozen') {
        const err = new Error('Account frozen');
        err.statusCode = 403;
        throw err;
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

const insertEntitlementEventWithConnection = async (
    conn,
    {userId, action, operator, reason, note, payload}
) => {
    await conn.query(
        `INSERT INTO entitlement_events (user_id, action, operator, reason, note, payload_json)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            userId,
            action,
            operator || '',
            reason || '',
            note || null,
            payload ? JSON.stringify(payload) : null
        ]
    );
};

const updateEntitlementStatus = async ({
    userId,
    status,
    operator,
    reason,
    note,
    action
}) => {
    const p = getPool();
    const conn = await p.getConnection();
    try {
        await conn.beginTransaction();
        let nextStatus = status;
        if (status === 'unfreeze') {
            const [rows] = await conn.query(
                'SELECT subscription_expires_at FROM entitlements WHERE user_id = ? LIMIT 1 FOR UPDATE',
                [userId]
            );
            const expiresAt = rows[0] && rows[0].subscription_expires_at ?
                new Date(rows[0].subscription_expires_at).getTime() :
                0;
            nextStatus = expiresAt > Date.now() ? 'active' : 'inactive';
        }
        await conn.query(
            `UPDATE entitlements
             SET status = ?,
                 status_reason = ?,
                 status_note = ?,
                 status_operator = ?,
                 status_updated_at = CURRENT_TIMESTAMP
             WHERE user_id = ?`,
            [
                nextStatus,
                reason || null,
                note || null,
                operator || '',
                userId
            ]
        );
        await insertEntitlementEventWithConnection(conn, {
            userId,
            action: action || status,
            operator,
            reason,
            note,
            payload: {status: nextStatus}
        });
        await conn.commit();
        return findUserById(userId);
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

const unbindDeviceByAdmin = async ({
    userId,
    deviceId,
    operator,
    reason,
    note
}) => {
    const p = getPool();
    const conn = await p.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query(
            'DELETE FROM user_devices WHERE user_id = ? AND device_id = ?',
            [userId, deviceId]
        );
        await insertEntitlementEventWithConnection(conn, {
            userId,
            action: 'device_unbind',
            operator,
            reason,
            note,
            payload: {deviceId}
        });
        await conn.commit();
        return true;
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

const createOrder = async ({
    userId,
    plan,
    channel,
    returnUrl,
    amountCents,
    currency,
    paymentProofTokenHash
}) => {
    const p = getPool();
    const [result] = await p.query(
        `INSERT INTO orders (
            user_id, plan, channel, provider, status, return_url,
            amount_cents, currency, payment_proof_token_hash
         )
         VALUES (?, ?, ?, ?, 'created', ?, ?, ?, ?)`,
        [
            userId,
            plan,
            channel,
            channel,
            returnUrl || null,
            typeof amountCents === 'number' ? amountCents : null,
            currency || null,
            paymentProofTokenHash || null
        ]
    );
    return result.insertId;
};

const findOrderById = async orderId => {
    const p = getPool();
    const [rows] = await p.query(
        `SELECT id, user_id, plan, channel, provider, provider_trade_no, amount_cents, currency,
                status, return_url, paid_at, fulfilled_at, expires_at, payment_proof_json, audit_json
         FROM orders WHERE id = ? LIMIT 1`,
        [orderId]
    );
    return rows[0] || null;
};

const listOrdersByUser = async userId => {
    const p = getPool();
    const [rows] = await p.query(
        `SELECT id, user_id, plan, channel, provider, provider_trade_no, amount_cents, currency,
                status, return_url, paid_at, fulfilled_at, expires_at, payment_proof_json, audit_json
         FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
        [userId]
    );
    return rows;
};

const listOrders = async ({status, hasPaymentProof, limit} = {}) => {
    const p = getPool();
    const where = [];
    const params = [];
    if (status) {
        where.push('status = ?');
        params.push(status);
    }
    if (hasPaymentProof) {
        where.push('payment_proof_json IS NOT NULL');
    }
    const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 200));
    const sql = `
        SELECT o.id, o.user_id, u.username, u.nickname, o.plan, o.channel, o.provider,
               o.provider_trade_no, o.amount_cents, o.currency, o.status, o.return_url,
               o.paid_at, o.fulfilled_at, o.expires_at, o.payment_proof_json, o.audit_json
        FROM orders o
        LEFT JOIN users u ON u.id = o.user_id
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY o.created_at DESC
        LIMIT ${safeLimit}
    `;
    const [rows] = await p.query(sql, params);
    return rows;
};

const findOrderByPaymentProofToken = async ({orderId, paymentProofTokenHash}) => {
    const p = getPool();
    const [rows] = await p.query(
        `SELECT id, user_id, plan, channel, provider, provider_trade_no, amount_cents, currency,
                status, return_url, paid_at, fulfilled_at, expires_at, payment_proof_json, audit_json
         FROM orders
         WHERE id = ?
           AND payment_proof_token_hash = ?
         LIMIT 1`,
        [orderId, paymentProofTokenHash]
    );
    return rows[0] || null;
};

const markOrderPaid = async orderId => {
    const p = getPool();
    await p.query(
        `UPDATE orders
         SET status = 'paid', paid_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [orderId]
    );
};

const submitOrderPaymentProof = async ({
    orderId,
    userId,
    paymentProofTokenHash,
    method,
    paidAt,
    amountCents,
    currency,
    transferNo,
    merchantOrderNo,
    tradeNoTail,
    payerNote,
    attachment
}) => {
    const p = getPool();
    let order = null;
    if (paymentProofTokenHash) {
        order = await findOrderByPaymentProofToken({orderId, paymentProofTokenHash});
    } else if (userId) {
        order = await findOrderById(orderId);
    }
    if (!order || (userId && Number(order.user_id) !== Number(userId))) {
        const err = new Error('Order not found');
        err.statusCode = 404;
        throw err;
    }
    if (order.status !== ORDER_STATUS.CREATED) {
        const err = new Error('Payment proof can only be submitted for created orders');
        err.statusCode = 409;
        throw err;
    }
    const proof = {
        method,
        paidAt,
        amountCents: typeof amountCents === 'number' ? amountCents : null,
        currency: currency || null,
        transferNo: transferNo || '',
        merchantOrderNo: merchantOrderNo || '',
        tradeNoTail,
        payerNote: payerNote || '',
        attachment: attachment || null,
        submittedAt: new Date().toISOString()
    };
    await p.query(
        `UPDATE orders
         SET payment_proof_json = ?
         WHERE id = ?`,
        [JSON.stringify(proof), orderId]
    );
    return findOrderById(orderId);
};

const updateOrderBusiness = async (orderId, business) => {
    const p = getPool();
    const order = await findOrderById(orderId);
    if (!order) {
        const err = new Error('Order not found');
        err.statusCode = 404;
        throw err;
    }
    let audit = {};
    if (typeof order.audit_json === 'object' && order.audit_json) {
        audit = order.audit_json;
    } else if (order.audit_json) {
        try {
            audit = JSON.parse(order.audit_json) || {};
        } catch (e) {
            audit = {};
        }
    }
    const currentBusiness = audit.business && typeof audit.business === 'object' ? audit.business : {};
    const nextAudit = Object.assign({}, audit, {
        business: Object.assign({}, currentBusiness, business, {
            updatedAt: new Date().toISOString()
        })
    });
    await p.query(
        `UPDATE orders
         SET audit_json = ?
         WHERE id = ?`,
        [JSON.stringify(nextAudit), orderId]
    );
    return findOrderById(orderId);
};

const activateEntitlementWithConnection = async (conn, userId, plan) => {
    const features = JSON.stringify(ENTITLEMENT_FEATURES);
    const [rows] = await conn.query(
        'SELECT status, plan, subscription_expires_at FROM entitlements WHERE user_id = ? LIMIT 1 FOR UPDATE',
        [userId]
    );
    const current = rows[0] || {};
    const now = Date.now();
    const currentExpiresAt = current.subscription_expires_at ?
        new Date(current.subscription_expires_at).getTime() :
        0;
    const baseTime = currentExpiresAt > now ? currentExpiresAt : now;
    const subExpires = new Date(baseTime + (planDurationDays(plan) * DAY_MS));
    const nextPlan = current.plan === 'family_yearly' && plan === 'bootcamp_7d' && currentExpiresAt > now ?
        current.plan :
        plan;
    const nextStatus = current.status === 'frozen' ? 'frozen' : 'active';
    await conn.query(
        `INSERT INTO entitlements (user_id, status, plan, features_json, device_limit, subscription_expires_at)
         VALUES (?, ?, ?, ?, 3, ?)
         ON DUPLICATE KEY UPDATE
            status = VALUES(status),
            plan = VALUES(plan),
            features_json = VALUES(features_json),
            subscription_expires_at = VALUES(subscription_expires_at)`,
        [userId, nextStatus, nextPlan || plan || 'family_yearly', features, subExpires]
    );
};

const activateEntitlementFromOrder = async (userId, plan) => {
    const p = getPool();
    await activateEntitlementWithConnection(p, userId, plan);
};

const fulfillOrderFromPayment = async ({
    orderId,
    actor,
    provider,
    providerTradeNo,
    amountCents,
    currency,
    rawPayload
}) => {
    const p = getPool();
    const conn = await p.getConnection();
    try {
        await conn.beginTransaction();
        const [rows] = await conn.query(
            `SELECT id, user_id, plan, channel, provider, provider_trade_no, amount_cents, currency,
                    status, return_url, paid_at, fulfilled_at, expires_at, payment_proof_json, audit_json
             FROM orders WHERE id = ? LIMIT 1 FOR UPDATE`,
            [orderId]
        );
        const order = rows[0] || null;
        if (!order) {
            const err = new Error('Order not found');
            err.statusCode = 404;
            throw err;
        }
        if (
            typeof amountCents === 'number' &&
            typeof order.amount_cents === 'number' &&
            order.amount_cents !== amountCents
        ) {
            const err = new Error('Payment amount does not match order amount');
            err.statusCode = 409;
            throw err;
        }
        if (currency && order.currency && currency !== order.currency) {
            const err = new Error('Payment currency does not match order currency');
            err.statusCode = 409;
            throw err;
        }
        if (providerTradeNo) {
            const [conflicts] = await conn.query(
                `SELECT id FROM orders
                 WHERE provider = ? AND provider_trade_no = ? AND id <> ?
                 LIMIT 1`,
                [provider || order.provider || order.channel, providerTradeNo, orderId]
            );
            if (conflicts.length > 0) {
                const err = new Error('Provider trade number already used');
                err.statusCode = 409;
                throw err;
            }
        }
        if (order.status === ORDER_STATUS.FULFILLED) {
            if (
                providerTradeNo &&
                order.provider_trade_no &&
                providerTradeNo !== order.provider_trade_no
            ) {
                const err = new Error('Provider trade number does not match fulfilled order');
                err.statusCode = 409;
                throw err;
            }
            await conn.commit();
            return {
                order,
                idempotent: true
            };
        }
        const audit = {
            actor: actor || 'system',
            provider: provider || order.provider || order.channel,
            providerTradeNo: providerTradeNo || order.provider_trade_no || null,
            confirmedAt: new Date().toISOString(),
            rawPayload: rawPayload || null
        };
        await conn.query(
            `UPDATE orders
             SET status = ?,
                 provider = ?,
                 provider_trade_no = COALESCE(?, provider_trade_no),
                 amount_cents = COALESCE(?, amount_cents),
                 currency = COALESCE(?, currency),
                 paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP),
                 audit_json = ?
             WHERE id = ?`,
            [
                ORDER_STATUS.PAID,
                audit.provider,
                providerTradeNo || null,
                typeof amountCents === 'number' ? amountCents : null,
                currency || null,
                JSON.stringify(audit),
                orderId
            ]
        );
        await activateEntitlementWithConnection(conn, order.user_id, order.plan || 'family_yearly');
        await conn.query(
            `UPDATE orders
             SET status = ?,
                 fulfilled_at = COALESCE(fulfilled_at, CURRENT_TIMESTAMP)
             WHERE id = ?`,
            [ORDER_STATUS.FULFILLED, orderId]
        );
        await conn.commit();
        return {
            order: await findOrderById(orderId),
            idempotent: false
        };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

module.exports = {
    ORDER_STATUS,
    getPool,
    closePool,
    ping,
    initSchema,
    seedDemoUser,
    createUser,
    findUserByUsername,
    findUserById,
    listDevices,
    insertRefreshToken,
    findRefreshToken,
    deleteRefreshToken,
    deleteExpiredRefreshTokens,
    bindDevice,
    unbindDevice,
    updateEntitlementStatus,
    unbindDeviceByAdmin,
    createOrder,
    findOrderById,
    listOrdersByUser,
    listOrders,
    findOrderByPaymentProofToken,
    markOrderPaid,
    submitOrderPaymentProof,
    updateOrderBusiness,
    activateEntitlementFromOrder,
    fulfillOrderFromPayment,
    bcrypt
};
