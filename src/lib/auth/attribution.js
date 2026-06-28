const STORAGE_KEY = 'zhimengAttribution';

const safeText = (value, limit = 128) => String(value || '')
    .trim()
    .slice(0, limit);

const hasAttribution = attribution => Object.keys(attribution)
    .some(key => Boolean(attribution[key]));

const fromSearchParams = search => {
    const params = new URLSearchParams(search || '');
    const referrerCode = safeText(
        params.get('referrer_code') ||
        params.get('ref') ||
        params.get('teacher') ||
        params.get('channel'),
        64
    );
    const landingPageId = safeText(params.get('landing_page_id') || params.get('landing'), 96);
    const referrerName = safeText(params.get('referrer_name'), 128);
    const teacherName = safeText(params.get('teacher_name'), 128);
    const teacherId = safeText(params.get('teacher_id'), 64);
    const sourceType = safeText(params.get('source_type') || (referrerCode ? 'kol' : ''), 64);
    const attribution = {};
    if (referrerCode) attribution.referrer_code = referrerCode;
    if (landingPageId) attribution.landing_page_id = landingPageId;
    if (referrerName) attribution.referrer_name = referrerName;
    if (teacherName) attribution.teacher_name = teacherName;
    if (teacherId) attribution.teacher_id = teacherId;
    if (sourceType) attribution.source_type = sourceType;
    return attribution;
};

const readStoredAttribution = () => {
    if (typeof window === 'undefined' || !window.localStorage) return {};
    try {
        const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
        return {};
    }
};

const writeStoredAttribution = attribution => {
    if (typeof window === 'undefined' || !window.localStorage || !hasAttribution(attribution)) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...attribution,
        captured_at: new Date().toISOString()
    }));
};

const getOrderAttribution = () => {
    if (typeof window === 'undefined') return {};
    const fromUrl = fromSearchParams(window.location.search);
    if (hasAttribution(fromUrl)) {
        writeStoredAttribution(fromUrl);
        return fromUrl;
    }
    return readStoredAttribution();
};

export {
    getOrderAttribution,
    fromSearchParams
};
