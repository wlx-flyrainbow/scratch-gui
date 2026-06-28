require('./load-local-env');

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const db = require('./db');

const LEASE_DAYS = Number(process.env.ZHIMENG_LEASE_DAYS || 7);
const TOKEN_TTL_MS = 60 * 60 * 1000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,32}$/;
const PAYMENT_PROOF_MAX_BYTES = Number(process.env.ZHIMENG_PAYMENT_PROOF_MAX_BYTES || (5 * 1024 * 1024));
const PAYMENT_PROOF_MIME_EXT = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
};

/** @type {Map<string, {userId: number, expiresAt: number}>} */
const accessTokens = new Map();

const isProduction = () => process.env.NODE_ENV === 'production';

const isTruthyEnv = value => ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());

const shouldSeedDemoUser = () => !isProduction() || isTruthyEnv(process.env.ZHIMENG_SEED_DEMO_USER);

const shouldAutoInitSchema = () => !isProduction() || isTruthyEnv(process.env.ZHIMENG_AUTO_INIT_SCHEMA);

const shouldEnableMockPayment = () => !isProduction() || isTruthyEnv(process.env.ZHIMENG_ENABLE_MOCK_PAYMENT);

const paymentMode = () => process.env.ZHIMENG_PAYMENT_MODE || 'manual_qr';

const paymentProofStorageDir = () =>
    process.env.ZHIMENG_PAYMENT_PROOF_STORAGE_DIR ||
    path.join(process.cwd(), 'data', 'payment-proofs');

const localPaymentQrUrl = channel =>
    `http://localhost:${process.env.ZHIMENG_AUTH_PORT || 3001}/payment/qr/${channel}.jpg`;

const parsePlanPrices = () => {
    const raw = process.env.ZHIMENG_PLAN_PRICES_JSON;
    if (!raw) {
        return {};
    }
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
        return {};
    }
};

