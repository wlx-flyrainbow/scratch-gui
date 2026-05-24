import {bindDevice, login, refresh, register} from '../../../src/lib/auth/api';

describe('auth api request helper', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('shows friendly login copy and keeps HTTP status on invalid credentials', async () => {
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 401,
            text: () => Promise.resolve(JSON.stringify({message: 'Unauthorized'}))
        }));

        try {
            await login({username: 'u', password: 'p'});
            throw new Error('expected login to throw');
        } catch (err) {
            expect(err.status).toBe(401);
            expect(err.serverMessage).toBe('Unauthorized');
            expect(err.message).toBe('账号或密码不正确，请检查后重试。');
        }
    });

    it('shows friendly refresh copy for expired sessions', async () => {
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 401,
            text: () => Promise.resolve(JSON.stringify({message: 'Refresh token expired'}))
        }));

        try {
            await refresh('expired');
            throw new Error('expected refresh to throw');
        } catch (err) {
            expect(err.status).toBe(401);
            expect(err.message).toBe('授权已过期，请重新登录知萌账号。');
        }
    });

    it('shows friendly register copy for duplicate username', async () => {
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 409,
            text: () => Promise.resolve(JSON.stringify({message: 'Username already exists'}))
        }));

        try {
            await register({username: 'u', password: '123456'});
            throw new Error('expected register to throw');
        } catch (err) {
            expect(err.status).toBe(409);
            expect(err.message).toBe('该账号已被注册，请换一个账号。');
        }
    });

    it('shows friendly device limit copy', async () => {
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 409,
            text: () => Promise.resolve(JSON.stringify({message: 'Device limit exceeded'}))
        }));

        try {
            await bindDevice('token', {
                device_id: 'device-4',
                device_name: 'Mac'
            });
            throw new Error('expected bindDevice to throw');
        } catch (err) {
            expect(err.status).toBe(409);
            expect(err.message).toBe('当前账号已达到设备上限，请联系运营解绑旧设备后再登录。');
        }
    });

    it('shows friendly network copy when fetch fails before a response', async () => {
        global.fetch = jest.fn(() => Promise.reject(new TypeError('Failed to fetch')));

        try {
            await login({username: 'u', password: 'p'});
            throw new Error('expected login to throw');
        } catch (err) {
            expect(err.status).toBe(0);
            expect(err.message).toBe('网络连接失败，请检查网络后重试。');
        }
    });
});
