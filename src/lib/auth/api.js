import authConfig from './config';

const AUTH_ERROR_MESSAGES = {
    0: '网络连接失败，请检查网络后重试。',
    400: '提交的信息不完整，请检查后再试。',
    401: '登录状态已失效，请重新登录新祥编程账号。',
    403: '当前账号已被冻结，请联系运营处理。',
    409: '当前账号最多可绑定 3 台设备，请联系运营解绑旧设备后再使用。',
    429: '操作过于频繁，请稍后再试。',
    500: '新祥编程服务暂时不可用，请稍后重试。',
    503: '新祥编程服务暂时不可用，请稍后重试。'
};

const PATH_ERROR_MESSAGES = {
    '/auth/login': {
        400: '请输入账号与密码。',
        401: '账号或密码不正确，请检查后重试。'
    },
    '/auth/register': {
        400: '请使用 3-32 位字母、数字或下划线账号，密码至少 6 位。',
        409: '该账号已被注册，请换一个账号。'
    },
    '/auth/refresh': {
        401: '授权已过期，请重新登录新祥编程账号。'
    },
    '/entitlement': {
        401: '登录状态已失效，请重新登录后刷新授权。'
    },
    '/entitlement/device/bind': {
        403: '当前账号已被冻结，请联系运营处理。',
        409: '当前账号最多可绑定 3 台设备，请联系运营解绑旧设备后再使用。'
    },
    '/entitlement/device/unbind': {
        403: '设备解绑需要联系运营处理。'
    },
    '/order/create': {
        401: '登录状态已失效，请重新登录后再创建订单。',
        403: '当前账号已被冻结，暂时不能创建订单，请联系运营处理。',
        503: '暂时无法创建订单，请稍后重试或联系运营。'
    }
};

const normalizeMessage = (path, status, serverMessage) => {
    const pathMessages = PATH_ERROR_MESSAGES[path] || {};
    if (pathMessages[status]) return pathMessages[status];
    if (status >= 500 && AUTH_ERROR_MESSAGES[status]) return AUTH_ERROR_MESSAGES[status];
    if (AUTH_ERROR_MESSAGES[status]) return AUTH_ERROR_MESSAGES[status];
    return serverMessage || `请求失败，请稍后重试。(${status})`;
};

const request = async (path, options = {}) => {
    let response = null;
    try {
        response = await fetch(`${authConfig.apiBaseUrl}${path}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
        });
    } catch (e) {
        const err = new Error(AUTH_ERROR_MESSAGES[0]);
        err.status = 0;
        err.cause = e;
        throw err;
    }

    if (!response.ok) {
        const text = await response.text();
        let serverMessage = text;
        try {
            const parsed = JSON.parse(text);
            serverMessage = parsed.message || parsed.error || serverMessage;
        } catch (e) {
            // Keep plain text message.
        }
        const err = new Error(normalizeMessage(path, response.status, serverMessage));
        err.status = response.status;
        err.serverMessage = serverMessage;
        throw err;
    }
    return response.status === 204 ? null : response.json();
};

const login = payload => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload)
});

const register = payload => request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload)
});

const refresh = refreshToken => request('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({refresh_token: refreshToken})
});

const fetchEntitlement = accessToken => request('/entitlement', {
    method: 'GET',
    headers: {Authorization: `Bearer ${accessToken}`}
});

const bindDevice = (accessToken, payload) => request('/entitlement/device/bind', {
    method: 'POST',
    headers: {Authorization: `Bearer ${accessToken}`},
    body: JSON.stringify(payload)
});

const logout = refreshToken => request('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({refresh_token: refreshToken})
});

const createOrder = (accessToken, payload) => request('/order/create', {
    method: 'POST',
    headers: {Authorization: `Bearer ${accessToken}`},
    body: JSON.stringify(payload)
});

const getOrderStatus = (accessToken, orderId) => request(`/order/${orderId}/status`, {
    method: 'GET',
    headers: {Authorization: `Bearer ${accessToken}`}
});

const submitPaymentProof = (accessToken, orderId, payload) => request(`/order/${orderId}/payment-proof`, {
    method: 'POST',
    headers: {Authorization: `Bearer ${accessToken}`},
    body: JSON.stringify(payload)
});

// Local-dev helper: simulates payment callback and entitlement activation.
const mockOrderPaid = (accessToken, orderId) => request(`/order/${orderId}/mock-paid`, {
    method: 'POST',
    headers: {Authorization: `Bearer ${accessToken}`}
});

export {
    login,
    register,
    refresh,
    fetchEntitlement,
    bindDevice,
    logout,
    createOrder,
    getOrderStatus,
    submitPaymentProof,
    mockOrderPaid
};
