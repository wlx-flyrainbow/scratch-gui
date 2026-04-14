require('./load-local-env');

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const db = require('./db');

const LEASE_DAYS = Number(process.env.ZHIMENG_LEASE_DAYS || 7);
const TOKEN_TTL_MS = 60 * 60 * 1000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** @type {Map<string, {userId: number, expiresAt: number}>} */
const accessTokens = new Map();

const issueToken = prefix => `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;

const hashRefreshToken = token =>
    crypto.createHash('sha256').update(token, 'utf8')
        .digest('hex');

const nowIso = () => new Date().toISOString();

const parseFeatures = row => {
    if (!row) {
        return [];
    }
    const fj = row.features_json;
    if (fj === null || fj === void 0) {
        return [];
    }
    if (Array.isArray(fj)) {
        return fj;
    }
    if (typeof fj === 'string') {
        try {
            return JSON.parse(fj);
        } catch (e) {
            return [];
        }
    }
    return [];
};

const toUserPayload = (row, devices) => {
    const features = parseFeatures(row);
    const expiresAt = row.subscription_expires_at ?
        (row.subscription_expires_at instanceof Date ?
            row.subscription_expires_at.toISOString() :
            row.subscription_expires_at) :
        null;
    return {
        id: String(row.id),
        username: row.username,
        nickname: row.nickname || '',
        permissions: {
            student: Boolean(row.permission_student),
            educator: Boolean(row.permission_educator)
        },
        entitlement: {
            status: row.status || 'inactive',
            plan: row.plan || '',
            features,
            device_limit: typeof row.device_limit === 'number' ? row.device_limit : 3,
            expires_at: expiresAt,
            devices: devices || []
        }
    };
};

const buildEntitlementResponse = userPayload => ({
    ...userPayload.entitlement,
    lease: {
        issuedAt: nowIso(),
        expiresAt: new Date(Date.now() + (LEASE_DAYS * DAY_MS)).toISOString()
    }
});

const getAccessToken = req => {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return null;
    return header.slice('Bearer '.length);
};

const createApp = async () => {
    await db.initSchema();
    await db.seedDemoUser();

    const app = express();
    app.use(cors());
    app.use(express.json());

    const requireAuth = async (req, res, next) => {
        try {
            const token = getAccessToken(req);
            if (!token || !accessTokens.has(token)) {
                return res.status(401).json({message: 'Unauthorized'});
            }
            const rec = accessTokens.get(token);
            if (Date.now() > rec.expiresAt) {
                accessTokens.delete(token);
                return res.status(401).json({message: 'Access token expired'});
            }
            const row = await db.findUserById(rec.userId);
            if (!row) {
                return res.status(401).json({message: 'User not found'});
            }
            const devices = await db.listDevices(row.id);
            const userPayload = toUserPayload(row, devices);
            /* eslint-disable require-atomic-updates -- sequential auth attach */
            req.user = userPayload;
            req.userNumericId = row.id;
            /* eslint-enable require-atomic-updates */
            return next();
        } catch (err) {
            return res.status(500).json({message: err.message || 'Server error'});
        }
    };

    app.get('/health', (req, res) => {
        res.json({ok: true, now: nowIso(), storage: 'mysql'});
    });

    app.post('/auth/login', async (req, res) => {
        try {
            const {username, password} = req.body || {};
            if (!username || !password) {
                return res.status(400).json({message: 'username and password are required'});
            }
            const row = await db.findUserByUsername(username);
            if (!row || !db.bcrypt.compareSync(password, row.password_hash)) {
                return res.status(401).json({message: 'Invalid username or password'});
            }
            const accessToken = issueToken('at');
            const refreshToken = issueToken('rt');
            const rtHash = hashRefreshToken(refreshToken);
            const rtExpires = new Date(Date.now() + REFRESH_TTL_MS);
            await db.insertRefreshToken(row.id, rtHash, rtExpires);
            accessTokens.set(accessToken, {
                userId: row.id,
                expiresAt: Date.now() + TOKEN_TTL_MS
            });
            const devices = await db.listDevices(row.id);
            const userPayload = toUserPayload(row, devices);
            return res.json({
                access_token: accessToken,
                refresh_token: refreshToken,
                user: {
                    id: userPayload.id,
                    username: userPayload.username,
                    nickname: userPayload.nickname
                },
                permissions: userPayload.permissions,
                entitlement: buildEntitlementResponse(userPayload)
            });
        } catch (err) {
            return res.status(500).json({message: err.message || 'Server error'});
        }
    });

    app.post('/auth/refresh', async (req, res) => {
        try {
            const {refresh_token: refreshToken} = req.body || {};
            if (!refreshToken) {
                return res.status(401).json({message: 'Invalid refresh token'});
            }
            const rtHash = hashRefreshToken(refreshToken);
            const rec = await db.findRefreshToken(rtHash);
            if (!rec) {
                return res.status(401).json({message: 'Invalid refresh token'});
            }
            if (new Date(rec.expires_at).getTime() < Date.now()) {
                await db.deleteRefreshToken(rtHash);
                return res.status(401).json({message: 'Refresh token expired'});
            }
            const accessToken = issueToken('at');
            accessTokens.set(accessToken, {
                userId: rec.user_id,
                expiresAt: Date.now() + TOKEN_TTL_MS
            });
            return res.json({access_token: accessToken});
        } catch (err) {
            return res.status(500).json({message: err.message || 'Server error'});
        }
    });

    app.post('/auth/logout', async (req, res) => {
        try {
            const {refresh_token: refreshToken} = req.body || {};
            if (refreshToken) {
                const rtHash = hashRefreshToken(refreshToken);
                await db.deleteRefreshToken(rtHash);
            }
            return res.status(204).send();
        } catch (err) {
            return res.status(500).json({message: err.message || 'Server error'});
        }
    });

    app.get('/auth/me', requireAuth, (req, res) => res.json({
        id: req.user.id,
        username: req.user.username,
        nickname: req.user.nickname
    }));

    app.get('/entitlement', requireAuth, (req, res) => res.json(buildEntitlementResponse(req.user)));

    app.post('/entitlement/device/bind', requireAuth, async (req, res) => {
        try {
            const {device_id: deviceId, device_name: deviceName} = req.body || {};
            if (!deviceId) return res.status(400).json({message: 'device_id is required'});
            const count = await db.bindDevice(req.userNumericId, deviceId, deviceName);
            return res.json({ok: true, device_count: count});
        } catch (err) {
            if (err.statusCode === 409) {
                return res.status(409).json({message: err.message});
            }
            return res.status(500).json({message: err.message || 'Server error'});
        }
    });

    app.post('/entitlement/device/unbind', requireAuth, async (req, res) => {
        try {
            const {device_id: deviceId} = req.body || {};
            if (!deviceId) return res.status(400).json({message: 'device_id is required'});
            await db.unbindDevice(req.userNumericId, deviceId);
            return res.json({ok: true});
        } catch (err) {
            return res.status(500).json({message: err.message || 'Server error'});
        }
    });

    app.post('/order/create', requireAuth, async (req, res) => {
        try {
            const {plan, channel, return_url: returnUrl} = req.body || {};
            if (!plan || !channel) {
                return res.status(400).json({message: 'plan and channel are required'});
            }
            const orderId = await db.createOrder({
                userId: req.userNumericId,
                plan,
                channel,
                returnUrl
            });
            return res.json({
                order_id: `o_${orderId}`,
                pay_url: `${process.env.ZHIMENG_BILLING_URL || 'https://billing.zhimeng.example.com'}/pay/${orderId}`,
                qr_code_url: `${process.env.ZHIMENG_BILLING_URL || 'https://billing.zhimeng.example.com'}/qr/${orderId}`
            });
        } catch (err) {
            return res.status(500).json({message: err.message || 'Server error'});
        }
    });

    app.get('/order/:id/status', requireAuth, async (req, res) => {
        try {
            const rawId = String(req.params.id || '');
            const numericId = Number(rawId.replace(/^o_/, ''));
            if (!Number.isFinite(numericId) || numericId <= 0) {
                return res.status(400).json({message: 'Invalid order id'});
            }
            const order = await db.findOrderById(numericId);
            if (!order || Number(order.user_id) !== Number(req.userNumericId)) {
                return res.status(404).json({message: 'Order not found'});
            }
            return res.json({
                order_id: `o_${order.id}`,
                status: order.status,
                paid_at: order.paid_at instanceof Date ? order.paid_at.toISOString() : order.paid_at
            });
        } catch (err) {
            return res.status(500).json({message: err.message || 'Server error'});
        }
    });

    app.post('/order/:id/mock-paid', requireAuth, async (req, res) => {
        try {
            const rawId = String(req.params.id || '');
            const numericId = Number(rawId.replace(/^o_/, ''));
            if (!Number.isFinite(numericId) || numericId <= 0) {
                return res.status(400).json({message: 'Invalid order id'});
            }
            const order = await db.findOrderById(numericId);
            if (!order || Number(order.user_id) !== Number(req.userNumericId)) {
                return res.status(404).json({message: 'Order not found'});
            }
            await db.markOrderPaid(numericId);
            await db.activateEntitlementFromOrder(req.userNumericId, order.plan || 'family_yearly');
            const refreshed = await db.findOrderById(numericId);
            return res.json({
                ok: true,
                order_id: `o_${numericId}`,
                status: refreshed.status
            });
        } catch (err) {
            return res.status(500).json({message: err.message || 'Server error'});
        }
    });

    return app;
};

module.exports = {
    createApp,
    accessTokens,
    hashRefreshToken
};
