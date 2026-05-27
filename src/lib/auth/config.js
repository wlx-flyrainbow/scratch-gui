const asNumber = (value, fallback) => {
    if (value === null || typeof value === 'undefined' || value === '') {
        return fallback;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const authConfig = {
    apiBaseUrl: process.env.ZHIMENG_AUTH_API_BASE || 'http://localhost:3001',
    billingUrl: (process.env.ZHIMENG_BILLING_URL || '').trim(),
    registerUrl: (process.env.ZHIMENG_REGISTER_URL || '').trim(),
    leaseDays: asNumber(process.env.ZHIMENG_LEASE_DAYS, 7),
    cloudHost: (process.env.ZHIMENG_CLOUD_HOST || '').trim(),
    projectHost: (process.env.ZHIMENG_PROJECT_HOST || '').trim(),
    /** Backpack API root (no trailing slash); optional — URL ?backpack_host= still works in playground */
    backpackHost: (process.env.ZHIMENG_BACKPACK_HOST || '').trim(),
    appVersion: process.env.npm_package_version || 'dev'
};

export default authConfig;
