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
                paid_at: null
            });
            return Promise.resolve(id);
        }),
        findOrderById: jest.fn(orderId => Promise.resolve(state.orders.get(orderId) || null)),
        markOrderPaid: jest.fn(orderId => {
            const row = state.orders.get(orderId);
            if (row) {
                row.status = 'paid';
                row.paid_at = new Date();
            }
            return Promise.resolve();
        }),
        activateEntitlementFromOrder: jest.fn(() => Promise.resolve()),
        bcrypt: {
            compareSync: jest.fn(() => true)
        }
    };
});

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
        expect(paid.body.status).toBe('paid');

        const status = await inject(app, {
            path: `/order/${orderId}/status`,
            method: 'GET',
            headers: authHeader
        });
        expect(status.status).toBe(200);
        expect(status.body.status).toBe('paid');
    });
});
