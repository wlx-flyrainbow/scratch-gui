/**
 * Integration tests for backend/auth (MySQL).
 * Set ZHIMENG_MYSQL_* before running; use database zhimeng_test (see docker-compose / docs).
 */
if (!process.env.ZHIMENG_MYSQL_DATABASE) {
    process.env.ZHIMENG_MYSQL_DATABASE = 'zhimeng_test';
}
if (!process.env.ZHIMENG_MYSQL_CONNECT_TIMEOUT) {
    process.env.ZHIMENG_MYSQL_CONNECT_TIMEOUT = '3000';
}

const {inject} = require('../helpers/http-inject');
const db = require('../../backend/db');
const {createApp, accessTokens} = require('../../backend/app');

describe('backend auth API (MySQL)', () => {
    let app;

    jest.setTimeout(30000);

    beforeAll(async () => {
        app = await createApp();
    });

    beforeEach(async () => {
        accessTokens.clear();
        const pool = db.getPool();
        await pool.query('DELETE FROM orders');
        await pool.query('DELETE FROM refresh_tokens');
        await pool.query('DELETE FROM user_devices');
    });

    afterAll(async () => {
        await db.closePool();
    });

    it('GET /health returns ok and mysql storage', async () => {
        const {status, body} = await inject(app, {path: '/health', method: 'GET'});
        expect(status).toBe(200);
        expect(body.ok).toBe(true);
        expect(body.storage).toBe('mysql');
        expect(body.now).toBeDefined();
    });

    it('POST /auth/login rejects missing body', async () => {
        const {status} = await inject(app, {path: '/auth/login', method: 'POST', body: {}});
        expect(status).toBe(400);
    });

    it('POST /auth/login rejects bad password', async () => {
        const {status} = await inject(app, {
            path: '/auth/login',
            method: 'POST',
            body: {username: 'demo', password: 'wrong'}
        });
        expect(status).toBe(401);
    });

    it('POST /auth/login succeeds for demo user', async () => {
        const {status, body} = await inject(app, {
            path: '/auth/login',
            method: 'POST',
            body: {username: 'demo', password: '123456'}
        });
        expect(status).toBe(200);
        expect(body.access_token).toMatch(/^at_/);
        expect(body.refresh_token).toMatch(/^rt_/);
        expect(body.user.username).toBe('demo');
        expect(body.entitlement.status).toBe('active');
        expect(body.entitlement.lease).toBeDefined();
    });

    it('GET /entitlement requires Bearer token', async () => {
        const {status} = await inject(app, {path: '/entitlement', method: 'GET'});
        expect(status).toBe(401);
    });

    it('GET /entitlement returns data after login', async () => {
        const login = await inject(app, {
            path: '/auth/login',
            method: 'POST',
            body: {username: 'demo', password: '123456'}
        });
        expect(login.status).toBe(200);
        const token = login.body.access_token;
        const ent = await inject(app, {
            path: '/entitlement',
            method: 'GET',
            headers: {Authorization: `Bearer ${token}`}
        });
        expect(ent.status).toBe(200);
        expect(ent.body.status).toBe('active');
        expect(ent.body.lease.expiresAt).toBeDefined();
    });

    it('POST /auth/refresh returns new access_token', async () => {
        const login = await inject(app, {
            path: '/auth/login',
            method: 'POST',
            body: {username: 'demo', password: '123456'}
        });
        expect(login.status).toBe(200);
        const refresh = login.body.refresh_token;
        const res = await inject(app, {
            path: '/auth/refresh',
            method: 'POST',
            body: {refresh_token: refresh}
        });
        expect(res.status).toBe(200);
        expect(res.body.access_token).toMatch(/^at_/);
        expect(res.body.access_token).not.toBe(login.body.access_token);
    });

    it('POST /auth/logout invalidates refresh token', async () => {
        const login = await inject(app, {
            path: '/auth/login',
            method: 'POST',
            body: {username: 'demo', password: '123456'}
        });
        const refresh = login.body.refresh_token;
        const out = await inject(app, {
            path: '/auth/logout',
            method: 'POST',
            body: {refresh_token: refresh}
        });
        expect(out.status).toBe(204);
        const bad = await inject(app, {
            path: '/auth/refresh',
            method: 'POST',
            body: {refresh_token: refresh}
        });
        expect(bad.status).toBe(401);
    });

    it('POST /entitlement/device/bind increments count', async () => {
        const login = await inject(app, {
            path: '/auth/login',
            method: 'POST',
            body: {username: 'demo', password: '123456'}
        });
        const token = login.body.access_token;
        const res = await inject(app, {
            path: '/entitlement/device/bind',
            method: 'POST',
            headers: {Authorization: `Bearer ${token}`},
            body: {device_id: 'd1', device_name: 'test'}
        });
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.device_count).toBe(1);
    });

    it('POST /entitlement/device/bind returns 409 when over device limit', async () => {
        const login = await inject(app, {
            path: '/auth/login',
            method: 'POST',
            body: {username: 'demo', password: '123456'}
        });
        const token = login.body.access_token;
        const h = {Authorization: `Bearer ${token}`};
        await inject(app, {
            path: '/entitlement/device/bind',
            method: 'POST',
            headers: h,
            body: {device_id: 'a', device_name: 'a'}
        });
        await inject(app, {
            path: '/entitlement/device/bind',
            method: 'POST',
            headers: h,
            body: {device_id: 'b', device_name: 'b'}
        });
        await inject(app, {
            path: '/entitlement/device/bind',
            method: 'POST',
            headers: h,
            body: {device_id: 'c', device_name: 'c'}
        });
        const fourth = await inject(app, {
            path: '/entitlement/device/bind',
            method: 'POST',
            headers: h,
            body: {device_id: 'd', device_name: 'd'}
        });
        expect(fourth.status).toBe(409);
    });

    it('order payment flow updates entitlement', async () => {
        const login = await inject(app, {
            path: '/auth/login',
            method: 'POST',
            body: {username: 'demo', password: '123456'}
        });
        const token = login.body.access_token;
        const h = {Authorization: `Bearer ${token}`};

        const create = await inject(app, {
            path: '/order/create',
            method: 'POST',
            headers: h,
            body: {plan: 'family_yearly', channel: 'wechat', return_url: 'https://billing.example.com/result'}
        });
        expect(create.status).toBe(200);
        expect(create.body.order_id).toMatch(/^o_/);

        const statusBefore = await inject(app, {
            path: `/order/${create.body.order_id}/status`,
            method: 'GET',
            headers: h
        });
        expect(statusBefore.status).toBe(200);
        expect(statusBefore.body.status).toBe('created');

        const mockPaid = await inject(app, {
            path: `/order/${create.body.order_id}/mock-paid`,
            method: 'POST',
            headers: h
        });
        expect(mockPaid.status).toBe(200);
        expect(mockPaid.body.status).toBe('paid');

        const statusAfter = await inject(app, {
            path: `/order/${create.body.order_id}/status`,
            method: 'GET',
            headers: h
        });
        expect(statusAfter.status).toBe(200);
        expect(statusAfter.body.status).toBe('paid');
    });
});
