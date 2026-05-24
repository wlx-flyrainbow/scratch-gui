const fs = require('fs');
const path = require('path');

const backendBase = process.env.ZHIMENG_CHECK_BACKEND_BASE || 'http://127.0.0.1:3001';
const frontendBase = process.env.ZHIMENG_CHECK_FRONTEND_BASE || 'http://127.0.0.1:8601';
const username = process.env.ZHIMENG_CHECK_USERNAME || 'demo';
const password = process.env.ZHIMENG_CHECK_PASSWORD || '123456';
const paymentMode = process.env.ZHIMENG_CHECK_PAYMENT_MODE || 'mock-paid';
const expectedInitialEntitlementStatus = process.env.ZHIMENG_CHECK_INITIAL_ENTITLEMENT_STATUS || 'inactive';
const adminToken = process.env.ZHIMENG_CHECK_ADMIN_TOKEN || '';

const nowStamp = () => new Date().toISOString();
const reportDir = path.resolve(__dirname, '../_bmad-output/test-reports');

const joinUrl = (base, route) => {
    const cleanBase = String(base || '').replace(/\/$/, '');
    const cleanRoute = route.startsWith('/') ? route : `/${route}`;
    return `${cleanBase}${cleanRoute}`;
};

const includesAll = (text, needles) => needles.every(needle => String(text || '').includes(needle));

const hasAgplSourceLink = text => /AGPL|源码|源代码|github\.com\/wlx-flyrainbow\/scratch-gui/i.test(text || '');

const requestJson = async ({method, url, body, token, adminToken: requestAdminToken}) => {
    const headers = {'Content-Type': 'application/json'};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (requestAdminToken) headers['X-Zhimeng-Admin-Token'] = requestAdminToken;
    const payload = body ? JSON.stringify(body) : null;
    const response = await fetch(url, {
        method,
        headers,
        body: payload
    });
    const text = await response.text();
    let json = null;
    try {
        json = text ? JSON.parse(text) : null;
    } catch (e) {
        // Keep json as null.
    }
    return {
        url,
        method,
        status: response.status,
        ok: response.ok,
        json,
        text
    };
};

const requestText = async ({method, url}) => {
    const response = await fetch(url, {method});
    const text = await response.text();
    return {
        url,
        method,
        status: response.status,
        ok: response.ok,
        text
    };
};

const pushStep = (steps, id, pass, detail) => {
    steps.push({id, pass, detail});
};

const ensureDir = target => {
    if (!fs.existsSync(target)) {
        fs.mkdirSync(target, {recursive: true});
    }
};

const toMarkdown = result => {
    const lines = [];
    lines.push('# 知萌目标自动化检查报告');
    lines.push('');
    lines.push(`- 时间: ${result.timestamp}`);
    lines.push(`- 前端地址: ${result.frontendBase}`);
    lines.push(`- 后端地址: ${result.backendBase}`);
    lines.push(`- 支付确认模式: ${result.paymentMode}`);
    lines.push(`- 预期初始授权状态: ${result.expectedInitialEntitlementStatus}`);
    lines.push(`- 总体结果: ${result.pass ? 'PASS' : 'FAIL'}`);
    lines.push('');
    lines.push('## 步骤结果');
    lines.push('');
    for (const step of result.steps) {
        lines.push(`- [${step.pass ? 'x' : ' '}] ${step.id}: ${step.detail}`);
    }
    lines.push('');
    lines.push('## 关键响应摘要');
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(result.responses, null, 2));
    lines.push('```');
    lines.push('');
    return lines.join('\n');
};

const redactValue = value => {
    if (typeof value !== 'string') return value;
    return value
        .replace(/at_[a-f0-9]+/g, 'ACCESS_TOKEN_REDACTED')
        .replace(/rt_[a-f0-9]+/g, 'REFRESH_TOKEN_REDACTED')
        .replace(/pay_[a-f0-9]+/g, 'PAYMENT_TOKEN_REDACTED');
};

