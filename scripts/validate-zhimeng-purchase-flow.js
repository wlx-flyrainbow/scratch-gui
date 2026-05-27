const fs = require('fs');
const path = require('path');

process.env.ZHIMENG_ADMIN_TOKEN = process.env.ZHIMENG_ADMIN_TOKEN || 'purchase-flow-admin-token';
process.env.ZHIMENG_ENABLE_MOCK_PAYMENT = '0';

const useRealDb = ['1', 'true', 'yes', 'on'].includes(
    String(process.env.ZHIMENG_FLOW_USE_REAL_DB || '').toLowerCase()
);

if (!useRealDb) {
    // eslint-disable-next-line global-require
    require('./start-auth-server-mock-db');
}

const {createApp, accessTokens} = require('../backend/app');
const db = useRealDb ? require('../backend/db') : null;

const reportDir = path.resolve(__dirname, '../_bmad-output/test-reports');
const adminToken = process.env.ZHIMENG_ADMIN_TOKEN;
const username = process.env.ZHIMENG_FLOW_USERNAME || 'demo';
const password = process.env.ZHIMENG_FLOW_PASSWORD || '123456';
const nickname = process.env.ZHIMENG_FLOW_NICKNAME || '新祥编程新用户验收账号';
const newUserFlow = ['1', 'true', 'yes', 'on'].includes(
    String(process.env.ZHIMENG_FLOW_NEW_USER || '').toLowerCase()
);

const ensureDir = target => {
    if (!fs.existsSync(target)) fs.mkdirSync(target, {recursive: true});
};

const nowStamp = () => new Date().toISOString();

