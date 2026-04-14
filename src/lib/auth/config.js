const asNumber = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const authConfig = {
    apiBaseUrl: process.env.ZHIMENG_AUTH_API_BASE || 'http://localhost:3001',
    billingUrl: process.env.ZHIMENG_BILLING_URL || 'https://billing.zhimeng.example.com',
    registerUrl: process.env.ZHIMENG_REGISTER_URL || 'https://accounts.zhimeng.example.com/register',
    leaseDays: asNumber(process.env.ZHIMENG_LEASE_DAYS, 7),
    /** Backpack API root (no trailing slash); optional — URL ?backpack_host= still works in playground */
    backpackHost: (process.env.ZHIMENG_BACKPACK_HOST || '').trim(),
    appVersion: process.env.npm_package_version || 'dev'
};

export default authConfig;
