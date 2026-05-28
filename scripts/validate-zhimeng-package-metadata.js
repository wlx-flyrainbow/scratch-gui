const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const failures = [];
const warnings = [];

const readText = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

const readJson = relativePath => JSON.parse(readText(relativePath));

const exists = relativePath => fs.existsSync(path.join(root, relativePath));

const publicSourceUrl =
    'https://github.com/wlx-flyrainbow/newsiang-client-public/tree/public-bootstrap-2026-05-28';
const legacyCoreSourceUrl = 'https://github.com/wlx-flyrainbow/scratch-gui';
const publicRepositoryUrl = 'https://github.com/wlx-flyrainbow/newsiang-client-public.git';

const addFailure = (id, message) => {
    failures.push({id, message});
};

const addWarning = (id, message) => {
    warnings.push({id, message});
};

const requireEqual = (id, actual, expected) => {
    if (actual !== expected) {
        addFailure(id, `${id} must be ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
};

const requireIncludes = (id, haystack, needle) => {
    if (!haystack.includes(needle)) {
        addFailure(id, `${id} must include ${JSON.stringify(needle)}`);
    }
};

const requireFile = relativePath => {
    if (!exists(relativePath)) {
        addFailure(relativePath, `${relativePath} must exist`);
    }
};

const checkPackageMetadata = () => {
    const pkg = readJson('package.json');
    const build = pkg.build || {};
    const mac = build.mac || {};
    const win = build.win || {};
    const files = build.files || [];

    requireEqual('package.name', pkg.name, 'scratch-gui');
    requireEqual('package.description', pkg.description, '新祥编程 - 少儿创意编程启蒙桌面应用');
    requireEqual('package.license', pkg.license, 'AGPL-3.0-only');
    requireEqual('package.homepage', pkg.homepage, 'https://zhimeng.codevalley.cn');
    requireEqual(
        'package.repository.url',
        pkg.repository && pkg.repository.url,
        publicRepositoryUrl
    );
    const hasLegacySourceMetadata =
        (pkg.homepage && pkg.homepage.includes(legacyCoreSourceUrl)) ||
        (pkg.repository && pkg.repository.url && pkg.repository.url.includes(legacyCoreSourceUrl));
    if (hasLegacySourceMetadata) {
        addFailure(
            'package.publicSourceMetadata',
            `package metadata must not point to legacy core source ${legacyCoreSourceUrl}`
        );
    }
    requireEqual('build.appId', build.appId, 'com.zhimeng.desktop');
    requireEqual('build.productName', build.productName, '新祥编程');
    requireEqual('build.mac.icon', mac.icon, 'static/app-icon.icns');
    requireEqual('build.win.icon', win.icon, 'build/static/favicon.ico');

    const macTargets = Array.isArray(mac.target) ? mac.target : [];
    ['dmg', 'zip'].forEach(target => {
        if (!macTargets.includes(target)) {
            addFailure('build.mac.target', `build.mac.target must include ${target}`);
        }
    });

    const winTargets = Array.isArray(win.target) ? win.target : [];
    ['nsis', 'portable'].forEach(target => {
        if (!winTargets.includes(target)) {
            addFailure('build.win.target', `build.win.target must include ${target}`);
        }
    });

    [
        'electron-main.js',
        'electron-preload.js',
        'build/**/*',
        'package.json',
        'LICENSE',
        'docs/agpl-source-disclosure.md'
    ].forEach(item => {
        if (!files.includes(item)) {
            addFailure('build.files', `build.files must include ${item}`);
        }
    });

    return pkg;
};

const checkElectronShell = () => {
    const main = readText('electron-main.js');
    requireIncludes('electron-main.windowTitle', main, "title: '新祥编程'");
    requireIncludes('electron-main.pageTitleLock', main, "mainWindow.setTitle('新祥编程')");
    requireIncludes('electron-main.winIcon', main, 'favicon.ico');
    requireIncludes('electron-main.appIcon', main, 'app-icon.png');
    requireIncludes('electron-main.websiteUrl', main, 'https://zhimeng.codevalley.cn/index.html');
    requireIncludes('electron-main.helpMenu', main, '打开新祥编程官网');
    requireIncludes('electron-main.publicSourceUrl', main, publicSourceUrl);
    requireIncludes('electron-main.helpMenuSource', main, '源码与 AGPL 许可');
    requireIncludes('electron-main.safeStorage', main, 'safeStorage');
    requireIncludes('electron-main.authStore', main, 'zhimeng-auth.json');

    const preload = readText('electron-preload.js');
    ['zhimengAuth', 'load', 'save', 'clear'].forEach(needle => {
        requireIncludes('electron-preload.authBridge', preload, needle);
    });
};

const checkRuntimeBranding = () => {
    const webpackConfig = readText('webpack.config.js');
    requireIncludes('webpack.mainTitle', webpackConfig, "title: '新祥编程'");
    if (webpackConfig.includes("title: 'Scratch 3.0 GUI'")) {
        addFailure('webpack.mainTitle', 'main runtime title must not remain Scratch 3.0 GUI');
    }

    const menuBar = readText('src/components/menu-bar/menu-bar.jsx');
    requireIncludes('menu-bar.logoAlt', menuBar, 'alt="新祥编程"');
    requireIncludes('menu-bar.logoAsset', menuBar, '../../../static/app-icon.png');
    if (menuBar.includes('alt="Scratch"') || menuBar.includes('logo: scratchLogo')) {
        addFailure('menu-bar.logo', 'menu bar default logo must be 新祥编程, not Scratch');
    }

    const titledHoc = readText('src/lib/titled-hoc.jsx');
    requireIncludes('titled-hoc.defaultProjectTitle', titledHoc, "defaultMessage: '新祥编程作品'");
    if (titledHoc.includes('Scratch Project')) {
        addFailure('titled-hoc.defaultProjectTitle', 'default project title must not remain Scratch Project');
    }
};

const checkWebsite = pkg => {
    const index = readText('website/index.html');
    [
        '新祥编程',
        '下载桌面客户端',
        'macOS Apple 芯片版',
        'macOS Intel 芯片版',
        'Windows 安装版',
        'Windows 便携版',
        'AGPLv3',
        publicSourceUrl
    ].forEach(needle => {
        requireIncludes('website.index', index, needle);
    });
    if (index.includes(legacyCoreSourceUrl)) {
        addFailure('website.index', `website/index.html must not link to legacy core source ${legacyCoreSourceUrl}`);
    }

    const releases = readJson('website/releases.json');
    requireEqual('website.releases.version', releases.version, pkg.version);
    requireEqual(
        'website.releases.macos.appleSilicon.label',
        releases.macos && releases.macos.appleSilicon && releases.macos.appleSilicon.label,
        'macOS Apple 芯片版'
    );
    requireEqual(
        'website.releases.macos.intel.label',
        releases.macos && releases.macos.intel && releases.macos.intel.label,
        'macOS Intel 芯片版'
    );
    requireEqual(
        'website.releases.windows.nsis.label',
        releases.windows && releases.windows.nsis && releases.windows.nsis.label,
        'Windows 安装版'
    );
    requireEqual(
        'website.releases.windows.portable.label',
        releases.windows && releases.windows.portable && releases.windows.portable.label,
        'Windows 便携版'
    );

    const releaseText = JSON.stringify(releases);
    if (/YOUR-CDN\.example|example\.com/i.test(releaseText)) {
        addWarning(
            'website/releases.json.urls',
            'download URLs are still placeholders; release:check must fail until real CDN URLs are configured'
        );
    }
};

const checkStaticAssets = () => {
    requireFile('static/app-icon.png');
    requireFile('static/app-icon.icns');
    requireFile('static/favicon.ico');
    requireFile('docs/agpl-source-disclosure.md');
    requireFile('LICENSE');
};

const checkDistArtifactsIfPresent = () => {
    const distPath = path.join(root, 'dist');
    if (!fs.existsSync(distPath)) {
        addWarning(
            'dist',
            'dist/ does not exist; run npm run dist:desktop:local before final artifact verification'
        );
        return;
    }

    const files = fs.readdirSync(distPath);
    const dmgFiles = files.filter(name => /\.dmg$/i.test(name));
    const exeFiles = files.filter(name => /\.exe$/i.test(name));
    const hasMacArm64 = dmgFiles.some(name => /arm64/i.test(name));
    const hasMacX64 = dmgFiles.some(name => !/arm64/i.test(name));
    if (!hasMacArm64) {
        addWarning('dist.macos.arm64', 'dist/ exists but no macOS arm64 .dmg artifact was found');
    }
    if (!hasMacX64) {
        addWarning('dist.macos.x64', 'dist/ exists but no macOS x64 .dmg artifact was found');
    }
    if (exeFiles.length === 0) {
        addWarning('dist.windows', 'dist/ exists but no Windows .exe artifact was found');
        return;
    }

    const hasZhimengName = exeFiles.some(name => /新祥编程|zhimeng/i.test(name));
    if (!hasZhimengName) {
        addFailure(
            'dist.windows.name',
            `Windows artifacts should include 新祥编程 or zhimeng in the file name: ${exeFiles.join(', ')}`
        );
    }
};

try {
    const pkg = checkPackageMetadata();
    checkElectronShell();
    checkRuntimeBranding();
    checkWebsite(pkg);
    checkStaticAssets();
    checkDistArtifactsIfPresent();
} catch (err) {
    addFailure('metadata.read', err.message);
}

if (warnings.length > 0) {
    // eslint-disable-next-line no-console
    console.warn('Zhimeng package metadata warnings:');
    for (const warning of warnings) {
        // eslint-disable-next-line no-console
        console.warn(`- ${warning.id}: ${warning.message}`);
    }
}

if (failures.length > 0) {
    // eslint-disable-next-line no-console
    console.error('Zhimeng package metadata check failed:');
    for (const failure of failures) {
        // eslint-disable-next-line no-console
        console.error(`- ${failure.id}: ${failure.message}`);
    }
    process.exit(1);
}

// eslint-disable-next-line no-console
console.log('Zhimeng package metadata looks ready.');
