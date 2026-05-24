const path = require('path');

const users = new Map();
const entitlements = new Map();
const refreshTokens = new Map();
const userDevices = new Map();
const orders = new Map();
let nextOrderId = 1;
let nextUserId = 2;

const nowPlusDays = days => new Date(Date.now() + (days * 24 * 60 * 60 * 1000));

const ensureSeed = () => {
    if (users.has(1)) return;
    users.set(1, {
        id: 1,
        username: 'demo',
        password_hash: '123456',
        nickname: '知萌体验账号',
        permission_student: 1,
        permission_educator: 0
    });
    entitlements.set(1, {
        user_id: 1,
        status: 'inactive',
        plan: '',
        features_json: JSON.stringify([]),
        device_limit: 3,
        subscription_expires_at: null
    });
    userDevices.set(1, []);
};

const mergeUserRow = userId => {
    const user = users.get(userId);
    if (!user) return null;
    const ent = entitlements.get(userId) || {};
    return {
        ...user,
        ...ent
    };
};

const mockDb = {
    initSchema: () => {},
    ping: () => {},
    seedDemoUser: () => {
        ensureSeed();
    },
    createUser: ({username, passwordHash, nickname}) => {
        ensureSeed();
        for (const user of users.values()) {
            if (user.username === username) {
                const err = new Error('Username already exists');
                err.code = 'ER_DUP_ENTRY';
                throw err;
            }
        }
        const id = nextUserId++;
        users.set(id, {
            id,
            username,
            password_hash: passwordHash,
            nickname: nickname || '',
            permission_student: 1,
            permission_educator: 0
        });
        entitlements.set(id, {
            user_id: id,
            status: 'inactive',
            plan: '',
            features_json: JSON.stringify([]),
            device_limit: 3,
            subscription_expires_at: null
        });
        userDevices.set(id, []);
        return id;
    },
    findUserByUsername: username => {
        ensureSeed();
        for (const user of users.values()) {
            if (user.username === username) {
                return mergeUserRow(user.id);
            }
        }
        return null;
    },
    findUserById: id => {
        ensureSeed();
        return mergeUserRow(Number(id));
    },
    listDevices: userId => {
        const list = userDevices.get(Number(userId)) || [];
        return list.slice().reverse();
    },
    insertRefreshToken: (userId, tokenHash, expiresAt) => {
        refreshTokens.set(tokenHash, {
            user_id: Number(userId),
            expires_at: expiresAt
        });
    },
    findRefreshToken: tokenHash => refreshTokens.get(tokenHash) || null,
    deleteRefreshToken: tokenHash => {
        refreshTokens.delete(tokenHash);
    },
    deleteExpiredRefreshTokens: () => {
        const now = Date.now();
        for (const [tokenHash, rec] of refreshTokens.entries()) {
            if (new Date(rec.expires_at).getTime() < now) {
                refreshTokens.delete(tokenHash);
            }
        }
    },
    bindDevice: (userId, deviceId, deviceName) => {
        const uid = Number(userId);
        const row = entitlements.get(uid);
        const limit = row && row.device_limit ? row.device_limit : 3;
        const list = userDevices.get(uid) || [];
        const existing = list.find(d => d.device_id === deviceId);
        if (existing) {
            existing.device_name = deviceName || 'unknown-device';
            existing.last_seen_at = new Date().toISOString();
            userDevices.set(uid, list);
            return list.length;
        }
        if (list.length >= limit) {
            const err = new Error('Device limit exceeded');
            err.statusCode = 409;
            throw err;
        }
        list.push({
            device_id: deviceId,
            device_name: deviceName || 'unknown-device',
            last_seen_at: new Date().toISOString()
        });
        userDevices.set(uid, list);
        return list.length;
    },
    unbindDevice: (userId, deviceId) => {
        const uid = Number(userId);
        const list = userDevices.get(uid) || [];
        userDevices.set(uid, list.filter(d => d.device_id !== deviceId));
    },
    createOrder: ({
        userId,
        plan,
        channel,
        returnUrl,
        amountCents,
        currency,
        paymentProofTokenHash
    }) => {
        const id = nextOrderId++;
        orders.set(id, {
            id,
            user_id: Number(userId),
            plan,
            channel,
            status: 'created',
            return_url: returnUrl || null,
            paid_at: null,
            fulfilled_at: null,
            provider: channel,
            provider_trade_no: null,
            amount_cents: typeof amountCents === 'number' ? amountCents : null,
            currency: currency || null,
            payment_proof_json: null,
            payment_proof_token_hash: paymentProofTokenHash || null
        });
        return id;
    },
    findOrderById: orderId => orders.get(Number(orderId)) || null,
    findOrderByPaymentProofToken: ({orderId, paymentProofTokenHash}) => {
        const row = orders.get(Number(orderId));
        if (!row || row.payment_proof_token_hash !== paymentProofTokenHash) {
            return null;
        }
        return row;
    },
    listOrdersByUser: userId => Array.from(orders.values())
        .filter(order => Number(order.user_id) === Number(userId))
        .reverse(),
    listOrders: ({status, hasPaymentProof, limit} = {}) => Array.from(orders.values())
        .filter(order => !status || order.status === status)
        .filter(order => !hasPaymentProof || order.payment_proof_json)
        .map(order => ({
            ...order,
            username: users.get(Number(order.user_id)) && users.get(Number(order.user_id)).username,
            nickname: users.get(Number(order.user_id)) && users.get(Number(order.user_id)).nickname
        }))
        .reverse()
        .slice(0, Math.max(1, Math.min(Number(limit) || 50, 200))),
    markOrderPaid: orderId => {
        const row = orders.get(Number(orderId));
        if (!row) return;
        row.status = 'paid';
        row.paid_at = new Date();
    },
    submitOrderPaymentProof: ({
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
        const row = orders.get(Number(orderId));
        const tokenMatches = paymentProofTokenHash &&
            row &&
            row.payment_proof_token_hash === paymentProofTokenHash;
        const userMatches = userId && row && Number(row.user_id) === Number(userId);
        if (!row || (!tokenMatches && !userMatches)) {
            const err = new Error('Order not found');
            err.statusCode = 404;
            throw err;
        }
        if (row.status !== 'created') {
            const err = new Error('Payment proof can only be submitted for created orders');
            err.statusCode = 409;
            throw err;
        }
        row.payment_proof_json = JSON.stringify({
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
        });
        return row;
    },
    fulfillOrderFromPayment: async ({orderId, provider, providerTradeNo, amountCents, currency}) => {
        const row = orders.get(Number(orderId));
        if (!row) {
            const err = new Error('Order not found');
            err.statusCode = 404;
            throw err;
        }
        if (
            typeof amountCents === 'number' &&
            typeof row.amount_cents === 'number' &&
            amountCents !== row.amount_cents
        ) {
            const err = new Error('Payment amount does not match order amount');
            err.statusCode = 409;
            throw err;
        }
        if (currency && row.currency && currency !== row.currency) {
            const err = new Error('Payment currency does not match order currency');
            err.statusCode = 409;
            throw err;
        }
        const idempotent = row.status === 'fulfilled';
        row.status = 'fulfilled';
        row.provider = provider || row.provider;
        row.provider_trade_no = providerTradeNo || row.provider_trade_no;
        row.paid_at = row.paid_at || new Date();
        row.fulfilled_at = row.fulfilled_at || new Date();
        await mockDb.activateEntitlementFromOrder(row.user_id, row.plan || 'family_yearly');
        return {
            order: row,
            idempotent
        };
    },
    activateEntitlementFromOrder: (userId, plan) => {
        const uid = Number(userId);
        entitlements.set(uid, {
            user_id: uid,
            status: 'active',
            plan: plan || 'family_yearly',
            features_json: JSON.stringify(['cloud_save', 'share', 'community', 'backpack']),
            device_limit: 3,
            subscription_expires_at: nowPlusDays(365)
        });
    },
    bcrypt: {
        compareSync: (password, stored) => password === stored
    }
};

const installMockDb = () => {
    const dbPath = path.resolve(__dirname, '../backend/db.js');
    require.cache[dbPath] = {
        id: dbPath,
        filename: dbPath,
        loaded: true,
        exports: mockDb
    };
};

installMockDb();

module.exports = {
    installMockDb,
    mockDb
};

if (require.main === module) {
    // eslint-disable-next-line global-require -- backend must be loaded after mock db is installed.
    const {createApp} = require('../backend/app');
    const PORT = Number(process.env.ZHIMENG_AUTH_PORT || 3001);

    createApp()
        .then(app => {
            app.listen(PORT, () => {
                // eslint-disable-next-line no-console
                console.log(`Zhimeng auth mock server listening on http://localhost:${PORT}`);
            });
        })
        .catch(err => {
            // eslint-disable-next-line no-console
            console.error('Failed to start auth mock server:', err.message || err);
            process.exit(1);
        });
}
