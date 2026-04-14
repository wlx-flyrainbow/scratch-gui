import authConfig from './config';

const request = async (path, options = {}) => {
    const response = await fetch(`${authConfig.apiBaseUrl}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });

    if (!response.ok) {
        const text = await response.text();
        let message = text;
        try {
            const parsed = JSON.parse(text);
            message = parsed.message || parsed.error || message;
        } catch (e) {
            // Keep plain text message.
        }
        const err = new Error(message || `Request failed: ${response.status}`);
        err.status = response.status;
        throw err;
    }
    return response.status === 204 ? null : response.json();
};

const login = payload => request('/auth/login', {
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

// Local-dev helper: simulates payment callback and entitlement activation.
const mockOrderPaid = (accessToken, orderId) => request(`/order/${orderId}/mock-paid`, {
    method: 'POST',
    headers: {Authorization: `Bearer ${accessToken}`}
});

export {
    login,
    refresh,
    fetchEntitlement,
    logout,
    createOrder,
    getOrderStatus,
    mockOrderPaid
};
