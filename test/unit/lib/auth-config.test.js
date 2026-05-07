describe('auth config', () => {
    const originalLeaseDays = process.env.ZHIMENG_LEASE_DAYS;

    afterEach(() => {
        jest.resetModules();
        if (typeof originalLeaseDays === 'undefined') {
            delete process.env.ZHIMENG_LEASE_DAYS;
        } else {
            process.env.ZHIMENG_LEASE_DAYS = originalLeaseDays;
        }
    });

    const loadConfig = () => {
        // eslint-disable-next-line global-require -- 每个用例需要重新读取环境变量
        const mod = require('../../../src/lib/auth/config');
        return mod.default;
    };

    it('uses seven days when ZHIMENG_LEASE_DAYS is unset', () => {
        delete process.env.ZHIMENG_LEASE_DAYS;
        expect(loadConfig().leaseDays).toBe(7);
    });

    it('uses seven days when ZHIMENG_LEASE_DAYS is an empty string', () => {
        process.env.ZHIMENG_LEASE_DAYS = '';
        expect(loadConfig().leaseDays).toBe(7);
    });

    it('uses seven days when ZHIMENG_LEASE_DAYS is not positive', () => {
        process.env.ZHIMENG_LEASE_DAYS = '0';
        expect(loadConfig().leaseDays).toBe(7);
    });

    it('uses configured positive ZHIMENG_LEASE_DAYS value', () => {
        process.env.ZHIMENG_LEASE_DAYS = '14';
        expect(loadConfig().leaseDays).toBe(14);
    });
});
