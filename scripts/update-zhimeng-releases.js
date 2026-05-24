const fs = require('fs');
const path = require('path');

const packageJson = require('../package.json');

const releasesPath = path.resolve(__dirname, '../website/releases.json');

const value = key => String(process.env[key] || '').trim();

const assertHttpsUrl = (key, raw) => {
    try {
        const parsed = new URL(raw);
        if (parsed.protocol !== 'https:') {
            throw new Error('not https');
        }
    } catch (err) {
        throw new Error(`${key} must be a production https:// URL`);
    }
    if (/YOUR-|example\.com|localhost|127\.0\.0\.1|replace-with|changeme|todo|<.+>/i.test(raw)) {
        throw new Error(`${key} must not be a placeholder URL`);
    }
};

const nsisUrl = value('ZHIMENG_WINDOWS_NSIS_URL');
const portableUrl = value('ZHIMENG_WINDOWS_PORTABLE_URL');
const macArm64Url = value('ZHIMENG_MACOS_ARM64_URL');
const macX64Url = value('ZHIMENG_MACOS_X64_URL');
assertHttpsUrl('ZHIMENG_WINDOWS_NSIS_URL', nsisUrl);
assertHttpsUrl('ZHIMENG_WINDOWS_PORTABLE_URL', portableUrl);
assertHttpsUrl('ZHIMENG_MACOS_ARM64_URL', macArm64Url);
assertHttpsUrl('ZHIMENG_MACOS_X64_URL', macX64Url);

const releases = {
    channel: value('ZHIMENG_RELEASE_CHANNEL') || 'stable',
    version: value('ZHIMENG_RELEASE_VERSION') || packageJson.version,
    releasedAt: value('ZHIMENG_RELEASED_AT') || new Date().toISOString()
        .slice(0, 10),
    windows: {
        nsis: {
            label: value('ZHIMENG_WINDOWS_NSIS_LABEL') || 'Windows 安装版',
            url: nsisUrl
        },
        portable: {
            label: value('ZHIMENG_WINDOWS_PORTABLE_LABEL') || 'Windows 便携版',
            url: portableUrl
        }
    },
    macos: {
        appleSilicon: {
            label: value('ZHIMENG_MACOS_ARM64_LABEL') || 'macOS Apple 芯片版',
            url: macArm64Url
        },
        intel: {
            label: value('ZHIMENG_MACOS_X64_LABEL') || 'macOS Intel 芯片版',
            url: macX64Url
        }
    },
    beta: null
};

fs.writeFileSync(releasesPath, `${JSON.stringify(releases, null, 2)}\n`);

// eslint-disable-next-line no-console
console.log(`Updated ${path.relative(process.cwd(), releasesPath)} for ${releases.version}.`);
