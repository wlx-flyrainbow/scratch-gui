const fs = require('fs');
const path = require('path');

const failures = [];
const warnings = [];

const placeholderPattern =
    /YOUR-|example\.com|localhost|127\.0\.0\.1|replace-with|changeme|todo|<.+>/i;

const addFailure = (id, message) => {
    failures.push({id, message});
};

const addWarning = (id, message) => {
    warnings.push({id, message});
};

const value = key => String(process.env[key] || '').trim();

const isPlaceholder = raw => !raw || placeholderPattern.test(String(raw));

const isHttpsUrl = raw => {
    try {
        const parsed = new URL(raw);
        return parsed.protocol === 'https:';
    } catch (e) {
        return false;
    }
};

const checkRequiredUrl = key => {
    const raw = value(key);
    if (isPlaceholder(raw)) {
        addFailure(key, `${key} must be set to a production HTTPS URL`);
        return;
    }
    if (!isHttpsUrl(raw)) {
        addFailure(key, `${key} must use https://`);
    }
};

const checkOptionalUrl = key => {
    const raw = value(key);
    if (!raw) return;
    if (isPlaceholder(raw)) {
        addFailure(key, `${key} must not use a placeholder when set`);
        return;
    }
    if (!isHttpsUrl(raw)) {
        addFailure(key, `${key} must use https:// when set`);
    }
};

const checkRequiredSecret = key => {
    const raw = value(key);
    if (isPlaceholder(raw)) {
        addFailure(key, `${key} must be set to a high-entropy production secret`);
        return;
    }
    if (raw.length < 24) {
        addFailure(key, `${key} must be at least 24 characters`);
    }
};

const checkPositiveInteger = key => {
    const raw = value(key);
    const parsed = Number(raw);
    if (!raw || !Number.isInteger(parsed) || parsed <= 0) {
        addFailure(key, `${key} must be a positive integer`);
    }
};

const checkCorsOrigins = () => {
    const raw = value('ZHIMENG_CORS_ORIGINS');
    if (isPlaceholder(raw)) {
        addFailure(
            'ZHIMENG_CORS_ORIGINS',
            'ZHIMENG_CORS_ORIGINS must include production website/app origins'
        );
        return;
    }
    const origins = raw.split(',')
        .map(item => item.trim())
        .filter(Boolean);
    if (origins.length === 0) {
        addFailure('ZHIMENG_CORS_ORIGINS', 'ZHIMENG_CORS_ORIGINS must not be empty');
        return;
    }
    for (const origin of origins) {
        if (!isHttpsUrl(origin)) {
            addFailure('ZHIMENG_CORS_ORIGINS', `CORS origin must use https://: ${origin}`);
        }
    }
};

const checkManualQr = () => {
    const paymentMode = value('ZHIMENG_PAYMENT_MODE') || 'manual_qr';
    if (paymentMode !== 'manual_qr') {
        addWarning('ZHIMENG_PAYMENT_MODE', `non-manual payment mode is not covered by MVP checks: ${paymentMode}`);
        return;
    }

    const fallbackQr = value('ZHIMENG_PAYMENT_QR_URL');
    const wechatQr = value('ZHIMENG_WECHAT_PAYMENT_QR_URL');
    const alipayQr = value('ZHIMENG_ALIPAY_PAYMENT_QR_URL');
    const hasFallback = !isPlaceholder(fallbackQr) && isHttpsUrl(fallbackQr);
    const hasChannelQrs =
        !isPlaceholder(wechatQr) &&
        isHttpsUrl(wechatQr) &&
        !isPlaceholder(alipayQr) &&
        isHttpsUrl(alipayQr);

    if (!hasFallback && !hasChannelQrs) {
        addFailure(
            'ZHIMENG_PAYMENT_QR_URL',
            'manual_qr requires ZHIMENG_PAYMENT_QR_URL or both channel-specific HTTPS QR URLs'
        );
    }
    if (fallbackQr && !isPlaceholder(fallbackQr) && !isHttpsUrl(fallbackQr)) {
        addFailure('ZHIMENG_PAYMENT_QR_URL', 'ZHIMENG_PAYMENT_QR_URL must use https://');
    }
    if (wechatQr && !isPlaceholder(wechatQr) && !isHttpsUrl(wechatQr)) {
        addFailure('ZHIMENG_WECHAT_PAYMENT_QR_URL', 'ZHIMENG_WECHAT_PAYMENT_QR_URL must use https://');
    }
    if (alipayQr && !isPlaceholder(alipayQr) && !isHttpsUrl(alipayQr)) {
        addFailure('ZHIMENG_ALIPAY_PAYMENT_QR_URL', 'ZHIMENG_ALIPAY_PAYMENT_QR_URL must use https://');
    }

    checkPositiveInteger('ZHIMENG_PLAN_FAMILY_YEARLY_AMOUNT_CENTS');
};

const readReleases = () => {
    const releasesPath = path.resolve(__dirname, '../website/releases.json');
    try {
        return JSON.parse(fs.readFileSync(releasesPath, 'utf8'));
    } catch (err) {
        addFailure('website/releases.json', `cannot read or parse website/releases.json: ${err.message}`);
        return null;
    }
};

const checkDownloadUrl = (id, url) => {
    if (isPlaceholder(url)) {
        addFailure(id, `${id} must be set to a production download URL`);
        return;
    }
    if (!isHttpsUrl(url)) {
        addFailure(id, `${id} must use https://`);
    }
};

const checkReleases = () => {
    const releases = readReleases();
    if (!releases) return;
    if (!releases.version) {
        addFailure('website/releases.json.version', 'website/releases.json must include version');
    }
    const windows = releases.windows || {};
    checkDownloadUrl('website.releases.windows.nsis.url', windows.nsis && windows.nsis.url);
    checkDownloadUrl('website.releases.windows.portable.url', windows.portable && windows.portable.url);
    const macos = releases.macos || {};
    checkDownloadUrl(
        'website.releases.macos.appleSilicon.url',
        macos.appleSilicon && macos.appleSilicon.url
    );
    checkDownloadUrl('website.releases.macos.intel.url', macos.intel && macos.intel.url);
};

[
    'ZHIMENG_AUTH_API_BASE',
    'ZHIMENG_BILLING_URL',
    'ZHIMENG_PAYMENT_API_BASE'
].forEach(checkRequiredUrl);
checkOptionalUrl('ZHIMENG_REGISTER_URL');

checkRequiredSecret('ZHIMENG_ADMIN_TOKEN');
checkPositiveInteger('ZHIMENG_LEASE_DAYS');
const jsonLimit = value('ZHIMENG_JSON_LIMIT');
if (!jsonLimit || !/^\d+(kb|mb|b)?$/i.test(jsonLimit)) {
    addFailure('ZHIMENG_JSON_LIMIT', 'ZHIMENG_JSON_LIMIT must be set, for example 8mb');
}
checkCorsOrigins();
checkManualQr();
checkReleases();

if (warnings.length > 0) {
    // eslint-disable-next-line no-console
    console.warn('Zhimeng release check warnings:');
    for (const warning of warnings) {
        // eslint-disable-next-line no-console
        console.warn(`- ${warning.id}: ${warning.message}`);
    }
}

if (failures.length > 0) {
    // eslint-disable-next-line no-console
    console.error('Zhimeng release check failed:');
    for (const failure of failures) {
        // eslint-disable-next-line no-console
        console.error(`- ${failure.id}: ${failure.message}`);
    }
    process.exit(1);
}

// eslint-disable-next-line no-console
console.log('Zhimeng release environment looks ready.');