const sanitizeValue = value => {
    if (Array.isArray(value)) return value.map(sanitizeValue);
    if (value && typeof value === 'object') {
        return Object.keys(value).reduce((memo, key) => {
            if (['access_token', 'refresh_token'].includes(key)) {
                memo[key] = 'REDACTED';
            } else {
                memo[key] = sanitizeValue(value[key]);
            }
            return memo;
        }, {});
    }
    return redactValue(value);
};

const sanitizeResponse = (key, response) => {
    if (!response || typeof response !== 'object') return response;
    const next = Object.keys(response).reduce((memo, responseKey) => {
        if (['access_token', 'refresh_token'].includes(responseKey)) {
            memo[responseKey] = 'REDACTED';
        } else if (responseKey === 'text' && /^frontend/.test(key)) {
            memo[responseKey] = `[html omitted; length=${String(response.text || '').length}]`;
        } else {
            memo[responseKey] = sanitizeValue(response[responseKey]);
        }
        return memo;
    }, {});
    return next;
};

const sanitizeResult = result => ({
    ...result,
    responses: Object.keys(result.responses || {}).reduce((memo, key) => {
        memo[key] = sanitizeResponse(key, result.responses[key]);
        return memo;
    }, {})
});

const main = async () => {
    const timestamp = nowStamp();
    const steps = [];
    const responses = {};
    let pass = true;

    try {
        responses.frontendHome = await requestText({
            method: 'GET',
            url: frontendBase
        });
        const frontendHttpPass = responses.frontendHome.status === 200;
        pushStep(
            steps,
            'frontend_http',
            frontendHttpPass,
            `GET ${frontendBase} -> ${responses.frontendHome.status}`
        );
        if (!frontendHttpPass) pass = false;

        const frontendContentPass = frontendHttpPass &&
            includesAll(responses.frontendHome.text, ['知萌', '下载 Windows 客户端']) &&
            hasAgplSourceLink(responses.frontendHome.text) &&
            !responses.frontendHome.text.includes('purchase.html');
        pushStep(
            steps,
            'frontend_home_content',
            Boolean(frontendContentPass),
            frontendContentPass ?
                '首页包含知萌品牌、Windows 下载入口和 AGPL/源码链接，且未推荐 purchase.html' :
                '首页缺少知萌品牌、Windows 下载入口、AGPL/源码链接，或仍推荐 purchase.html'
        );
        if (!frontendContentPass) pass = false;
    } catch (err) {
        pushStep(steps, 'frontend_http', false, `请求失败: ${err.message || err}`);
        pass = false;
    }

    try {
        responses.frontendPurchase = await requestText({
            method: 'GET',
            url: joinUrl(frontendBase, '/purchase.html')
        });
        const purchasePass = responses.frontendPurchase.status === 200 &&
            includesAll(responses.frontendPurchase.text, [
                '本地订单验收工具',
                '客服辅助',
                '正式购买请在知萌客户端'
            ]);
        pushStep(
            steps,
            'frontend_purchase_demoted',
            Boolean(purchasePass),
            `GET /purchase.html -> ${responses.frontendPurchase.status}, ${
                purchasePass ? '已降级为验收/客服辅助页' : '仍像正式购买入口或缺少降级文案'
            }`
        );
        if (!purchasePass) pass = false;
    } catch (err) {
        pushStep(steps, 'frontend_purchase_demoted', false, `请求失败: ${err.message || err}`);
        pass = false;
    }

    try {
        responses.frontendPay = await requestText({
            method: 'GET',
            url: joinUrl(frontendBase, '/pay.html')
        });
        const payPass = responses.frontendPay.status === 200 &&
            includesAll(responses.frontendPay.text, ['知萌订单支付', '扫码付款', '我已付款']);
        pushStep(
            steps,
            'frontend_pay_content',
            Boolean(payPass),
            `GET /pay.html -> ${responses.frontendPay.status}, ${
                payPass ? '关键元素存在' : '缺少付款页关键元素'
            }`
        );
        if (!payPass) pass = false;
    } catch (err) {
        pushStep(steps, 'frontend_pay_content', false, `请求失败: ${err.message || err}`);
        pass = false;
    }

    try {
        responses.frontendOps = await requestText({
            method: 'GET',
            url: joinUrl(frontendBase, '/ops.html')
        });
        const opsPass = responses.frontendOps.status === 200 &&
            includesAll(responses.frontendOps.text, ['订单确认', '运营口令', '待确认订单']);
        pushStep(
            steps,
            'frontend_ops_content',
            Boolean(opsPass),
            `GET /ops.html -> ${responses.frontendOps.status}, ${
                opsPass ? '关键元素存在' : '缺少运营确认页关键元素'
            }`
        );
        if (!opsPass) pass = false;
    } catch (err) {
        pushStep(steps, 'frontend_ops_content', false, `请求失败: ${err.message || err}`);
        pass = false;
    }

    try {
        responses.health = await requestJson({
            method: 'GET',
            url: `${backendBase}/health`
        });
        const healthPass = responses.health.status === 200;
        pushStep(
            steps,
            'backend_health',
            healthPass,
            `GET /health -> ${responses.health.status}`
        );
        if (!healthPass) pass = false;
    } catch (err) {
        pushStep(steps, 'backend_health', false, `请求失败: ${err.message || err}`);
        pass = false;
    }

    let token = null;
    let refreshToken = null;
    let orderId = null;
    if (pass) {
        responses.login = await requestJson({
            method: 'POST',
            url: `${backendBase}/auth/login`,
            body: {username, password}
        });
        const loginPass = responses.login.status === 200 &&
            responses.login.json &&
            responses.login.json.access_token;
        pushStep(steps, 'auth_login', Boolean(loginPass), `POST /auth/login -> ${responses.login.status}`);
        if (!loginPass) pass = false;
        token = loginPass ? responses.login.json.access_token : null;
        refreshToken = loginPass ? responses.login.json.refresh_token : null;
    }

    if (pass) {
        responses.entitlementBefore = await requestJson({
            method: 'GET',
            url: `${backendBase}/entitlement`,
            token
        });
        const beforeEntitlementPass = responses.entitlementBefore.status === 200 &&
            responses.entitlementBefore.json &&
            responses.entitlementBefore.json.status === expectedInitialEntitlementStatus;
        pushStep(
            steps,
            'entitlement_initial',
            Boolean(beforeEntitlementPass),
            `GET /entitlement -> ${responses.entitlementBefore.status}, ` +
                `status=${responses.entitlementBefore.json && responses.entitlementBefore.json.status}`
        );
        if (!beforeEntitlementPass) pass = false;
    }

    if (pass) {
        responses.createOrder = await requestJson({
            method: 'POST',
            url: `${backendBase}/order/create`,
            token,
            body: {
                plan: 'family_yearly',
                channel: 'wechat',
                return_url: 'https://billing.example.com/result'
            }
        });
        const orderPass = responses.createOrder.status === 200 &&
            responses.createOrder.json &&
            responses.createOrder.json.order_id;
        pushStep(
            steps,
            'order_create',
            Boolean(orderPass),
            `POST /order/create -> ${responses.createOrder.status}`
        );
        if (!orderPass) pass = false;
        orderId = orderPass ? responses.createOrder.json.order_id : null;
    }

    if (pass) {
        responses.orderBefore = await requestJson({
            method: 'GET',
            url: `${backendBase}/order/${orderId}/status`,
            token
        });
        const beforePass = responses.orderBefore.status === 200 &&
            responses.orderBefore.json &&
            responses.orderBefore.json.status === 'created';
        pushStep(
            steps,
            'order_status_before',
            Boolean(beforePass),
            `GET /order/:id/status -> ${responses.orderBefore.status}`
        );
        if (!beforePass) pass = false;
    }

    if (pass && paymentMode === 'mock-paid') {
        responses.mockPaid = await requestJson({
            method: 'POST',
            url: `${backendBase}/order/${orderId}/mock-paid`,
            token,
            body: {}
        });
        const paidPass = responses.mockPaid.status === 200;
        pushStep(
            steps,
            'order_mock_paid',
            paidPass,
            `POST /order/:id/mock-paid -> ${responses.mockPaid.status}`
        );
        if (!paidPass) pass = false;
    } else if (pass && paymentMode === 'manual-confirm') {
        responses.manualConfirm = await requestJson({
            method: 'POST',
            url: `${backendBase}/admin/order/${orderId}/manual-confirm`,
            adminToken,
            body: {
                operator: 'goal-check',
                provider_trade_no: `goal-${timestamp.replace(/[:.]/g, '-')}`,
                amount_cents: responses.createOrder.json.amount_cents,
                currency: responses.createOrder.json.currency,
                note: 'automated goal check'
            }
        });
        const confirmPass = responses.manualConfirm.status === 200 &&
            responses.manualConfirm.json &&
            responses.manualConfirm.json.status === 'fulfilled';
        pushStep(
            steps,
            'order_manual_confirm',
            Boolean(confirmPass),
            `POST /admin/order/:id/manual-confirm -> ${responses.manualConfirm.status}`
        );
        if (!confirmPass) pass = false;
    } else if (pass) {
        pushStep(
            steps,
            'payment_confirm',
            false,
            `不支持的支付确认模式: ${paymentMode}`
        );
        pass = false;
    }

    if (pass) {
        responses.orderAfter = await requestJson({
            method: 'GET',
            url: `${backendBase}/order/${orderId}/status`,
            token
        });
        const afterPass = responses.orderAfter.status === 200 &&
            responses.orderAfter.json &&
            ['paid', 'fulfilled'].includes(responses.orderAfter.json.status);
        pushStep(
            steps,
            'order_status_after',
            Boolean(afterPass),
            `GET /order/:id/status -> ${responses.orderAfter.status}`
        );
        if (!afterPass) pass = false;
    }

    if (pass) {
        responses.refresh = await requestJson({
            method: 'POST',
            url: `${backendBase}/auth/refresh`,
            body: {refresh_token: refreshToken}
        });
        const refreshPass = responses.refresh.status === 200 &&
            responses.refresh.json &&
            responses.refresh.json.access_token;
        pushStep(steps, 'auth_refresh', Boolean(refreshPass), `POST /auth/refresh -> ${responses.refresh.status}`);
        if (!refreshPass) pass = false;
        token = refreshPass ? responses.refresh.json.access_token : token;
    }

    if (pass) {
        responses.entitlement = await requestJson({
            method: 'GET',
            url: `${backendBase}/entitlement`,
            token
        });
        const entPass = responses.entitlement.status === 200 &&
            responses.entitlement.json &&
            responses.entitlement.json.status === 'active';
        pushStep(steps, 'entitlement_active', Boolean(entPass), `GET /entitlement -> ${responses.entitlement.status}`);
        if (!entPass) pass = false;
    }

    const result = {
        timestamp,
        backendBase,
        frontendBase,
        paymentMode,
        expectedInitialEntitlementStatus,
        pass,
        steps,
        responses
    };

    ensureDir(reportDir);
    const fileTag = timestamp.replace(/[:.]/g, '-');
    const jsonPath = path.join(reportDir, `zhimeng-goal-check-${fileTag}.json`);
    const mdPath = path.join(reportDir, `zhimeng-goal-check-${fileTag}.md`);
    const sanitizedResult = sanitizeResult(result);
    fs.writeFileSync(jsonPath, JSON.stringify(sanitizedResult, null, 2), 'utf8');
    fs.writeFileSync(mdPath, toMarkdown(sanitizedResult), 'utf8');

    // eslint-disable-next-line no-console
    console.log(JSON.stringify({
        pass,
        jsonReport: jsonPath,
        markdownReport: mdPath
    }, null, 2));

    process.exit(pass ? 0 : 1);
};

main().catch(err => {
    // eslint-disable-next-line no-console
    console.error(err.message || err);
    process.exit(1);
});
