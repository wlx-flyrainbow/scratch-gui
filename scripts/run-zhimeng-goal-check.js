const fs = require('fs');
const path = require('path');

const backendBase = process.env.ZHIMENG_CHECK_BACKEND_BASE || 'http://127.0.0.1:3001';
const frontendBase = process.env.ZHIMENG_CHECK_FRONTEND_BASE || 'http://127.0.0.1:8601';
const username = process.env.ZHIMENG_CHECK_USERNAME || 'demo';
const password = process.env.ZHIMENG_CHECK_PASSWORD || '123456';

const nowStamp = () => new Date().toISOString();
const reportDir = path.resolve(__dirname, '../_bmad-output/test-reports');

const requestJson = async ({method, url, body, token}) => {
    const headers = {'Content-Type': 'application/json'};
    if (token) headers.Authorization = `Bearer ${token}`;
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

const main = async () => {
    const timestamp = nowStamp();
    const steps = [];
    const responses = {};
    let pass = true;

    try {
        responses.frontendHead = await requestJson({
            method: 'GET',
            url: frontendBase
        });
        const frontendPass = responses.frontendHead.status === 200;
        pushStep(
            steps,
            'frontend_http',
            frontendPass,
            `GET ${frontendBase} -> ${responses.frontendHead.status}`
        );
        if (!frontendPass) pass = false;
    } catch (err) {
        pushStep(steps, 'frontend_http', false, `请求失败: ${err.message || err}`);
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

    if (pass) {
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
    }

    if (pass) {
        responses.orderAfter = await requestJson({
            method: 'GET',
            url: `${backendBase}/order/${orderId}/status`,
            token
        });
        const afterPass = responses.orderAfter.status === 200 &&
            responses.orderAfter.json &&
            responses.orderAfter.json.status === 'paid';
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
        pass,
        steps,
        responses
    };

    ensureDir(reportDir);
    const fileTag = timestamp.replace(/[:.]/g, '-');
    const jsonPath = path.join(reportDir, `zhimeng-goal-check-${fileTag}.json`);
    const mdPath = path.join(reportDir, `zhimeng-goal-check-${fileTag}.md`);
    fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2), 'utf8');
    fs.writeFileSync(mdPath, toMarkdown(result), 'utf8');

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
