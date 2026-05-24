/**
 * Backend order flow unit tests (db mocked, no MySQL dependency).
 */
jest.mock('../../backend/db', () => {
    const state = {
        orders: new Map(),
        users: new Map(),
        nextUserId: 2,
        nextOrderId: 1,
        entitlement: {
            status: 'inactive',
            plan: '',
            features_json: '[]',
            device_limit: 3,
            subscription_expires_at: null
        }
    };
    const userRow = (user = {}) => ({
        id: user.id || 1,
        username: user.username || 'demo',
        password_hash: user.password_hash || 'mock',
        nickname: user.nickname || '知萌体验账号',
        permission_student: 1,
        permission_educator: 0,
        ...(user.entitlement || state.entitlement)
    });
    return {
        initSchema: jest.fn(() => Promise.resolve()),
        ping: jest.fn(() => Promise.resolve()),
        seedDemoUser: jest.fn(() => Promise.resolve()),
        createUser: jest.fn(({username, passwordHash, nickname}) => {
            if (username === 'demo' || state.users.has(username)) {
                const err = new Error('Username already exists');
                err.code = 'ER_DUP_ENTRY';
                return Promise.reject(err);
            }
            const id = state.nextUserId++;
            state.users.set(username, {
                id,
                username,
                password_hash: passwordHash,
                nickname,
                entitlement: {
                    status: 'inactive',
                    plan: '',
                    features_json: '[]',
                    device_limit: 3,
                    subscription_expires_at: null
                }
            });
            return Promise.resolve(id);
        }),
        findUserById: jest.fn(id => {
            const registered = Array.from(state.users.values()).find(user => Number(user.id) === Number(id));
            return Promise.resolve(registered ? userRow(registered) : {...userRow(), id});
        }),
        findUserByUsername: jest.fn(username => {
            if (username === 'demo') return Promise.resolve(userRow());
            const registered = state.users.get(username);
            return Promise.resolve(registered ? userRow(registered) : null);
        }),
        listDevices: jest.fn(() => Promise.resolve([])),
        insertRefreshToken: jest.fn(() => Promise.resolve()),
        findRefreshToken: jest.fn(() => Promise.resolve({user_id: 1, expires_at: new Date(Date.now() + 3600000)})),
        deleteRefreshToken: jest.fn(() => Promise.resolve()),
        deleteExpiredRefreshTokens: jest.fn(() => Promise.resolve()),
        bindDevice: jest.fn(() => Promise.resolve(1)),
        unbindDevice: jest.fn(() => Promise.resolve()),
        createOrder: jest.fn(({
            userId,
            plan,
            channel,
            returnUrl,
            amountCents,
            currency,
            paymentProofTokenHash
        }) => {
            const id = state.nextOrderId++;
            state.orders.set(id, {
                id,
                user_id: userId,
                plan,
                channel,
                return_url: returnUrl || null,
                status: 'created',
                paid_at: null,
                fulfilled_at: null,
                provider: channel,
                provider_trade_no: null,
                amount_cents: typeof amountCents === 'number' ? amountCents : null,
                currency: currency || null,
                payment_proof_json: null,
                payment_proof_token_hash: paymentProofTokenHash || null
            });
            return Promise.resolve(id);
        }),
        findOrderById: jest.fn(orderId => Promise.resolve(state.orders.get(orderId) || null)),
        findOrderByPaymentProofToken: jest.fn(({orderId, paymentProofTokenHash}) => {
            const row = state.orders.get(orderId);
            if (!row || row.payment_proof_token_hash !== paymentProofTokenHash) {
                return Promise.resolve(null);
            }
            return Promise.resolve(row);
        }),
        listOrdersByUser: jest.fn(userId => Promise.resolve(Array.from(state.orders.values())
            .filter(order => Number(order.user_id) === Number(userId))
            .reverse())),
        listOrders: jest.fn(({status, hasPaymentProof, limit} = {}) => Promise.resolve(Array.from(state.orders.values())
            .filter(order => !status || order.status === status)
            .filter(order => !hasPaymentProof || order.payment_proof_json)
            .map(order => ({
                ...order,
                username: 'demo',
                nickname: '知萌体验账号'
            }))
            .reverse()
            .slice(0, Math.max(1, Math.min(Number(limit) || 50, 200))))),
        markOrderPaid: jest.fn(orderId => {
            const row = state.orders.get(orderId);
            if (row) {
                row.status = 'paid';
                row.paid_at = new Date();
            }
            return Promise.resolve();
        }),
        activateEntitlementFromOrder: jest.fn((userId, plan) => {
            state.entitlement = {
                status: 'active',
                plan: plan || 'family_yearly',
                features_json: JSON.stringify(['cloud_save', 'share', 'community', 'backpack']),
                device_limit: 3,
                subscription_expires_at: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000))
            };
            return Promise.resolve();
        }),
        submitOrderPaymentProof: jest.fn(({
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
            const row = state.orders.get(orderId);
            const tokenMatches = paymentProofTokenHash &&
                row &&
                row.payment_proof_token_hash === paymentProofTokenHash;
            const userMatches = userId && row && Number(row.user_id) === Number(userId);
            if (!row || (!tokenMatches && !userMatches)) {
                const err = new Error('Order not found');
                err.statusCode = 404;
                return Promise.reject(err);
            }
            if (row.status !== 'created') {
                const err = new Error('Payment proof can only be submitted for created orders');
                err.statusCode = 409;
                return Promise.reject(err);
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
            return Promise.resolve(row);
        }),
        fulfillOrderFromPayment: jest.fn(({orderId, provider, providerTradeNo, amountCents, currency}) => {
            const row = state.orders.get(orderId);
            if (!row) {
                const err = new Error('Order not found');
                err.statusCode = 404;
                return Promise.reject(err);
            }
            if (
                providerTradeNo &&
                Array.from(state.orders.values()).some(order =>
                    order.id !== orderId &&
                    order.provider === (provider || row.provider) &&
                    order.provider_trade_no === providerTradeNo)
            ) {
                const err = new Error('Provider trade number already used');
                err.statusCode = 409;
                return Promise.reject(err);
            }
            if (
                typeof amountCents === 'number' &&
                typeof row.amount_cents === 'number' &&
                amountCents !== row.amount_cents
            ) {
                const err = new Error('Payment amount does not match order amount');
                err.statusCode = 409;
                return Promise.reject(err);
            }
            if (currency && row.currency && currency !== row.currency) {
                const err = new Error('Payment currency does not match order currency');
                err.statusCode = 409;
                return Promise.reject(err);
            }
            const idempotent = row.status === 'fulfilled';
            row.status = 'fulfilled';
            row.provider = provider || row.provider;
            row.provider_trade_no = providerTradeNo || row.provider_trade_no;
            row.paid_at = row.paid_at || new Date();
            row.fulfilled_at = row.fulfilled_at || new Date();
            state.entitlement = {
                status: 'active',
                plan: row.plan || 'family_yearly',
                features_json: JSON.stringify(['cloud_save', 'share', 'community', 'backpack']),
                device_limit: 3,
                subscription_expires_at: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000))
            };
            return Promise.resolve({order: row, idempotent});
        }),
        bcrypt: {
            compareSync: jest.fn(() => true),
            hashSync: jest.fn(password => `hashed:${password}`)
        }
    };
});

