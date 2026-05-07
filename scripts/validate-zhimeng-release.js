const fs = require('fs');
const path = require('path');

const requiredEnv = [
    'ZHIMENG_AUTH_API_BASE',
    'ZHIMENG_BILLING_URL',
    'ZHIMENG_REGISTER_URL',
    'ZHIMENG_LEASE_DAYS'
];

const isPlaceholder = value => !value ||
    /YOUR-|example\.com|localhost|127\.0\.0\.1/i.test(String(value));

const fail = message => {
    // eslint-disable-next-line no-console
    console.error(`release check failed: ${message}`);
    process.exitCode = 1;
};

for (const key of requiredEnv) {
    if (isPlaceholder(process.env[key])) {
        fail(`${key} must be set to a production value`);
    }
}

const releasesPath = path.resolve(__dirname, '../website/releases.json');
const releases = JSON.parse(fs.readFileSync(releasesPath, 'utf8'));
const windows = releases.windows || {};
const urls = [
    windows.nsis && windows.nsis.url,
    windows.portable && windows.portable.url
].filter(Boolean);

if (urls.length === 0) {
    fail('website/releases.json must contain Windows download URLs');
}
for (const url of urls) {
    if (isPlaceholder(url)) {
        fail(`website/releases.json contains placeholder URL: ${url}`);
    }
}

if (!process.exitCode) {
    // eslint-disable-next-line no-console
    console.log('Zhimeng release environment looks ready.');
}
