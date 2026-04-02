const SET_SESSION = 'session/SET_SESSION';
const CLEAR_SESSION = 'session/CLEAR_SESSION';
const SET_PERMISSIONS = 'session/SET_PERMISSIONS';
const SET_ENTITLEMENT = 'session/SET_ENTITLEMENT';

const initialState = {
    // Keep the shape compatible with existing checks:
    // state.session.session.user.{token, username}
    session: null,
    permissions: {},
    entitlement: null,
    lease: {
        expiresAt: null,
        lastValidatedAt: null
    }
};

const setSession = session => ({
    type: SET_SESSION,
    session
});

const clearSession = () => ({
    type: CLEAR_SESSION
});

const setPermissions = permissions => ({
    type: SET_PERMISSIONS,
    permissions
});

const setEntitlement = entitlement => ({
    type: SET_ENTITLEMENT,
    entitlement
});

const reducer = (state = initialState, action) => {
    switch (action.type) {
    case SET_SESSION:
        return {
            ...state,
            session: action.session
        };
    case CLEAR_SESSION:
        return {
            ...initialState,
            // Keep "session" key defined so menu-bar can render Sign in/Join flow.
            session: null
        };
    case SET_PERMISSIONS:
        return {
            ...state,
            permissions: action.permissions || {}
        };
    case SET_ENTITLEMENT: {
        const now = new Date().toISOString();
        const expiresAt = action.entitlement && action.entitlement.lease ?
            action.entitlement.lease.expiresAt :
            null;
        return {
            ...state,
            entitlement: action.entitlement || null,
            lease: {
                expiresAt: expiresAt,
                lastValidatedAt: now
            }
        };
    }
    default:
        return state;
    }
};

export {
    reducer as default,
    initialState as sessionInitialState,
    setSession,
    clearSession,
    setPermissions,
    setEntitlement
};
