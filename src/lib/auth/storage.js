const AUTH_KEY = 'zhimeng-auth';

const hasBridge = () => typeof window !== 'undefined' && window.zhimengAuth;

const loadAuthBundle = () => {
    if (hasBridge()) return window.zhimengAuth.loadAuth();
    if (typeof window === 'undefined' || !window.localStorage) return Promise.resolve(null);
    const raw = window.localStorage.getItem(AUTH_KEY);
    return Promise.resolve(raw ? JSON.parse(raw) : null);
};

const saveAuthBundle = bundle => {
    if (hasBridge()) return window.zhimengAuth.saveAuth(bundle);
    if (typeof window === 'undefined' || !window.localStorage) return Promise.resolve();
    window.localStorage.setItem(AUTH_KEY, JSON.stringify(bundle));
    return Promise.resolve();
};

const clearAuthBundle = () => {
    if (hasBridge()) return window.zhimengAuth.clearAuth();
    if (typeof window === 'undefined' || !window.localStorage) return Promise.resolve();
    window.localStorage.removeItem(AUTH_KEY);
    return Promise.resolve();
};

export {
    loadAuthBundle,
    saveAuthBundle,
    clearAuthBundle
};
