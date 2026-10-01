// Editor behavior tests use the app's existing offline session format. No production
// authentication setting is changed; auth-gate tests explicitly supply locked states.
const createEditorAuthBundle = ({status = 'active', expiredLease = false} = {}) => {
    const now = Date.now();
    const token = 'integration-offline-fixture';
    return {
        tokens: {access_token: token},
        session: {user: {id: 'integration-user', username: 'integration-user', token}},
        entitlement: {
            status,
            features: ['backpack'],
            lease: {
                issuedAt: new Date(now - 1000).toISOString(),
                expiresAt: new Date(now + (expiredLease ? -1000 : 86400000)).toISOString()
            }
        }
    };
};

const editorAuthBundle = createEditorAuthBundle();

export {createEditorAuthBundle, editorAuthBundle};
