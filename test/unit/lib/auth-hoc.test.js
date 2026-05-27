import {resolveAuthCapabilities} from '../../../src/lib/auth-hoc.jsx';

describe('auth HOC capability resolution', () => {
    const activeEntitlement = {
        status: 'active',
        features: ['cloud_save', 'share', 'community', 'backpack'],
        lease: {
            expiresAt: '2999-01-01T00:00:00.000Z'
        }
    };
    const user = {username: 'dingdang'};

    it('does not enable project save/create without a configured project host', () => {
        const capabilities = resolveAuthCapabilities({
            cloudHost: 'wss.example.com',
            entitlement: activeEntitlement,
            projectHost: '',
            user
        });

        expect(capabilities.cloudSaveEnabled).toBe(false);
        expect(capabilities.cloudDataEnabled).toBe(true);
    });

    it('enables project save/create when entitlement and project host are both available', () => {
        const capabilities = resolveAuthCapabilities({
            cloudHost: 'wss.example.com',
            entitlement: activeEntitlement,
            projectHost: 'https://projects.zhimeng.example.com',
            user
        });

        expect(capabilities.cloudSaveEnabled).toBe(true);
    });

    it('does not unlock capabilities for expired, frozen, or device-limit states', () => {
        ['expired', 'frozen', 'deviceLimit', 'inactive'].forEach(status => {
            const capabilities = resolveAuthCapabilities({
                cloudHost: 'wss.example.com',
                entitlement: {
                    ...activeEntitlement,
                    status
                },
                projectHost: 'https://projects.zhimeng.example.com',
                user
            });
            expect(capabilities.active).toBe(false);
            expect(capabilities.cloudSaveEnabled).toBe(false);
            expect(capabilities.cloudDataEnabled).toBe(false);
        });
    });
});
