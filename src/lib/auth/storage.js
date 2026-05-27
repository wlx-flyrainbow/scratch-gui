const AUTH_KEY = 'zhimeng-auth';
const DEVICE_KEY = 'zhimeng-device-identity';

const hasBridge = () => typeof window !== 'undefined' && window.zhimengAuth;

const createDeviceId = () => {
    if (
        typeof window !== 'undefined' &&
        window.crypto &&
        typeof window.crypto.randomUUID === 'function'
    ) {
        return `zm_${window.crypto.randomUUID()}`;
    }
    return `zm_${Date.now()}_${Math.random().toString(36)
        .slice(2)}`;
};

const defaultDeviceName = () => {
    if (typeof window === 'undefined') return 'unknown-device';
    return `新祥编程客户端 ${window.navigator && window.navigator.platform ?
        window.navigator.platform :
        'unknown'}`;
};

const normalizeDeviceIdentity = identity => {
    if (identity && identity.device_id) {
        return {
            device_id: identity.device_id,
            device_name: identity.device_name || defaultDeviceName()
        };
    }
    return {
        device_id: createDeviceId(),
        device_name: defaultDeviceName()
    };
};

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

const saveDeviceIdentity = identity => {
    if (hasBridge() && window.zhimengAuth.saveDevice) {
        return window.zhimengAuth.saveDevice(identity);
    }
    if (typeof window === 'undefined' || !window.localStorage) return Promise.resolve();
    window.localStorage.setItem(DEVICE_KEY, JSON.stringify(identity));
    return Promise.resolve();
};

const loadDeviceIdentity = async () => {
    let identity = null;
    if (hasBridge() && window.zhimengAuth.loadDevice) {
        identity = await window.zhimengAuth.loadDevice();
    } else if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(DEVICE_KEY);
        identity = raw ? JSON.parse(raw) : null;
    }
    const normalized = normalizeDeviceIdentity(identity);
    await saveDeviceIdentity(normalized);
    return normalized;
};

export {
    loadAuthBundle,
    saveAuthBundle,
    clearAuthBundle,
    loadDeviceIdentity
};
