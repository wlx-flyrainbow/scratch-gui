/**
 * Backend order flow unit tests (db mocked, no MySQL dependency).
 */
jest.mock('../../backend/db', () => {
    const state = {
        orders: new Map(),
        nextOrderId: 1
    };
    return {
        initSchema: jest.fn(() => Promise.resolve()),
        ping: jest.fn(() => Promise.resolve()),
        seedDemoUser: jest.fn(() => Promise.resolve()),
        findUserById: jest.fn(id => Promise.resolve({
            id,
            username: 'demo',
            nickname: '知萌体验账号',
            permission_student: 1,
            permission_educator: 0,
            status: 'inactive',
            plan: '',
            features_json: '[]',
            device_limit: 3,
            subscription_expires_at: null
        })),
        findUserByUsername: jest.fn(() => Promise.resolve({
            id: 1,
            username: 'demo',
            password_hash: 'mock',
            nickname: '知萌体验账号',
            permission_student: 1,
            permission_educator: 0,
            status: 'inactive',
            plan: '',
            features_json: '[]',
            device_limit: 3,
            subscription_expires_at: null
        })),
        listDevices: jest.fn(() => Promise.resolve([])),
        insertRefreshToken: jest.fn(() => Promise.resolve()),
        findRefreshToken: jest.fn(() => Promise.resolve({user_id: 1, expires_at: new Date(Date.now() + 3600000)})),
        deleteRefreshToken: jest.fn(() => Promise.resolve()),
        deleteExpiredRefreshTokens: jest.fn(() => Promise.resolve()),
        bindDevice: jest.fn(() => Promise.resolve(1)),
        unbindDevice: jest.fn(() => Promise.resolve()),
        createOrder: jest.fn(({userId, plan, channel, returnUrl}) => {
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
                provider_trade_no: null
            });
            return Promise.resolve(id);
        }),
        findOrderById: jest.fn(orderId => Promise.resolve(state.orders.get(orderId) || null)),
        listOrdersByUser: jest.fn(userId => Promise.resolve(Array.from(state.orders.values())
            .filter(order => Number(order.user_id) === Number(userId))
            .reverse())),
        markOrderPaid: jest.fn(orderId => {
            const row = state.orders.get(orderId);
            if (row) {
                row.status = 'paid';
                row.paid_at = new Date();
            }
            return Promise.resolve();
        }),
        activateEntitlementFromOrder: jest.fn(() => Promise.resolve()),
        fulfillOrderFromPayment: jest.fn(({orderId, provider, providerTradeNo}) => {
            const row = state.orders.get(orderId);
            if (!row) {
                const err = new Error('Order not found');
                err.statusCode = 404;
                return Promise.reject(err);
            }
            const idempotent = row.status === 'fulfilled';
            row.status = 'fulfilled';
            row.provider = provider || row.provider;
            row.provider_trade_no = providerTradeNo || row.provider_trade_no;
            row.paid_at = row.paid_at || new Date();
            row.fulfilled_at = row.fulfilled_at || new Date();
            return Promise.resolve({order: row, idempotent});
        }),
        bcrypt: {
            compareSync: jest.fn(() => true)
        }
    };
});

const db = require('../../backend/db');
const {inject} = require('../helpers/http-inject');
const {createApp, accessTokens} = require('../../backend/app');

describe('backend order flow (mocked db)', () => {
    let app;
    let authHeader;

    beforeAll(async () => {
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

        const status = await inject(app, {
            path: `/order/${create.body.order_id}/status`,
            method: 'GET',
            headers: authHeader
        });
        expect(status.status).toBe(200);
        expect(status.body.status).toBe('created');
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
                    provider_trade_no: 'manual-001'
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
