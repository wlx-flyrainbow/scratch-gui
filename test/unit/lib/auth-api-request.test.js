import {login} from '../../../src/lib/auth/api';

describe('auth api request helper', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('attaches HTTP status to thrown Error on non-OK response', async () => {
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
            expect(err.message).toBe('Unauthorized');
        }
    });
});
