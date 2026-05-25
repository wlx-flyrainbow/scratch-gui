const fs = require('fs');
const path = require('path');
const packageJson = require('../package.json');

const DEFAULT_BASE_URL = 'https://zhimeng.codevalley.cn';
const MIN_DOWNLOAD_BYTES = 1024 * 1024;
const MIN_VIDEO_BYTES = 100 * 1024;

const baseUrl = String(process.env.ZHIMENG_VERIFY_PUBLIC_BASE_URL || DEFAULT_BASE_URL)
    .replace(/\/$/, '');
const expectedVersion = process.env.ZHIMENG_VERIFY_EXPECTED_VERSION ||
    packageJson.version;
const requireHealth = process.env.ZHIMENG_VERIFY_REQUIRE_HEALTH === '1';

const failures = [];
const warnings = [];

const addFailure = (id, message) => {
    failures.push({id, message});
};

const addWarning = (id, message) => {
    warnings.push({id, message});
};

const joinUrl = route => {
    if (/^https?:\/\//i.test(route)) return route;
    return `${baseUrl}${route.startsWith('/') ? route : `/${route}`}`;
};

const request = async (method, url) => {
    const response = await fetch(url, {
        method,
        redirect: 'follow'
    });
    const text = method === 'HEAD' ? '' : await response.text();
    return {
        url,
        method,
        status: response.status,
        ok: response.ok,
        headers: response.headers,
        text
    };
};

const parseContentLength = response => {
    const raw = response.headers.get('content-length');
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
};

const expectStatus = (id, response, expectedStatus = 200) => {
    if (response.status !== expectedStatus) {
        addFailure(id, `${response.method} ${response.url} -> ${response.status}`);
        return false;
    }
    return true;
};

const expectTextIncludes = (id, text, needles) => {
    for (const needle of needles) {
        if (!String(text || '').includes(needle)) {
            addFailure(id, `missing required text: ${needle}`);
        }
    }
};

const expectTextExcludes = (id, text, needles) => {
    for (const needle of needles) {
        if (String(text || '').includes(needle)) {
            addFailure(id, `must not include stale text: ${needle}`);
        }
    }
};

const expectNoPlaceholderLinks = (id, text) => {
    const hrefPattern = /href=["']([^"']+)["']/gi;
    let match = hrefPattern.exec(text);
    while (match) {
        const href = match[1];
        if (/YOUR-|example\.com|localhost|127\.0\.0\.1/i.test(href)) {
            addFailure(id, `placeholder href found: ${href}`);
        }
        match = hrefPattern.exec(text);
    }
};

const expectHeadAsset = async ({id, url, minBytes}) => {
    const response = await request('HEAD', url);
    if (!expectStatus(id, response)) return;
    const size = parseContentLength(response);
    if (size === null) {
        addWarning(id, 'missing content-length header');
        return;
    }
    if (size < minBytes) {
        addFailure(id, `content-length too small: ${size}`);
    }
};

const readLocalReleases = () => {
    const releasesPath = path.resolve(__dirname, '../website/releases.json');
    return JSON.parse(fs.readFileSync(releasesPath, 'utf8'));
};

const checkHome = async () => {
    const response = await request('GET', joinUrl('/'));
    if (!expectStatus('home.status', response)) return;
    expectTextIncludes('home.content', response.text, [
        '知萌',
        '下载桌面客户端',
        'macOS Apple 芯片版',
        'macOS Intel 芯片版',
        'Windows 安装版',
        'Windows 便携版',
        'AGPLv3'
    ]);
    expectTextExcludes('home.content', response.text, [
        'Scratch 3.0 GUI',
        '当前版本 5.2.16',
        'purchase.html'
    ]);
    expectNoPlaceholderLinks('home.links', response.text);
};

const checkStaticPages = async () => {
    const pay = await request('GET', joinUrl('/pay.html'));
    if (expectStatus('pay.status', pay)) {
        expectTextIncludes('pay.content', pay.text, ['知萌订单支付', '扫码付款', '我已付款']);
    }

    const ops = await request('GET', joinUrl('/ops.html'));
    if (expectStatus('ops.status', ops)) {
        expectTextIncludes('ops.content', ops.text, ['订单确认', '运营口令', '待确认订单']);
    }
};

const checkReleases = async () => {
    const response = await request('GET', joinUrl('/releases.json'));
    if (!expectStatus('releases.status', response)) return null;
    let remote = null;
    try {
        remote = JSON.parse(response.text);
    } catch (err) {
        addFailure('releases.json', `invalid JSON: ${err.message}`);
        return null;
    }

    const local = readLocalReleases();
    if (remote.version !== expectedVersion) {
        addFailure(
            'releases.version',
            `expected ${expectedVersion}, got ${remote.version || '(empty)'}`
        );
    }
    if (remote.channel !== 'stable') {
        addFailure('releases.channel', `expected stable, got ${remote.channel || '(empty)'}`);
    }
    if (JSON.stringify(remote) !== JSON.stringify(local)) {
        addWarning('releases.sync', 'remote releases.json differs from local website/releases.json');
    }

    return remote;
};

const collectDownloadUrls = releases => {
    const urls = [];
    const add = (id, item) => {
        if (!item || !item.url) {
            addFailure(id, 'missing download URL');
            return;
        }
        urls.push({id, url: item.url});
    };
    add('download.windows.nsis', releases.windows && releases.windows.nsis);
    add('download.windows.portable', releases.windows && releases.windows.portable);
    add('download.macos.appleSilicon', releases.macos && releases.macos.appleSilicon);
    add('download.macos.intel', releases.macos && releases.macos.intel);
    return urls;
};

const checkDownloads = async releases => {
    const urls = collectDownloadUrls(releases);
    for (const item of urls) {
        if (!item.url.startsWith(`${baseUrl}/downloads/`)) {
            addFailure(item.id, `download URL is outside expected domain/path: ${item.url}`);
            continue;
        }
        if (!item.url.includes(expectedVersion)) {
            addFailure(item.id, `download URL does not include version ${expectedVersion}: ${item.url}`);
        }
        await expectHeadAsset({
            id: item.id,
            url: item.url,
            minBytes: MIN_DOWNLOAD_BYTES
        });
    }
};

const checkVideo = async () => {
    await expectHeadAsset({
        id: 'asset.demoVideo',
        url: joinUrl('/assets/videos/zhimeng-demo-30s.mp4'),
        minBytes: MIN_VIDEO_BYTES
    });
};

const checkHealth = async () => {
    try {
        const response = await request('GET', joinUrl('/health'));
        if (response.status !== 200) {
            const message = `GET ${response.url} -> ${response.status}`;
            if (requireHealth) {
                addFailure('health.status', message);
            } else {
                addWarning('health.status', `${message}; set ZHIMENG_VERIFY_REQUIRE_HEALTH=1 to make this fatal`);
            }
            return;
        }
        if (!/ok|healthy|true/i.test(response.text)) {
            const message = 'health endpoint returned 200 but body does not look healthy';
            if (requireHealth) addFailure('health.body', message);
            else addWarning('health.body', message);
        }
    } catch (err) {
        const message = `health request failed: ${err.message}`;
        if (requireHealth) addFailure('health.request', message);
        else addWarning('health.request', message);
    }
};

const main = async () => {
    await checkHome();
    await checkStaticPages();
    const releases = await checkReleases();
    if (releases) {
        await checkDownloads(releases);
    }
    await checkVideo();
    await checkHealth();

    if (warnings.length > 0) {
        // eslint-disable-next-line no-console
        console.warn('Zhimeng public release warnings:');
        for (const warning of warnings) {
            // eslint-disable-next-line no-console
            console.warn(`- ${warning.id}: ${warning.message}`);
        }
    }

    if (failures.length > 0) {
        // eslint-disable-next-line no-console
        console.error('Zhimeng public release verification failed:');
        for (const failure of failures) {
            // eslint-disable-next-line no-console
            console.error(`- ${failure.id}: ${failure.message}`);
        }
        process.exit(1);
    }

    // eslint-disable-next-line no-console
    console.log(`Zhimeng public release looks ready: ${baseUrl} @ ${expectedVersion}`);
};

main().catch(err => {
    // eslint-disable-next-line no-console
    console.error(`Zhimeng public release verification crashed: ${err.stack || err.message || err}`);
    process.exit(1);
});
