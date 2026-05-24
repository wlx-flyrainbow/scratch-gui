/* global document, window */
const fs = require('fs');
const http = require('http');
const path = require('path');
const {spawn} = require('child_process');
const {chromium} = require('playwright-core');

const root = path.resolve(__dirname, '..');
const reportDir = path.join(root, '_bmad-output', 'test-reports');
const chromePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const authPort = Number(process.env.ZHIMENG_AUTH_PORT || 3001);
const authBase = `http://localhost:${authPort}`;
const viewports = [
    {width: 1280, height: 800},
    {width: 1440, height: 900}
];

const requestHealth = () => new Promise(resolve => {
    const req = http.get(`${authBase}/health`, res => {
        res.resume();
        resolve(res.statusCode >= 200 && res.statusCode < 300);
    });
    req.setTimeout(1000, () => {
        req.destroy();
        resolve(false);
    });
    req.on('error', () => resolve(false));
});

const waitForAuthServer = async () => {
    for (let i = 0; i < 40; i++) {
        if (await requestHealth()) return;
        await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error(`Auth server did not become healthy at ${authBase}`);
};

const ensureAuthServer = async () => {
    if (await requestHealth()) return null;
    const child = spawn(process.execPath, [path.join(root, 'scripts/start-auth-server-mock-db.js')], {
        cwd: root,
        env: {
            ...process.env,
            ZHIMENG_AUTH_PORT: String(authPort),
            ZHIMENG_PLAN_FAMILY_YEARLY_AMOUNT_CENTS: '1'
        },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    child.stdout.on('data', chunk => process.stdout.write(chunk));
    child.stderr.on('data', chunk => process.stderr.write(chunk));
    await waitForAuthServer();
    return child;
};

const assertCondition = (condition, message, details) => {
    if (!condition) {
        const error = new Error(message);
        error.details = details;
        throw error;
    }
};

const assertLockedBrand = async page => {
    const metrics = await page.evaluate(() => {
        const lockedCard = document.querySelector('[class*="locked-content"]');
        const logo = document.querySelector('[class*="locked-brand-logo"]');
        const rectOf = element => {
            const rect = element.getBoundingClientRect();
            return {
                width: rect.width,
                height: rect.height
            };
        };
        return {
            documentScrollWidth: document.documentElement.scrollWidth,
            viewport: {width: window.innerWidth, height: window.innerHeight},
            card: rectOf(lockedCard),
            logo: rectOf(logo)
        };
    });
    assertCondition(
        metrics.documentScrollWidth <= metrics.viewport.width + 2,
        'Locked entry creates horizontal overflow',
        metrics
    );
    assertCondition(
        metrics.card.width >= 680,
        'Locked entry card is too small for product-brand presentation',
        metrics
    );
    assertCondition(
        metrics.logo.width >= 64 && metrics.logo.height >= 64,
        'Locked entry does not show a prominent brand logo',
        metrics
    );
};

const runViewport = async (browser, viewport) => {
    const page = await browser.newPage({viewport});
    const buildIndex = path.join(root, 'build', 'index.html');
    await page.goto(`file://${buildIndex}`);
    await assertLockedBrand(page);
    await page.getByRole('button', {name: '登录账号'}).click();
    await page.getByRole('tab', {name: '注册'}).click();
    const username = `layout_${viewport.width}_${Date.now()}`;
    await page.getByRole('textbox', {name: '账号'}).fill(username);
    await page.getByRole('textbox', {name: '昵称'}).fill('布局测试');
    await page.locator('input[name="password"]').fill('test123456');
    await page.getByRole('button', {name: '注册并登录'}).click();
    await page.waitForTimeout(900);
    await page.locator('button', {hasText: '订阅解锁'})
        .last()
        .click();
    await page.waitForTimeout(900);

    const metrics = await page.evaluate(() => {
        const rectOf = element => {
            const rect = element.getBoundingClientRect();
            return {
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
                left: rect.left,
                width: rect.width,
                height: rect.height
            };
        };
        const modal = document.querySelector('[class*="zhimeng-billing-modal"]');
        const modalBody = document.querySelector('[class*="zhimeng-modal-body"]');
        const checkout = document.querySelector('[class*="billing-checkout"]');
        const progressPanel = document.querySelector('[class*="billing-progress-panel"]');
        const proofPanel = document.querySelector('[class*="proof-panel"]');
        const submitButton = [...document.querySelectorAll('button')]
            .find(button => /提交付款凭证/.test(button.textContent || ''));
        return {
            viewport: {width: window.innerWidth, height: window.innerHeight},
            documentScrollWidth: document.documentElement.scrollWidth,
            bodyScrollWidth: document.body.scrollWidth,
            modal: {
                clientWidth: modal.clientWidth,
                scrollWidth: modal.scrollWidth,
                clientHeight: modal.clientHeight,
                scrollHeight: modal.scrollHeight,
                rect: rectOf(modal)
            },
            modalBody: {
                clientWidth: modalBody.clientWidth,
                scrollWidth: modalBody.scrollWidth,
                clientHeight: modalBody.clientHeight,
                scrollHeight: modalBody.scrollHeight,
                rect: rectOf(modalBody)
            },
            progressPanel: rectOf(progressPanel),
            proofPanel: rectOf(proofPanel),
            checkout: rectOf(checkout),
            submitButton: rectOf(submitButton)
        };
    });

    const suffix = `${viewport.width}x${viewport.height}`;
    const screenshotPath = path.join(reportDir, `zhimeng-billing-layout-${suffix}.png`);
    await page.screenshot({path: screenshotPath, fullPage: false});
    await page.close();

    const tolerance = 2;
    assertCondition(
        metrics.documentScrollWidth <= metrics.viewport.width + tolerance &&
            metrics.bodyScrollWidth <= metrics.viewport.width + tolerance,
        `Billing layout creates page-level horizontal overflow at ${suffix}`,
        metrics
    );
    assertCondition(
        metrics.modal.scrollWidth <= metrics.modal.clientWidth + tolerance &&
            metrics.modalBody.scrollWidth <= metrics.modalBody.clientWidth + tolerance,
        `Billing modal creates internal horizontal overflow at ${suffix}`,
        metrics
    );
    assertCondition(
        metrics.modalBody.scrollHeight <= metrics.modalBody.clientHeight + tolerance,
        `Billing modal requires vertical scrolling at ${suffix}`,
        metrics
    );
    assertCondition(
        metrics.submitButton.bottom <= metrics.viewport.height - 24 &&
            metrics.submitButton.right <= metrics.viewport.width - 24,
        `Submit button is not visible in first viewport at ${suffix}`,
        metrics
    );
    assertCondition(
        metrics.progressPanel.bottom <= metrics.checkout.top + tolerance,
        `Billing progress is not placed above checkout content at ${suffix}`,
        metrics
    );
    assertCondition(
        metrics.proofPanel.width >= 430,
        `Payment proof panel is too narrow after moving progress to the top at ${suffix}`,
        metrics
    );

    return {
        viewport,
        screenshotPath,
        metrics
    };
};

(async () => {
    const buildIndex = path.join(root, 'build', 'index.html');
    if (!fs.existsSync(buildIndex)) {
        throw new Error('build/index.html does not exist. Run `npm run build` first.');
    }
    if (!fs.existsSync(chromePath)) {
        throw new Error(`Google Chrome was not found at ${chromePath}. Set CHROME_PATH to override.`);
    }
    fs.mkdirSync(reportDir, {recursive: true});

    const authServer = await ensureAuthServer();
    let browser = null;
    try {
        browser = await chromium.launch({
            executablePath: chromePath,
            headless: true,
            args: ['--allow-file-access-from-files']
        });
        const results = [];
        for (const viewport of viewports) {
            results.push(await runViewport(browser, viewport));
        }
        const reportPath = path.join(reportDir, `zhimeng-billing-layout-${new Date()
            .toISOString()
            .replace(/[:.]/g, '-')}.json`);
        fs.writeFileSync(reportPath, `${JSON.stringify({pass: true, results}, null, 2)}\n`);
        // eslint-disable-next-line no-console
        console.log(JSON.stringify({pass: true, reportPath, screenshots: results.map(r => r.screenshotPath)}, null, 2));
    } catch (err) {
        const reportPath = path.join(reportDir, `zhimeng-billing-layout-fail-${new Date()
            .toISOString()
            .replace(/[:.]/g, '-')}.json`);
        fs.writeFileSync(reportPath, `${JSON.stringify({
            pass: false,
            message: err.message,
            details: err.details || null
        }, null, 2)}\n`);
        // eslint-disable-next-line no-console
        console.error(JSON.stringify({pass: false, reportPath, message: err.message}, null, 2));
        process.exitCode = 1;
    } finally {
        if (browser) await browser.close();
        if (authServer) authServer.kill();
    }
})();
