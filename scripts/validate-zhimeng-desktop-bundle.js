const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const buildDir = path.join(root, 'build');
const failures = [];

const expectedAuthBase = process.env.ZHIMENG_EXPECT_AUTH_API_BASE || '';
const expectedBillingUrl = process.env.ZHIMENG_EXPECT_BILLING_URL || '';
const forbidden = [
    'billing.zhimeng.example.com'
];

if (expectedAuthBase && expectedAuthBase !== 'http://localhost:3001') {
    forbidden.push('http://localhost:3001');
}

const collectJsFiles = dir => {
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir, {withFileTypes: true});
    return entries.flatMap(entry => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) return collectJsFiles(fullPath);
        return entry.isFile() && entry.name.endsWith('.js') ? [fullPath] : [];
    });
};

const readBuildText = () => collectJsFiles(buildDir)
    .map(filePath => fs.readFileSync(filePath, 'utf8'))
    .join('\n');

if (fs.existsSync(buildDir)) {
    const bundleText = readBuildText();
    if (expectedAuthBase && !bundleText.includes(expectedAuthBase)) {
        failures.push(`desktop bundle must include ZHIMENG_AUTH_API_BASE ${expectedAuthBase}`);
    }
    if (expectedBillingUrl && !bundleText.includes(expectedBillingUrl)) {
        failures.push(`desktop bundle must include ZHIMENG_BILLING_URL ${expectedBillingUrl}`);
    }
    forbidden.forEach(value => {
        if (bundleText.includes(value)) {
            failures.push(`desktop bundle must not include ${value}`);
        }
    });
} else {
    failures.push('build/ does not exist; run npm run build before validating the desktop bundle.');
}

if (failures.length > 0) {
    console.error('Zhimeng desktop bundle check failed:');
    failures.forEach(message => console.error(`- ${message}`));
    process.exit(1);
}

console.log('Zhimeng desktop bundle check passed.');