const requestJson = async ({baseUrl, method, route, token, admin, body}) => {
    const headers = {'Content-Type': 'application/json'};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (admin) headers['X-Zhimeng-Admin-Token'] = adminToken;
    const response = await fetch(`${baseUrl}${route}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : null
    });
    const text = await response.text();
    let json = null;
    try {
        json = text ? JSON.parse(text) : null;
    } catch (e) {
        // Keep response text for diagnostics.
    }
    return {
        method,
        route,
        status: response.status,
        ok: response.ok,
        json,
        text
    };
};

const pushStep = (steps, id, pass, detail) => {
    steps.push({id, pass, detail});
    if (!pass) {
        const err = new Error(`${id}: ${detail}`);
        err.steps = steps;
        throw err;
    }
};

const toMarkdown = result => {
    const lines = [
        '# 新祥编程购买闭环验收报告',
        '',
        `- 时间: ${result.timestamp}`,
        `- 后端地址: ${result.baseUrl}`,
        `- 用户: ${result.username}`,
        `- 订单: ${result.orderId || '-'}`,
        `- 总体结果: ${result.pass ? 'PASS' : 'FAIL'}`,
        '',
        '## 步骤结果',
        ''
    ];
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

const redact = value => {
    if (Array.isArray(value)) return value.map(redact);
    if (value && typeof value === 'object') {
        return Object.keys(value).reduce((memo, key) => {
            if (['access_token', 'refresh_token'].includes(key)) {
                memo[key] = 'REDACTED';
            } else {
                memo[key] = redact(value[key]);
            }
            return memo;
        }, {});
    }
    return redactValue(value);
};

const seedInactiveRealDbUser = async () => {
    if (!db) return;

    await db.initSchema();
    const pool = db.getPool();

    const [existingRows] = await pool.query(
        'SELECT id FROM users WHERE username = ? LIMIT 1',
        [username]
    );
    if (existingRows.length > 0) {
        await pool.query('DELETE FROM users WHERE id = ?', [existingRows[0].id]);
    }

    if (newUserFlow) {
        return;
    }

    const passwordHash = db.bcrypt.hashSync(password, 10);

    const [result] = await pool.query(
        `INSERT INTO users (username, password_hash, nickname, permission_student, permission_educator)
         VALUES (?, ?, ?, 1, 0)`,
        [username, passwordHash, '新祥编程购买闭环验收账号']
    );
    await pool.query(
        `INSERT INTO entitlements (user_id, status, plan, features_json, device_limit, subscription_expires_at)
         VALUES (?, 'inactive', '', ?, 3, NULL)`,
        [result.insertId, JSON.stringify([])]
    );
};

const runFlow = async baseUrl => {
    const timestamp = nowStamp();
    const steps = [];
    const responses = {};
    let token = null;
    let refreshToken = null;
    let orderId = null;

    responses.health = await requestJson({baseUrl, method: 'GET', route: '/health'});
    pushStep(steps, 'backend_health', responses.health.status === 200, `GET /health -> ${responses.health.status}`);

    if (newUserFlow) {
        responses.register = await requestJson({
            baseUrl,
            method: 'POST',
            route: '/auth/register',
            body: {username, password, nickname}
        });
        const registerPass = responses.register.status === 201 &&
            responses.register.json &&
            responses.register.json.access_token &&
            responses.register.json.entitlement &&
            responses.register.json.entitlement.status === 'inactive';
        pushStep(
            steps,
            'auth_register_new_user',
            Boolean(registerPass),
            `POST /auth/register -> ${responses.register.status}, ` +
                `status=${responses.register.json &&
                    responses.register.json.entitlement &&
                    responses.register.json.entitlement.status}`
        );
        token = responses.register.json.access_token;
        refreshToken = responses.register.json.refresh_token;
    } else {
        responses.login = await requestJson({
            baseUrl,
            method: 'POST',
            route: '/auth/login',
            body: {username, password}
        });
        const loginPass = responses.login.status === 200 &&
            responses.login.json &&
            responses.login.json.access_token;
        pushStep(steps, 'auth_login', Boolean(loginPass), `POST /auth/login -> ${responses.login.status}`);
        token = responses.login.json.access_token;
        refreshToken = responses.login.json.refresh_token;
    }

    responses.entitlementBefore = await requestJson({
        baseUrl,
        method: 'GET',
        route: '/entitlement',
        token
    });
    pushStep(
        steps,
        'entitlement_initial_locked',
        responses.entitlementBefore.status === 200 &&
            responses.entitlementBefore.json &&
            responses.entitlementBefore.json.status === 'inactive',
        `GET /entitlement -> ${responses.entitlementBefore.status}, ` +
            `status=${responses.entitlementBefore.json && responses.entitlementBefore.json.status}`
    );

    responses.createOrder = await requestJson({
        baseUrl,
        method: 'POST',
        route: '/order/create',
        token,
        body: {
            plan: 'family_yearly',
            channel: 'wechat',
            return_url: `${baseUrl}/purchase-flow-return`
        }
    });
    const orderPass = responses.createOrder.status === 200 &&
        responses.createOrder.json &&
        responses.createOrder.json.order_id;
    pushStep(steps, 'order_create', Boolean(orderPass), `POST /order/create -> ${responses.createOrder.status}`);
    orderId = responses.createOrder.json.order_id;

    responses.submitProof = await requestJson({
        baseUrl,
        method: 'POST',
        route: `/order/${orderId}/payment-proof`,
        token,
        body: {
            method: 'wechat',
            paid_at: timestamp,
            amount: (Number(responses.createOrder.json.amount_cents) / 100).toFixed(2),
            currency: responses.createOrder.json.currency,
            transfer_no: `wx${Date.now()}001`,
            trade_no_tail: 'flow001',
            payer_note: 'automated purchase flow'
        }
    });
    pushStep(
        steps,
        'payment_proof_submit',
        responses.submitProof.status === 200 &&
            responses.submitProof.json &&
            responses.submitProof.json.status === 'created' &&
            responses.submitProof.json.payment_proof,
        `POST /order/:id/payment-proof -> ${responses.submitProof.status}`
    );

    responses.pendingOrders = await requestJson({
        baseUrl,
        method: 'GET',
        route: '/admin/orders?status=created&has_payment_proof=1',
        admin: true
    });
    const listed = responses.pendingOrders.status === 200 &&
        responses.pendingOrders.json &&
        Array.isArray(responses.pendingOrders.json.orders) &&
        responses.pendingOrders.json.orders.some(order => order.order_id === orderId);
    pushStep(
        steps,
        'ops_pending_order_listed',
        listed,
        `GET /admin/orders?status=created&has_payment_proof=1 -> ${responses.pendingOrders.status}`
    );

    responses.manualConfirm = await requestJson({
        baseUrl,
        method: 'POST',
        route: `/admin/order/${orderId}/manual-confirm`,
        admin: true,
        body: {
            operator: 'purchase-flow',
            provider_trade_no: `manual-${Date.now()}`,
            amount_cents: responses.createOrder.json.amount_cents,
            currency: responses.createOrder.json.currency,
            note: 'automated purchase flow confirmed'
        }
    });
    pushStep(
        steps,
        'ops_manual_confirm',
        responses.manualConfirm.status === 200 &&
            responses.manualConfirm.json &&
            responses.manualConfirm.json.status === 'fulfilled',
        `POST /admin/order/:id/manual-confirm -> ${responses.manualConfirm.status}`
    );

    responses.orderAfter = await requestJson({
        baseUrl,
        method: 'GET',
        route: `/order/${orderId}/status`,
        token
    });
    pushStep(
        steps,
        'order_fulfilled',
        responses.orderAfter.status === 200 &&
            responses.orderAfter.json &&
            responses.orderAfter.json.status === 'fulfilled',
        `GET /order/:id/status -> ${responses.orderAfter.status}, ` +
            `status=${responses.orderAfter.json && responses.orderAfter.json.status}`
    );

    responses.refresh = await requestJson({
        baseUrl,
        method: 'POST',
        route: '/auth/refresh',
        body: {refresh_token: refreshToken}
    });
    pushStep(
        steps,
        'auth_refresh_after_confirm',
        Boolean(responses.refresh.status === 200 &&
            responses.refresh.json &&
            responses.refresh.json.access_token),
        `POST /auth/refresh -> ${responses.refresh.status}`
    );
    token = responses.refresh.json.access_token;

    responses.entitlementAfter = await requestJson({
        baseUrl,
        method: 'GET',
        route: '/entitlement',
        token
    });
    const entitlementActive = responses.entitlementAfter.status === 200 &&
        responses.entitlementAfter.json &&
        responses.entitlementAfter.json.status === 'active' &&
        Array.isArray(responses.entitlementAfter.json.features) &&
        responses.entitlementAfter.json.features.includes('cloud_save');
    pushStep(
        steps,
        'entitlement_active_unlocked',
        entitlementActive,
        `GET /entitlement -> ${responses.entitlementAfter.status}, ` +
            `status=${responses.entitlementAfter.json && responses.entitlementAfter.json.status}`
    );

    const expiresAt = responses.entitlementAfter.json && responses.entitlementAfter.json.expires_at ?
        new Date(responses.entitlementAfter.json.expires_at).getTime() :
        0;
    const remainingMs = expiresAt - Date.now();
    pushStep(
        steps,
        'family_yearly_extends_365_days',
        remainingMs >= (364 * 24 * 60 * 60 * 1000) &&
            remainingMs <= (366 * 24 * 60 * 60 * 1000),
        `expires_at=${responses.entitlementAfter.json && responses.entitlementAfter.json.expires_at}`
    );

    return {
        timestamp,
        baseUrl,
        username,
        orderId,
        pass: true,
        steps,
        responses
    };
};

const main = async () => {
    await seedInactiveRealDbUser();
    const app = await createApp();
    const server = await new Promise(resolve => {
        const started = app.listen(0, '127.0.0.1', () => resolve(started));
    });
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;
    let result = null;
    try {
        result = await runFlow(baseUrl);
    } catch (err) {
        result = {
            timestamp: nowStamp(),
            baseUrl,
            username,
            orderId: null,
            pass: false,
            steps: err.steps || [],
            responses: {
                error: err.message || String(err)
            }
        };
    } finally {
        await new Promise(resolve => server.close(resolve));
        accessTokens.clear();
        if (db) {
            await db.closePool();
        }
    }

    ensureDir(reportDir);
    const tag = result.timestamp.replace(/[:.]/g, '-');
    const jsonReport = path.join(reportDir, `zhimeng-purchase-flow-${tag}.json`);
    const markdownReport = path.join(reportDir, `zhimeng-purchase-flow-${tag}.md`);
    const redactedResult = redact(result);
    fs.writeFileSync(jsonReport, JSON.stringify(redactedResult, null, 2), 'utf8');
    fs.writeFileSync(markdownReport, toMarkdown(redactedResult), 'utf8');

    // eslint-disable-next-line no-console
    console.log(JSON.stringify({
        pass: result.pass,
        jsonReport,
        markdownReport
    }, null, 2));
    process.exit(result.pass ? 0 : 1);
};

main().catch(err => {
    // eslint-disable-next-line no-console
    console.error(err.message || err);
    process.exit(1);
});