const db = require('../../backend/db');
const {URL} = require('url');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {inject} = require('../helpers/http-inject');
const {createApp, accessTokens} = require('../../backend/app');

describe('backend order flow (mocked db)', () => {
    let app;
    let authHeader;
    let proofDir;

    beforeAll(async () => {
        proofDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zhimeng-proof-'));
        process.env.ZHIMENG_PAYMENT_PROOF_STORAGE_DIR = proofDir;
        app = await createApp();
        const login = await inject(app, {
            path: '/auth/login',
            method: 'POST',
            body: {username: 'demo', password: '123456'}
        });
        authHeader = {Authorization: `Bearer ${login.body.access_token}`};
    });

    afterAll(() => {
        accessTokens.clear();
        if (proofDir) {
            fs.rmSync(proofDir, {recursive: true, force: true});
        }
        delete process.env.ZHIMENG_PAYMENT_PROOF_STORAGE_DIR;
    });

    it('registers a new inactive account and returns login tokens', async () => {
        const res = await inject(app, {
            path: '/auth/register',
            method: 'POST',
            body: {
                username: 'new_user',
                password: '123456',
                nickname: '新用户'
            }
        });
        expect(res.status).toBe(201);
        expect(res.body.access_token).toMatch(/^at_/);
        expect(res.body.refresh_token).toMatch(/^rt_/);
        expect(res.body.user.username).toBe('new_user');
        expect(res.body.entitlement.status).toBe('inactive');
    });

    it('rejects duplicate registration username', async () => {
        const res = await inject(app, {
            path: '/auth/register',
            method: 'POST',
            body: {
                username: 'demo',
                password: '123456'
            }
        });
        expect(res.status).toBe(409);
    });

    it('creates order and returns created status', async () => {
        const create = await inject(app, {
            path: '/order/create',
            method: 'POST',
            headers: authHeader,
            body: {plan: 'family_yearly', channel: 'wechat', return_url: 'https://billing.example.com/result'}
        });
        expect(create.status).toBe(200);
        expect(create.body.order_id).toMatch(/^o_/);
        expect(create.body.payment_mode).toBe('manual_qr');
        expect(create.body.amount_cents).toBe(19900);
        expect(create.body.currency).toBe('CNY');
        expect(create.body.payment_note).toContain(create.body.order_id);
        expect(create.body.pay_url).toContain('pay.html');
        expect(create.body.pay_url).toContain('proof_token=');

        const status = await inject(app, {
            path: `/order/${create.body.order_id}/status`,
            method: 'GET',
            headers: authHeader
        });
        expect(status.status).toBe(200);
        expect(status.body.status).toBe('created');
    });

    it('returns public payment page data with order proof token', async () => {
        const create = await inject(app, {
            path: '/order/create',
            method: 'POST',
            headers: authHeader,
            body: {plan: 'family_yearly', channel: 'wechat'}
        });
        const url = new URL(create.body.pay_url);
        const proofToken = url.searchParams.get('proof_token');
        const page = await inject(app, {
            path: `/order/${create.body.order_id}/payment-page?proof_token=${proofToken}`,
            method: 'GET'
        });
        expect(page.status).toBe(200);
        expect(page.body.order_id).toBe(create.body.order_id);
        expect(page.body.qr_code_url).toBe(create.body.qr_code_url);
    });

    it('accepts payment proof from payment page token without auth header', async () => {
        const create = await inject(app, {
            path: '/order/create',
            method: 'POST',
            headers: authHeader,
            body: {plan: 'family_yearly', channel: 'wechat'}
        });
        const url = new URL(create.body.pay_url);
        const proof = await inject(app, {
            path: `/order/${create.body.order_id}/payment-proof`,
            method: 'POST',
            body: {
                proof_token: url.searchParams.get('proof_token'),
                method: 'wechat',
                paid_at: '2026-05-23T10:00:00.000Z',
                amount: '199.00',
                transfer_no: '10001073012026022000408766083107',
                payer_note: '网页提交'
            }
        });
        expect(proof.status).toBe(200);
        expect(proof.body.status).toBe('created');
        expect(proof.body.payment_proof.amountCents).toBe(19900);
        expect(proof.body.payment_proof.transferNo).toBe('10001073012026022000408766083107');
        expect(proof.body.payment_proof.tradeNoTail).toBe('8766083107');
    });

    it('stores Alipay platform and merchant order numbers in payment proof', async () => {
        const create = await inject(app, {
            path: '/order/create',
            method: 'POST',
            headers: authHeader,
            body: {plan: 'family_yearly', channel: 'alipay'}
        });
        const url = new URL(create.body.pay_url);
        const proof = await inject(app, {
            path: `/order/${create.body.order_id}/payment-proof`,
            method: 'POST',
            body: {
                proof_token: url.searchParams.get('proof_token'),
                method: 'alipay',
                paid_at: '2026-04-25T15:35:51.000Z',
                amount: '199.00',
                transfer_no: '2026042522001495731403194971',
                merchant_order_no: '17771025413602210395734',
                payer_note: '支付宝账单详情'
            }
        });
        expect(proof.status).toBe(200);
        expect(proof.body.payment_proof.method).toBe('alipay');
        expect(proof.body.payment_proof.transferNo).toBe('2026042522001495731403194971');
        expect(proof.body.payment_proof.merchantOrderNo).toBe('17771025413602210395734');
        expect(proof.body.payment_proof.tradeNoTail).toBe('1403194971');
    });

    it('stores optional payment proof attachment and serves it through admin endpoint', async () => {
        const originalAdminToken = process.env.ZHIMENG_ADMIN_TOKEN;
        process.env.ZHIMENG_ADMIN_TOKEN = 'test-admin-token';
        try {
            const create = await inject(app, {
                path: '/order/create',
                method: 'POST',
                headers: authHeader,
                body: {plan: 'family_yearly', channel: 'alipay'}
            });
            const url = new URL(create.body.pay_url);
            const proof = await inject(app, {
                path: `/order/${create.body.order_id}/payment-proof`,
                method: 'POST',
                body: {
                    proof_token: url.searchParams.get('proof_token'),
                    method: 'alipay',
                    paid_at: '2026-04-25T15:35:51.000Z',
                    amount: '199.00',
                    transfer_no: '2026042522001495731403194971',
                    merchant_order_no: '17771025413602210395734',
                    proof_attachment: {
                        filename: 'alipay-proof.png',
                        mime_type: 'image/png',
                        data_url: `data:image/png;base64,${Buffer.from('fake-image').toString('base64')}`
                    }
                }
            });
            expect(proof.status).toBe(200);
            expect(proof.body.payment_proof.attachment.id).toBeTruthy();
            expect(proof.body.payment_proof.attachment.filename).toBe('alipay-proof.png');
            expect(proof.body.payment_proof.attachment.mimeType).toBe('image/png');
            expect(fs.readdirSync(proofDir).length).toBeGreaterThan(0);

            const attachment = await inject(app, {
                path: `/admin/order/${create.body.order_id}/payment-proof-attachment/` +
                    proof.body.payment_proof.attachment.id,
                method: 'GET',
                headers: {'X-Zhimeng-Admin-Token': 'test-admin-token'}
            });
            expect(attachment.status).toBe(200);
            expect(attachment.body).toBe('fake-image');
        } finally {
            if (typeof originalAdminToken === 'undefined') {
                delete process.env.ZHIMENG_ADMIN_TOKEN;
            } else {
                process.env.ZHIMENG_ADMIN_TOKEN = originalAdminToken;
            }
        }
    });

    it('accepts payment proof without marking order paid', async () => {
        const create = await inject(app, {
            path: '/order/create',
            method: 'POST',
            headers: authHeader,
            body: {plan: 'family_yearly', channel: 'wechat'}
        });
        const proof = await inject(app, {
            path: `/order/${create.body.order_id}/payment-proof`,
            method: 'POST',
            headers: authHeader,
            body: {
                method: 'wechat',
                paid_at: '2026-05-23T10:00:00.000Z',
                amount: '199.00',
                transfer_no: '10001073012026022000408766083107',
                trade_no_tail: '123456',
                payer_note: '已付款'
            }
        });
        expect(proof.status).toBe(200);
        expect(proof.body.status).toBe('created');
        expect(proof.body.payment_proof.method).toBe('wechat');
        expect(proof.body.payment_proof.amountCents).toBe(19900);

        const status = await inject(app, {
            path: `/order/${create.body.order_id}/status`,
            method: 'GET',
            headers: authHeader
        });
        expect(status.body.status).toBe('created');
    });

    it('lists orders with submitted payment proof for admins', async () => {
        const originalAdminToken = process.env.ZHIMENG_ADMIN_TOKEN;
        process.env.ZHIMENG_ADMIN_TOKEN = 'test-admin-token';
        try {
            const create = await inject(app, {
                path: '/order/create',
                method: 'POST',
                headers: authHeader,
                body: {plan: 'family_yearly', channel: 'wechat'}
            });
            await inject(app, {
                path: `/order/${create.body.order_id}/payment-proof`,
                method: 'POST',
                headers: authHeader,
                body: {
                    method: 'wechat',
                    paid_at: '2026-05-23T10:00:00.000Z',
                    amount: '199.00',
                    transfer_no: '10001073012026022000408766083107',
                    trade_no_tail: 'prooflist',
                    payer_note: '已付款'
                }
            });
            const list = await inject(app, {
                path: '/admin/orders?has_payment_proof=1&status=created',
                method: 'GET',
                headers: {'X-Zhimeng-Admin-Token': 'test-admin-token'}
            });
            expect(list.status).toBe(200);
            expect(list.body.orders.some(order => order.order_id === create.body.order_id)).toBe(true);
            expect(list.body.orders[0].username).toBe('demo');
        } finally {
            if (typeof originalAdminToken === 'undefined') {
                delete process.env.ZHIMENG_ADMIN_TOKEN;
            } else {
                process.env.ZHIMENG_ADMIN_TOKEN = originalAdminToken;
            }
        }
    });

    it('marks order paid via mock callback endpoint', async () => {
        const create = await inject(app, {
            path: '/order/create',
            method: 'POST',
            headers: authHeader,
            body: {plan: 'family_yearly', channel: 'alipay'}
        });
        const orderId = create.body.order_id;

        const paid = await inject(app, {
            path: `/order/${orderId}/mock-paid`,
            method: 'POST',
            headers: authHeader
        });
        expect(paid.status).toBe(200);
        expect(paid.body.status).toBe('fulfilled');

        const status = await inject(app, {
            path: `/order/${orderId}/status`,
            method: 'GET',
            headers: authHeader
        });
        expect(status.status).toBe(200);
        expect(status.body.status).toBe('fulfilled');
    });

    it('confirms order through protected manual provider endpoint', async () => {
        const originalAdminToken = process.env.ZHIMENG_ADMIN_TOKEN;
        process.env.ZHIMENG_ADMIN_TOKEN = 'test-admin-token';
        try {
            const create = await inject(app, {
                path: '/order/create',
                method: 'POST',
                headers: authHeader,
                body: {plan: 'family_yearly', channel: 'manual'}
            });
            const confirmed = await inject(app, {
                path: `/admin/order/${create.body.order_id}/manual-confirm`,
                method: 'POST',
                headers: {'X-Zhimeng-Admin-Token': 'test-admin-token'},
                body: {
                    operator: 'qa',
                    provider_trade_no: 'manual-001',
                    amount_cents: 19900,
                    currency: 'CNY',
                    note: 'paid offline'
                }
            });
            expect(confirmed.status).toBe(200);
            expect(confirmed.body.status).toBe('fulfilled');

            const confirmedAgain = await inject(app, {
                path: `/admin/order/${create.body.order_id}/manual-confirm`,
                method: 'POST',
                headers: {'X-Zhimeng-Admin-Token': 'test-admin-token'},
                body: {
                    operator: 'qa',
                    provider_trade_no: 'manual-001',
                    amount_cents: 19900,
                    currency: 'CNY'
                }
            });
            expect(confirmedAgain.status).toBe(200);
            expect(confirmedAgain.body.idempotent).toBe(true);

            const orderDetail = await inject(app, {
                path: `/admin/order/${create.body.order_id}`,
                method: 'GET',
                headers: {'X-Zhimeng-Admin-Token': 'test-admin-token'}
            });
            expect(orderDetail.status).toBe(200);
            expect(orderDetail.body.status).toBe('fulfilled');

            const userDetail = await inject(app, {
                path: '/admin/user/demo',
                method: 'GET',
                headers: {'X-Zhimeng-Admin-Token': 'test-admin-token'}
            });
            expect(userDetail.status).toBe(200);
            expect(userDetail.body.user.username).toBe('demo');
            expect(userDetail.body.entitlement.status).toBe('active');
            expect(userDetail.body.entitlement.plan).toBe('family_yearly');
            expect(userDetail.body.entitlement.features).toContain('cloud_save');
            expect(userDetail.body.orders.length).toBeGreaterThan(0);
        } finally {
            /* eslint-disable require-atomic-updates -- 测试需要恢复进程环境变量 */
            if (typeof originalAdminToken === 'undefined') {
                delete process.env.ZHIMENG_ADMIN_TOKEN;
            } else {
                process.env.ZHIMENG_ADMIN_TOKEN = originalAdminToken;
            }
            /* eslint-enable require-atomic-updates */
        }
    });

    it('rejects manual confirmation with mismatched amount', async () => {
        const originalAdminToken = process.env.ZHIMENG_ADMIN_TOKEN;
        process.env.ZHIMENG_ADMIN_TOKEN = 'test-admin-token';
        try {
            const create = await inject(app, {
                path: '/order/create',
                method: 'POST',
                headers: authHeader,
                body: {plan: 'family_yearly', channel: 'manual'}
            });
            const confirmed = await inject(app, {
                path: `/admin/order/${create.body.order_id}/manual-confirm`,
                method: 'POST',
                headers: {'X-Zhimeng-Admin-Token': 'test-admin-token'},
                body: {
                    operator: 'qa',
                    provider_trade_no: 'manual-amount-mismatch',
                    amount_cents: 1,
                    currency: 'CNY'
                }
            });
            expect(confirmed.status).toBe(409);
        } finally {
            if (typeof originalAdminToken === 'undefined') {
                delete process.env.ZHIMENG_ADMIN_TOKEN;
            } else {
                process.env.ZHIMENG_ADMIN_TOKEN = originalAdminToken;
            }
        }
    });

    it('rejects duplicate provider trade number on another order', async () => {
        const originalAdminToken = process.env.ZHIMENG_ADMIN_TOKEN;
        process.env.ZHIMENG_ADMIN_TOKEN = 'test-admin-token';
        try {
            const first = await inject(app, {
                path: '/order/create',
                method: 'POST',
                headers: authHeader,
                body: {plan: 'family_yearly', channel: 'manual'}
            });
            const second = await inject(app, {
                path: '/order/create',
                method: 'POST',
                headers: authHeader,
                body: {plan: 'family_yearly', channel: 'manual'}
            });
            const body = {
                operator: 'qa',
                provider_trade_no: 'manual-duplicate',
                amount_cents: 19900,
                currency: 'CNY'
            };
            const firstConfirm = await inject(app, {
                path: `/admin/order/${first.body.order_id}/manual-confirm`,
                method: 'POST',
                headers: {'X-Zhimeng-Admin-Token': 'test-admin-token'},
                body
            });
            expect(firstConfirm.status).toBe(200);

            const secondConfirm = await inject(app, {
                path: `/admin/order/${second.body.order_id}/manual-confirm`,
                method: 'POST',
                headers: {'X-Zhimeng-Admin-Token': 'test-admin-token'},
                body
            });
            expect(secondConfirm.status).toBe(409);
        } finally {
            if (typeof originalAdminToken === 'undefined') {
                delete process.env.ZHIMENG_ADMIN_TOKEN;
            } else {
                process.env.ZHIMENG_ADMIN_TOKEN = originalAdminToken;
            }
        }
    });

    it('rejects manual provider endpoint without admin token', async () => {
        const originalAdminToken = process.env.ZHIMENG_ADMIN_TOKEN;
        process.env.ZHIMENG_ADMIN_TOKEN = 'test-admin-token';
        try {
            const res = await inject(app, {
                path: '/admin/order/o_1/manual-confirm',
                method: 'POST',
                headers: {'X-Zhimeng-Admin-Token': 'wrong-token'}
            });
            expect(res.status).toBe(401);
        } finally {
            /* eslint-disable require-atomic-updates -- 测试需要恢复进程环境变量 */
            if (typeof originalAdminToken === 'undefined') {
                delete process.env.ZHIMENG_ADMIN_TOKEN;
            } else {
                process.env.ZHIMENG_ADMIN_TOKEN = originalAdminToken;
            }
            /* eslint-enable require-atomic-updates */
        }
    });

    it('does not expose mock payment endpoint in production by default', async () => {
        const originalNodeEnv = process.env.NODE_ENV;
        const originalMockPayment = process.env.ZHIMENG_ENABLE_MOCK_PAYMENT;
        process.env.NODE_ENV = 'production';
        delete process.env.ZHIMENG_ENABLE_MOCK_PAYMENT;
        try {
            const prodApp = await createApp();
            const login = await inject(prodApp, {
                path: '/auth/login',
                method: 'POST',
                body: {username: 'demo', password: '123456'}
            });
            const h = {Authorization: `Bearer ${login.body.access_token}`};
            const create = await inject(prodApp, {
                path: '/order/create',
                method: 'POST',
                headers: h,
                body: {plan: 'family_yearly', channel: 'wechat'}
            });
            const paid = await inject(prodApp, {
                path: `/order/${create.body.order_id}/mock-paid`,
                method: 'POST',
                headers: h
            });
            expect(paid.status).toBe(404);
        } finally {
            /* eslint-disable require-atomic-updates -- 测试需要恢复进程环境变量 */
            if (typeof originalNodeEnv === 'undefined') {
                delete process.env.NODE_ENV;
            } else {
                process.env.NODE_ENV = originalNodeEnv;
            }
            if (typeof originalMockPayment === 'undefined') {
                delete process.env.ZHIMENG_ENABLE_MOCK_PAYMENT;
            } else {
                process.env.ZHIMENG_ENABLE_MOCK_PAYMENT = originalMockPayment;
            }
            /* eslint-enable require-atomic-updates */
        }
    });

    it('does not seed demo user in production unless explicitly enabled', async () => {
        const originalNodeEnv = process.env.NODE_ENV;
        const originalSeed = process.env.ZHIMENG_SEED_DEMO_USER;
        process.env.NODE_ENV = 'production';
        delete process.env.ZHIMENG_SEED_DEMO_USER;
        db.seedDemoUser.mockClear();
        try {
            await createApp();
            expect(db.seedDemoUser).not.toHaveBeenCalled();
        } finally {
            /* eslint-disable require-atomic-updates -- 测试需要恢复进程环境变量 */
            if (typeof originalNodeEnv === 'undefined') {
                delete process.env.NODE_ENV;
            } else {
                process.env.NODE_ENV = originalNodeEnv;
            }
            if (typeof originalSeed === 'undefined') {
                delete process.env.ZHIMENG_SEED_DEMO_USER;
            } else {
                process.env.ZHIMENG_SEED_DEMO_USER = originalSeed;
            }
            /* eslint-enable require-atomic-updates */
        }
    });
});
