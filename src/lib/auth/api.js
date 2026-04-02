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
        throw new Error(message || `Request failed: ${response.status}`);
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

export {
    login,
    refresh,
    fetchEntitlement,
    logout
};