const getPlanAmountCents = plan => {
    const prices = parsePlanPrices();
    const configured = prices[plan];
    if (typeof configured === 'number' && Number.isFinite(configured)) {
        return configured;
    }
    if (typeof configured === 'string' && configured.trim()) {
        const parsed = Number(configured);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    if (plan === 'family_yearly') {
        return Number(process.env.ZHIMENG_PLAN_FAMILY_YEARLY_AMOUNT_CENTS || 19900);
    }
    if (plan === 'bootcamp_7d') {
        return Number(process.env.ZHIMENG_PLAN_BOOTCAMP_7D_AMOUNT_CENTS || 69900);
    }
    return Number(process.env.ZHIMENG_DEFAULT_PLAN_AMOUNT_CENTS || 0);
};

const yuanToCents = value => {
    const text = String(value || '').trim();
    if (!text) {
        return null;
    }
    if (!/^\d+(\.\d{1,2})?$/.test(text)) {
        return null;
    }
    return Math.round(Number(text) * 100);
};

const buildPaymentNote = orderId => {
    const template = process.env.ZHIMENG_PAYMENT_NOTE_TEMPLATE || '付款备注请填写：ZM-{order_id}';
    return template.replace(/\{order_id\}/g, `o_${orderId}`);
};

const appendQuery = (url, params) => {
    const query = Object.keys(params)
        .filter(key => params[key])
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
        .join('&');
    return query ? `${url}${url.indexOf('?') === -1 ? '?' : '&'}${query}` : url;
};

const getQrCodeUrl = (channel, base, orderId) => {
    if (channel === 'wechat' && process.env.ZHIMENG_WECHAT_PAYMENT_QR_URL) {
        return process.env.ZHIMENG_WECHAT_PAYMENT_QR_URL;
    }
    if (channel === 'alipay' && process.env.ZHIMENG_ALIPAY_PAYMENT_QR_URL) {
        return process.env.ZHIMENG_ALIPAY_PAYMENT_QR_URL;
    }
    if (!isProduction() && ['wechat', 'alipay'].includes(channel)) {
        return localPaymentQrUrl(channel);
    }
    return process.env.ZHIMENG_PAYMENT_QR_URL || `${base}/qr/${orderId}`;
};

const buildPaymentUrls = (orderId, paymentProofToken, channel, fallbackBase) => {
    const base = (
        process.env.ZHIMENG_BILLING_URL ||
        fallbackBase ||
        process.env.ZHIMENG_AUTH_API_BASE ||
        'http://localhost:3001'
    )
        .replace(/\/$/, '');
    const qrCodeUrl = getQrCodeUrl(channel, base, orderId);
    const apiBase = process.env.ZHIMENG_PAYMENT_API_BASE || process.env.ZHIMENG_AUTH_API_BASE || '';
    return {
        pay_url: appendQuery(`${base}/pay.html`, {
            order_id: `o_${orderId}`,
            proof_token: paymentProofToken,
            api_base: apiBase
        }),
        qr_code_url: qrCodeUrl
    };
};

const requestBaseUrl = req => {
    const host = req.get('host');
    if (!host) return '';
    const forwardedProto = String(req.get('x-forwarded-proto') || '')
        .split(',')[0]
        .trim();
    return `${forwardedProto || req.protocol || 'http'}://${host}`;
};

const buildPaymentMethods = orderId => ({
    wechat: {
        label: '微信',
        qr_code_url: getQrCodeUrl('wechat', '', orderId)
    },
    alipay: {
        label: '支付宝',
        qr_code_url: getQrCodeUrl('alipay', '', orderId)
    },
    bank: {
        label: '银行转账',
        qr_code_url: null
    },
    other: {
        label: '其他',
        qr_code_url: null
    }
});

const safeCompare = (a, b) => {
    const left = Buffer.from(String(a || ''), 'utf8');
    const right = Buffer.from(String(b || ''), 'utf8');
    return left.length === right.length && crypto.timingSafeEqual(left, right);
};

const issueToken = prefix => `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;

const hashRefreshToken = token =>
    crypto.createHash('sha256').update(token, 'utf8')
        .digest('hex');

const hashPaymentProofToken = token =>
    crypto.createHash('sha256').update(String(token || ''), 'utf8')
        .digest('hex');

const sanitizeFilename = filename => {
    const fallback = 'payment-proof';
    return String(filename || fallback)
        .replace(/[/\\]/g, '-')
        .replace(/[^\w.\-\u4e00-\u9fa5]/g, '_')
        .slice(0, 120) || fallback;
};

const parseProofAttachment = attachment => {
    if (!attachment) {
        return null;
    }
    const dataUrl = String(attachment.data_url || '');
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    const mimeType = String(
        (match && match[1]) ||
        attachment.mime_type ||
        attachment.mimeType ||
        ''
    ).toLowerCase();
    const encoded = match ? match[2] : String(attachment.base64 || '');
    if (!PAYMENT_PROOF_MIME_EXT[mimeType]) {
        const err = new Error('payment proof attachment must be jpg, png or webp');
        err.statusCode = 400;
        throw err;
    }
    if (!encoded) {
        const err = new Error('payment proof attachment is empty');
        err.statusCode = 400;
        throw err;
    }
    const buffer = Buffer.from(encoded, 'base64');
    if (!buffer.length || buffer.length > PAYMENT_PROOF_MAX_BYTES) {
        const err = new Error('payment proof attachment exceeds size limit');
        err.statusCode = 400;
        throw err;
    }
    return {
        buffer,
        mimeType,
        originalName: sanitizeFilename(attachment.filename || attachment.name),
        ext: PAYMENT_PROOF_MIME_EXT[mimeType]
    };
};

const storeProofAttachment = async ({orderId, attachment}) => {
    const parsed = parseProofAttachment(attachment);
    if (!parsed) {
        return null;
    }
    const id = crypto.randomUUID();
    const dir = paymentProofStorageDir();
    const filename = `${orderId}-${id}.${parsed.ext}`;
    const absolutePath = path.join(dir, filename);
    await fs.promises.mkdir(dir, {recursive: true});
    await fs.promises.writeFile(absolutePath, parsed.buffer, {flag: 'wx'});
    return {
        id,
        filename: parsed.originalName,
        mimeType: parsed.mimeType,
        sizeBytes: parsed.buffer.length,
        sha256: crypto.createHash('sha256')
            .update(parsed.buffer)
            .digest('hex'),
        storage: 'local',
        storageKey: filename,
        uploadedAt: new Date().toISOString()
    };
};

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

const toIsoValue = value => {
    if (!value) return null;
    return value instanceof Date ? value.toISOString() : value;
};

const resolveEntitlementStatus = row => {
    const rawStatus = row.status || 'inactive';
    if (rawStatus === 'frozen') return 'frozen';
    if (rawStatus === 'active' && row.subscription_expires_at) {
        const expiresAt = row.subscription_expires_at instanceof Date ?
            row.subscription_expires_at.getTime() :
            new Date(row.subscription_expires_at).getTime();
        if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
            return 'expired';
        }
    }
    return rawStatus;
};

const toUserPayload = (row, devices) => {
    const features = parseFeatures(row);
    const expiresAt = toIsoValue(row.subscription_expires_at);
    return {
        id: String(row.id),
        username: row.username,
        nickname: row.nickname || '',
        permissions: {
            student: Boolean(row.permission_student),
            educator: Boolean(row.permission_educator)
        },
        entitlement: {
            status: resolveEntitlementStatus(row),
            plan: row.plan || '',
            features,
            device_limit: typeof row.device_limit === 'number' ? row.device_limit : 3,
            expires_at: expiresAt,
            status_reason: row.status_reason || '',
            status_note: row.status_note || '',
            status_operator: row.status_operator || '',
            status_updated_at: toIsoValue(row.status_updated_at),
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

const buildAuthSessionResponse = async row => {
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
    return {
        access_token: accessToken,
        refresh_token: refreshToken,
        user: {
            id: userPayload.id,
            username: userPayload.username,
            nickname: userPayload.nickname
        },
        permissions: userPayload.permissions,
        entitlement: buildEntitlementResponse(userPayload)
    };
};

const getAccessToken = req => {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return null;
    return header.slice('Bearer '.length);
};

const parseOrderId = rawId => {
    const numericId = Number(String(rawId || '').replace(/^o_/, ''));
    return Number.isFinite(numericId) && numericId > 0 ? numericId : null;
};

const toIso = value => (value instanceof Date ? value.toISOString() : value);

const parseJsonValue = value => {
    if (!value) {
        return null;
    }
    if (typeof value === 'object') {
        return value;
    }
    try {
        return JSON.parse(value);
    } catch (e) {
        return null;
    }
};

const toOrderPayload = order => ({
    order_id: `o_${order.id}`,
    user_id: String(order.user_id),
    username: order.username || null,
    nickname: order.nickname || null,
    plan: order.plan,
    channel: order.channel,
    provider: order.provider || order.channel,
    provider_trade_no: order.provider_trade_no || null,
    amount_cents: order.amount_cents,
    currency: order.currency,
    status: order.status,
    paid_at: toIso(order.paid_at),
    fulfilled_at: toIso(order.fulfilled_at),
    expires_at: toIso(order.expires_at),
    payment_account_label: process.env.ZHIMENG_PAYMENT_ACCOUNT_LABEL || '知萌官方收款',
    payment_note: buildPaymentNote(order.id),
    payment_methods: buildPaymentMethods(order.id),
    payment_proof: parseJsonValue(order.payment_proof_json),
    business: (parseJsonValue(order.audit_json) || {}).business || null
});

const safeMoneyCents = value => {
    if (value === null || typeof value === 'undefined' || value === '') {
        return null;
    }
    const parsed = Math.round(Number(value));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const pickBodyValue = (body, snakeKey, camelKey) => (
    Object.prototype.hasOwnProperty.call(body, snakeKey) ? body[snakeKey] : body[camelKey]
);

const safeInteger = (value, min = 0, max = 9999) => {
    if (value === null || typeof value === 'undefined' || value === '') {
        return null;
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) return null;
    return parsed >= min && parsed <= max ? parsed : null;
};

const safeBoolean = value => value === true || value === 1 || isTruthyEnv(value);

const safeText = (value, limit = 160) => String(value || '')
    .trim()
    .slice(0, limit);

const buildOrderBusinessFromAttribution = (body, plan) => {
    const referrerCode = safeText(
        pickBodyValue(body, 'referrer_code', 'referrerCode') || body.ref,
        64
    );
    const landingPageId = safeText(pickBodyValue(body, 'landing_page_id', 'landingPageId'), 96);
    const referrerName = safeText(pickBodyValue(body, 'referrer_name', 'referrerName'), 128);
    const teacherName = safeText(pickBodyValue(body, 'teacher_name', 'teacherName'), 128);
    const teacherId = safeText(pickBodyValue(body, 'teacher_id', 'teacherId'), 64);
    const attributionNote = safeText(pickBodyValue(body, 'attribution_note', 'attributionNote'), 500);
    const sourceType = safeText(
        pickBodyValue(body, 'source_type', 'sourceType') ||
        (referrerCode || referrerName || teacherName || teacherId || landingPageId ? 'kol' : ''),
        64
    );
    const business = {};
    if (sourceType) business.source = sourceType;
    if (plan) business.packageType = safeText(plan, 64);
    if (referrerCode) business.referrerCode = referrerCode;
    if (referrerName) business.referrerName = referrerName;
    if (teacherName) business.teacherName = teacherName;
    if (teacherId) business.teacherId = teacherId;
    if (landingPageId) business.landingPageId = landingPageId;
    if (attributionNote) business.attributionNote = attributionNote;
    if (Object.keys(business).length > 0) {
        business.attributionCapturedAt = nowIso();
    }
    return business;
};

const sendServerError = (res, err) => {
    const message = isProduction() ? 'Server error' : (err.message || 'Server error');
    return res.status(500).json({message});
};

const buildCorsOptions = () => {
    const origins = String(process.env.ZHIMENG_CORS_ORIGINS || '')
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean);
    if (origins.length === 0) {
        return isProduction() ? {origin: false} : {};
    }
    return {
        origin: (origin, cb) => {
            if (!origin || origins.includes(origin)) {
                cb(null, true);
                return;
            }
            cb(new Error('Not allowed by CORS'));
        }
    };
};

const createRateLimiter = () => {
    const windowMs = Number(process.env.ZHIMENG_RATE_LIMIT_WINDOW_MS || 60000);
    const max = Number(process.env.ZHIMENG_RATE_LIMIT_MAX || (isProduction() ? 600 : 0));
    const hits = new Map();
    return (req, res, next) => {
        if (!max || max <= 0) return next();
        const now = Date.now();
        const key = req.ip || req.connection.remoteAddress || 'unknown';
        const rec = hits.get(key);
        if (!rec || now > rec.resetAt) {
            hits.set(key, {count: 1, resetAt: now + windowMs});
            return next();
        }
        rec.count++;
        if (rec.count > max) {
            return res.status(429).json({message: 'Too many requests'});
        }
        return next();
    };
};

const createApp = async () => {
    if (shouldAutoInitSchema()) {
        await db.initSchema();
    }
    if (shouldSeedDemoUser()) {
        await db.seedDemoUser();
    }

    const app = express();
    app.use(cors(buildCorsOptions()));
    app.use(express.json({limit: process.env.ZHIMENG_JSON_LIMIT || '8mb'}));
    app.use(createRateLimiter());
    const websiteDir = path.join(process.cwd(), 'website');
    app.get('/', (req, res) => res.redirect('/ops.html'));
    app.use(express.static(websiteDir));
    app.get('/payment/qr/:channel.jpg', (req, res) => {
        const filename = req.params.channel === 'alipay' ?
            'siang_alipay_qrcode.jpg' :
            'siang_wxpay_qrcode.jpg';
        return res.sendFile(path.join(process.cwd(), 'website', 'assets', filename));
    });

    const resolveAuth = async req => {
        const token = getAccessToken(req);
        if (!token || !accessTokens.has(token)) {
            return null;
        }
        const rec = accessTokens.get(token);
        if (Date.now() > rec.expiresAt) {
            accessTokens.delete(token);
            const err = new Error('Access token expired');
            err.statusCode = 401;
            throw err;
        }
        const row = await db.findUserById(rec.userId);
        if (!row) {
            const err = new Error('User not found');
            err.statusCode = 401;
            throw err;
        }
        const devices = await db.listDevices(row.id);
        return {
            user: toUserPayload(row, devices),
            userNumericId: row.id
        };
    };

    const requireAuth = async (req, res, next) => {
        try {
            const auth = await resolveAuth(req);
            if (!auth) return res.status(401).json({message: 'Unauthorized'});
            /* eslint-disable require-atomic-updates -- sequential auth attach */
            req.user = auth.user;
            req.userNumericId = auth.userNumericId;
            /* eslint-enable require-atomic-updates */
            return next();
        } catch (err) {
            if (err.statusCode) return res.status(err.statusCode).json({message: err.message});
            return sendServerError(res, err);
        }
    };

    const requireAdmin = (req, res, next) => {
        const configured = process.env.ZHIMENG_ADMIN_TOKEN;
        if (!configured) {
            return res.status(503).json({message: 'Admin operations are not configured'});
        }
        const provided = req.headers['x-zhimeng-admin-token'];
        if (!provided || !safeCompare(provided, configured)) {
            return res.status(401).json({message: 'Unauthorized'});
        }
        return next();
    };

    app.get('/health', async (req, res) => {
        try {
            await db.ping();
            return res.json({ok: true, now: nowIso(), storage: 'mysql'});
        } catch (err) {
            return res.status(503).json({ok: false, now: nowIso(), storage: 'mysql'});
        }
    });

    app.post('/auth/login', async (req, res) => {
        try {
            const {username, password} = req.body || {};
            if (!username || !password) {
                return res.status(400).json({message: 'username and password are required'});
            }
            await db.deleteExpiredRefreshTokens();
            const row = await db.findUserByUsername(username);
            if (!row || !db.bcrypt.compareSync(password, row.password_hash)) {
                return res.status(401).json({message: 'Invalid username or password'});
            }
            return res.json(await buildAuthSessionResponse(row));
        } catch (err) {
            return sendServerError(res, err);
        }
    });

    app.post('/auth/register', async (req, res) => {
        try {
            const {username, password, nickname} = req.body || {};
            const normalizedUsername = String(username || '').trim();
            const normalizedPassword = String(password || '');
            if (!normalizedUsername || !normalizedPassword) {
                return res.status(400).json({message: 'username and password are required'});
            }
            if (!USERNAME_PATTERN.test(normalizedUsername)) {
                return res.status(400).json({message: 'Invalid username format'});
            }
            if (normalizedPassword.length < 6) {
                return res.status(400).json({message: 'Password is too short'});
            }
            const existed = await db.findUserByUsername(normalizedUsername);
            if (existed) {
                return res.status(409).json({message: 'Username already exists'});
            }
            const passwordHash = db.bcrypt.hashSync(normalizedPassword, 10);
            const userId = await db.createUser({
                username: normalizedUsername,
                passwordHash,
                nickname: String(nickname || '').trim()
            });
            const row = await db.findUserById(userId);
            return res.status(201).json(await buildAuthSessionResponse(row));
        } catch (err) {
            if (err && err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({message: 'Username already exists'});
            }
            return sendServerError(res, err);
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
            return sendServerError(res, err);
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
            return sendServerError(res, err);
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
            if (err.statusCode === 403) {
                return res.status(403).json({message: err.message});
            }
            if (err.statusCode === 409) {
                return res.status(409).json({message: err.message});
            }
            return sendServerError(res, err);
        }
    });

    app.post('/entitlement/device/unbind', requireAuth, (req, res) => {
        void req;
        res.status(403).json({message: 'Device unbind requires operator support'});
    });

    app.post('/order/create', requireAuth, async (req, res) => {
        try {
            if (req.user && req.user.entitlement && req.user.entitlement.status === 'frozen') {
                return res.status(403).json({message: 'Account frozen'});
            }
            const body = req.body || {};
            const {plan, channel, return_url: returnUrl} = body;
            if (!plan || !channel) {
                return res.status(400).json({message: 'plan and channel are required'});
            }
            const amountCents = getPlanAmountCents(plan);
            if (!Number.isFinite(amountCents) || amountCents <= 0) {
                return res.status(400).json({message: `No price configured for plan: ${plan}`});
            }
            const currency = process.env.ZHIMENG_PAYMENT_CURRENCY || 'CNY';
            const paymentProofToken = issueToken('pay');
            const orderId = await db.createOrder({
                userId: req.userNumericId,
                plan,
                channel,
                returnUrl,
                amountCents,
                currency,
                paymentProofTokenHash: hashPaymentProofToken(paymentProofToken),
                business: buildOrderBusinessFromAttribution(body, plan)
            });
            const urls = buildPaymentUrls(orderId, paymentProofToken, channel, requestBaseUrl(req));
            const order = await db.findOrderById(orderId);
            return res.json({
                order_id: `o_${orderId}`,
                status: 'created',
                plan,
                channel,
                amount_cents: amountCents,
                currency,
                payment_mode: paymentMode(),
                payment_account_label: process.env.ZHIMENG_PAYMENT_ACCOUNT_LABEL || '知萌官方收款',
                payment_note: buildPaymentNote(orderId),
                payment_methods: buildPaymentMethods(orderId),
                business: order ? toOrderPayload(order).business : null,
                ...urls
            });
        } catch (err) {
            return sendServerError(res, err);
        }
    });

    app.get('/order/:id/payment-page', async (req, res) => {
        try {
            const numericId = parseOrderId(req.params.id);
            if (!numericId) {
                return res.status(400).json({message: 'Invalid order id'});
            }
            const proofToken = String(req.query.proof_token || '');
            if (!proofToken) {
                return res.status(401).json({message: 'proof_token is required'});
            }
            const order = await db.findOrderByPaymentProofToken({
                orderId: numericId,
                paymentProofTokenHash: hashPaymentProofToken(proofToken)
            });
            if (!order) {
                return res.status(404).json({message: 'Order not found'});
            }
            const urls = buildPaymentUrls(numericId, proofToken, order.channel, requestBaseUrl(req));
            return res.json({
                ...toOrderPayload(order),
                payment_mode: paymentMode(),
                payment_account_label: process.env.ZHIMENG_PAYMENT_ACCOUNT_LABEL || '知萌官方收款',
                payment_note: buildPaymentNote(numericId),
                payment_methods: buildPaymentMethods(numericId),
                qr_code_url: urls.qr_code_url
            });
        } catch (err) {
            return sendServerError(res, err);
        }
    });

    app.post('/order/:id/payment-proof', async (req, res) => {
        let attachmentMeta = null;
        try {
            const rawId = String(req.params.id || '');
            const numericId = parseOrderId(rawId);
            if (!numericId) {
                return res.status(400).json({message: 'Invalid order id'});
            }
            const {
                method,
                paid_at: paidAt,
                amount,
                currency,
                transfer_no: transferNo,
                merchant_order_no: merchantOrderNo,
                trade_no_tail: tradeNoTail,
                payer_note: payerNote,
                proof_token: proofToken,
                proof_attachment: proofAttachment
            } = req.body || {};
            const normalizedTransferNo = transferNo ? String(transferNo).replace(/\s/g, '') : '';
            const normalizedMerchantOrderNo = merchantOrderNo ?
                String(merchantOrderNo).replace(/\s/g, '') :
                '';
            const normalizedTail = tradeNoTail || (
                normalizedTransferNo ? normalizedTransferNo.slice(-10) : normalizedMerchantOrderNo.slice(-10)
            );
            if (!method || !paidAt || !normalizedTail) {
                return res.status(400).json({
                    message: 'method, paid_at and trade_no_tail, transfer_no or merchant_order_no are required'
                });
            }
            if (!/^[\w-]{4,64}$/.test(String(normalizedTail))) {
                return res.status(400).json({message: 'trade_no_tail format is invalid'});
            }
            if (normalizedTransferNo && !/^[\w-]{8,128}$/.test(normalizedTransferNo)) {
                return res.status(400).json({message: 'transfer_no format is invalid'});
            }
            if (
                normalizedMerchantOrderNo &&
                !/^[\w-]{8,128}$/.test(normalizedMerchantOrderNo)
            ) {
                return res.status(400).json({message: 'merchant_order_no format is invalid'});
            }
            const paidAtDate = new Date(paidAt);
            if (Number.isNaN(paidAtDate.getTime())) {
                return res.status(400).json({message: 'paid_at format is invalid'});
            }
            let userNumericId = null;
            if (!proofToken) {
                const auth = await resolveAuth(req);
                if (!auth) {
                    return res.status(401).json({message: 'Unauthorized'});
                }
                userNumericId = auth.userNumericId;
            }
            attachmentMeta = await storeProofAttachment({
                orderId: numericId,
                attachment: proofAttachment
            });
            const order = await db.submitOrderPaymentProof({
                orderId: numericId,
                userId: userNumericId,
                paymentProofTokenHash: proofToken ? hashPaymentProofToken(proofToken) : null,
                method,
                paidAt: paidAtDate.toISOString(),
                amountCents: yuanToCents(amount),
                currency: currency || process.env.ZHIMENG_PAYMENT_CURRENCY || 'CNY',
                transferNo: normalizedTransferNo,
                merchantOrderNo: normalizedMerchantOrderNo,
                tradeNoTail: String(normalizedTail),
                payerNote,
                attachment: attachmentMeta
            });
            return res.json(toOrderPayload(order));
        } catch (err) {
            if (attachmentMeta && attachmentMeta.storageKey) {
                await fs.promises.unlink(path.join(paymentProofStorageDir(), attachmentMeta.storageKey))
                    .catch(() => {});
            }
            if (err.statusCode) {
                return res.status(err.statusCode).json({message: err.message});
            }
            return sendServerError(res, err);
        }
    });

    app.get('/order/:id/status', requireAuth, async (req, res) => {
        try {
            const rawId = String(req.params.id || '');
            const numericId = parseOrderId(rawId);
            if (!numericId) {
                return res.status(400).json({message: 'Invalid order id'});
            }
            const order = await db.findOrderById(numericId);
            if (!order || Number(order.user_id) !== Number(req.userNumericId)) {
                return res.status(404).json({message: 'Order not found'});
            }
            return res.json({
                ...toOrderPayload(order)
            });
        } catch (err) {
            return sendServerError(res, err);
        }
    });

    app.get('/admin/orders', requireAdmin, async (req, res) => {
        try {
            const hasPaymentProof = isTruthyEnv(req.query.has_payment_proof);
            const status = req.query.status ? String(req.query.status) : null;
            const limit = req.query.limit ? Number(req.query.limit) : 50;
            const orders = await db.listOrders({
                status,
                hasPaymentProof,
                limit
            });
            return res.json({
                orders: orders.map(toOrderPayload)
            });
        } catch (err) {
            return sendServerError(res, err);
        }
    });

    app.post('/admin/order/:id/manual-confirm', requireAdmin, async (req, res) => {
        try {
            const numericId = parseOrderId(req.params.id);
            if (!numericId) {
                return res.status(400).json({message: 'Invalid order id'});
            }
            const {
                operator,
                provider_trade_no: providerTradeNo,
                amount_cents: amountCents,
                currency,
                note
            } = req.body || {};
            if (!providerTradeNo || typeof amountCents !== 'number' || !currency) {
                return res.status(400).json({
                    message: 'provider_trade_no, amount_cents and currency are required'
                });
            }
            const result = await db.fulfillOrderFromPayment({
                orderId: numericId,
                actor: operator || 'manual-admin',
                provider: 'manual',
                providerTradeNo,
                amountCents: typeof amountCents === 'number' ? amountCents : null,
                currency,
                rawPayload: {
                    note: note || '',
                    source: 'manual-confirm'
                }
            });
            return res.json({
                ok: true,
                order_id: `o_${numericId}`,
                status: result.order.status,
                idempotent: result.idempotent
            });
        } catch (err) {
            if (err.statusCode) {
                return res.status(err.statusCode).json({message: err.message});
            }
            return sendServerError(res, err);
        }
    });

    app.post('/admin/order/:id/business', requireAdmin, async (req, res) => {
        try {
            const numericId = parseOrderId(req.params.id);
            if (!numericId) {
                return res.status(400).json({message: 'Invalid order id'});
            }
            const body = req.body || {};
            const completedProjects = Array.isArray(body.completed_projects || body.completedProjects) ?
                (body.completed_projects || body.completedProjects)
                    .map(item => safeText(item, 64))
                    .filter(Boolean)
                    .slice(0, 8) :
                [];
            const business = {
                source: safeText(body.source, 64),
                packageType: safeText(body.package_type || body.packageType, 64),
                referrerCode: safeText(body.referrer_code || body.referrerCode, 64),
                referrerName: safeText(body.referrer_name || body.referrerName, 128),
                teacherId: safeText(body.teacher_id || body.teacherId, 64),
                teacherName: safeText(body.teacher_name || body.teacherName, 128),
                landingPageId: safeText(body.landing_page_id || body.landingPageId, 96),
                attributionNote: safeText(body.attribution_note || body.attributionNote, 500),
                commissionCents: safeMoneyCents(pickBodyValue(body, 'commission_cents', 'commissionCents')),
                acquisitionCents: safeMoneyCents(pickBodyValue(body, 'acquisition_cents', 'acquisitionCents')),
                deliveryCents: safeMoneyCents(pickBodyValue(body, 'delivery_cents', 'deliveryCents')),
                serviceCents: safeMoneyCents(pickBodyValue(body, 'service_cents', 'serviceCents')),
                refundRiskCents: safeMoneyCents(pickBodyValue(body, 'refund_risk_cents', 'refundRiskCents')),
                starterCompleted: safeBoolean(pickBodyValue(body, 'starter_completed', 'starterCompleted')),
                firstProjectType: safeText(body.first_project_type || body.firstProjectType, 64),
                followupStatus: safeText(body.followup_status || body.followupStatus, 64),
                bootcampDay: safeInteger(pickBodyValue(body, 'bootcamp_day', 'bootcampDay'), 0, 7),
                completedProjects,
                riskLevel: safeText(body.risk_level || body.riskLevel, 32),
                nextFollowupAt: safeText(body.next_followup_at || body.nextFollowupAt, 64),
                deliveryNote: safeText(body.delivery_note || body.deliveryNote, 800),
                note: safeText(body.note, 500)
            };
            const order = await db.updateOrderBusiness(numericId, business);
            return res.json({
                ok: true,
                order: toOrderPayload(order)
            });
        } catch (err) {
            if (err.statusCode) {
                return res.status(err.statusCode).json({message: err.message});
            }
            return sendServerError(res, err);
        }
    });

    app.get('/admin/order/:id', requireAdmin, async (req, res) => {
        try {
            const numericId = parseOrderId(req.params.id);
            if (!numericId) {
                return res.status(400).json({message: 'Invalid order id'});
            }
            const order = await db.findOrderById(numericId);
            if (!order) {
                return res.status(404).json({message: 'Order not found'});
            }
            return res.json(toOrderPayload(order));
        } catch (err) {
            return sendServerError(res, err);
        }
    });

    app.get('/admin/order/:id/payment-proof-attachment/:attachmentId', requireAdmin, async (req, res) => {
        try {
            const numericId = parseOrderId(req.params.id);
            if (!numericId) {
                return res.status(400).json({message: 'Invalid order id'});
            }
            const order = await db.findOrderById(numericId);
            if (!order) {
                return res.status(404).json({message: 'Order not found'});
            }
            const proof = parseJsonValue(order.payment_proof_json);
            const attachment = proof && proof.attachment;
            if (!attachment || attachment.id !== req.params.attachmentId || !attachment.storageKey) {
                return res.status(404).json({message: 'Payment proof attachment not found'});
            }
            const baseDir = path.resolve(paymentProofStorageDir());
            const filePath = path.resolve(baseDir, attachment.storageKey);
            if (!filePath.startsWith(`${baseDir}${path.sep}`)) {
                return res.status(404).json({message: 'Payment proof attachment not found'});
            }
            await fs.promises.access(filePath, fs.constants.R_OK);
            res.setHeader('Cache-Control', 'no-store');
            res.setHeader(
                'Content-Disposition',
                `inline; filename="${encodeURIComponent(attachment.filename || 'payment-proof')}"`
            );
            res.type(attachment.mimeType || 'application/octet-stream');
            return res.sendFile(filePath);
        } catch (err) {
            if (err.code === 'ENOENT') {
                return res.status(404).json({message: 'Payment proof attachment not found'});
            }
            return sendServerError(res, err);
        }
    });

    app.get('/admin/user/:username', requireAdmin, async (req, res) => {
        try {
            const row = await db.findUserByUsername(req.params.username);
            if (!row) {
                return res.status(404).json({message: 'User not found'});
            }
            const devices = await db.listDevices(row.id);
            const userPayload = toUserPayload(row, devices);
            const orders = await db.listOrdersByUser(row.id);
            return res.json({
                user: {
                    id: userPayload.id,
                    username: userPayload.username,
                    nickname: userPayload.nickname
                },
                permissions: userPayload.permissions,
                entitlement: userPayload.entitlement,
                orders: orders.map(toOrderPayload)
            });
        } catch (err) {
            return sendServerError(res, err);
        }
    });

    app.post('/admin/user/:username/freeze', requireAdmin, async (req, res) => {
        try {
            const row = await db.findUserByUsername(req.params.username);
            if (!row) {
                return res.status(404).json({message: 'User not found'});
            }
            const body = req.body || {};
            const updated = await db.updateEntitlementStatus({
                userId: row.id,
                status: 'frozen',
                action: 'freeze',
                operator: safeText(body.operator || 'ops', 128),
                reason: safeText(body.reason || 'manual freeze', 255),
                note: safeText(body.note, 1000)
            });
            const devices = await db.listDevices(row.id);
            return res.json({
                ok: true,
                entitlement: toUserPayload(updated, devices).entitlement
            });
        } catch (err) {
            return sendServerError(res, err);
        }
    });

    app.post('/admin/user/:username/unfreeze', requireAdmin, async (req, res) => {
        try {
            const row = await db.findUserByUsername(req.params.username);
            if (!row) {
                return res.status(404).json({message: 'User not found'});
            }
            const body = req.body || {};
            const updated = await db.updateEntitlementStatus({
                userId: row.id,
                status: 'unfreeze',
                action: 'unfreeze',
                operator: safeText(body.operator || 'ops', 128),
                reason: safeText(body.reason || 'manual unfreeze', 255),
                note: safeText(body.note, 1000)
            });
            const devices = await db.listDevices(row.id);
            return res.json({
                ok: true,
                entitlement: toUserPayload(updated, devices).entitlement
            });
        } catch (err) {
            return sendServerError(res, err);
        }
    });

    app.post('/admin/user/:username/device/unbind', requireAdmin, async (req, res) => {
        try {
            const row = await db.findUserByUsername(req.params.username);
            if (!row) {
                return res.status(404).json({message: 'User not found'});
            }
            const body = req.body || {};
            const deviceId = safeText(body.device_id || body.deviceId, 128);
            if (!deviceId) {
                return res.status(400).json({message: 'device_id is required'});
            }
            await db.unbindDeviceByAdmin({
                userId: row.id,
                deviceId,
                operator: safeText(body.operator || 'ops', 128),
                reason: safeText(body.reason || 'operator unbind', 255),
                note: safeText(body.note, 1000)
            });
            const devices = await db.listDevices(row.id);
            return res.json({
                ok: true,
                devices
            });
        } catch (err) {
            return sendServerError(res, err);
        }
    });

    if (shouldEnableMockPayment()) {
        app.post('/order/:id/mock-paid', requireAuth, async (req, res) => {
            try {
                const numericId = parseOrderId(req.params.id);
                if (!numericId) {
                    return res.status(400).json({message: 'Invalid order id'});
                }
                const order = await db.findOrderById(numericId);
                if (!order || Number(order.user_id) !== Number(req.userNumericId)) {
                    return res.status(404).json({message: 'Order not found'});
                }
                const result = await db.fulfillOrderFromPayment({
                    orderId: numericId,
                    actor: 'mock-paid',
                    provider: 'mock',
                    rawPayload: {
                        source: 'mock-paid'
                    }
                });
                return res.json({
                    ok: true,
                    order_id: `o_${numericId}`,
                    status: result.order.status,
                    idempotent: result.idempotent
                });
            } catch (err) {
                return sendServerError(res, err);
            }
        });
    }

    return app;
};

module.exports = {
    createApp,
    accessTokens,
    hashRefreshToken,
    shouldAutoInitSchema,
    shouldEnableMockPayment,
    shouldSeedDemoUser
};
