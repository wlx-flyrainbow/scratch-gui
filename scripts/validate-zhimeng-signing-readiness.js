const childProcess = require('child_process');
const os = require('os');

const requireSigning = process.env.ZHIMENG_REQUIRE_CODE_SIGNING === '1';
const allowUnsignedSeed = process.env.ZHIMENG_ALLOW_UNSIGNED_SEED_RELEASE === '1';
const failures = [];
const warnings = [];

const value = key => String(process.env[key] || '').trim();

const hasAny = keys => keys.some(key => Boolean(value(key)));

const addFailure = (id, message) => {
    failures.push({id, message});
};

const addWarning = (id, message) => {
    warnings.push({id, message});
};

const warnOrFail = (id, message) => {
    if (requireSigning && !allowUnsignedSeed) {
        addFailure(id, message);
    } else {
        addWarning(id, message);
    }
};

const runText = (command, args) => {
    try {
        return childProcess.execFileSync(command, args, {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe']
        });
    } catch (err) {
        return '';
    }
};

const hasMacLocalIdentity = () => {
    if (os.platform() !== 'darwin') return false;
    const identities = runText('security', ['find-identity', '-v', '-p', 'codesigning']);
    return /Developer ID Application:/i.test(identities);
};

const hasMacSigningMaterial = () => (
    hasMacLocalIdentity() ||
    hasAny(['CSC_LINK', 'CSC_NAME']) ||
    hasAny(['ZHIMENG_MAC_DEVELOPER_ID'])
);

const hasMacNotarizationMaterial = () => (
    (
        hasAny(['APPLE_ID']) &&
        hasAny(['APPLE_APP_SPECIFIC_PASSWORD']) &&
        hasAny(['APPLE_TEAM_ID'])
    ) ||
    (
        hasAny(['APPLE_API_KEY']) &&
        hasAny(['APPLE_API_KEY_ID']) &&
        hasAny(['APPLE_API_ISSUER'])
    )
);

const hasWindowsSigningMaterial = () => (
    hasAny(['WIN_CSC_LINK', 'CSC_LINK', 'ZHIMENG_WINDOWS_CERT_PATH']) &&
    hasAny(['WIN_CSC_KEY_PASSWORD', 'CSC_KEY_PASSWORD', 'ZHIMENG_WINDOWS_CERT_PASSWORD'])
);

if (allowUnsignedSeed) {
    addWarning(
        'ZHIMENG_ALLOW_UNSIGNED_SEED_RELEASE',
        'unsigned seed release is explicitly allowed; do not use this mode for public paid distribution'
    );
}

if (!hasMacSigningMaterial()) {
    warnOrFail(
        'mac.signing',
        [
            'macOS public distribution requires a Developer ID Application certificate',
            'or electron-builder CSC_* signing material'
        ].join(' ')
    );
}

if (!hasMacNotarizationMaterial()) {
    warnOrFail(
        'mac.notarization',
        [
            'macOS public distribution requires Apple notarization credentials:',
            'APPLE_ID/APPLE_APP_SPECIFIC_PASSWORD/APPLE_TEAM_ID',
            'or APPLE_API_KEY/APPLE_API_KEY_ID/APPLE_API_ISSUER'
        ].join(' ')
    );
}

if (!hasWindowsSigningMaterial()) {
    warnOrFail(
        'windows.signing',
        [
            'Windows public distribution requires a code signing certificate via',
            'WIN_CSC_LINK/CSC_LINK and matching password'
        ].join(' ')
    );
}

if (warnings.length > 0) {
    console.warn('Zhimeng signing readiness warnings:');
    warnings.forEach(warning => console.warn(`- ${warning.id}: ${warning.message}`));
}

if (failures.length > 0) {
    console.error('Zhimeng signing readiness check failed:');
    failures.forEach(failure => console.error(`- ${failure.id}: ${failure.message}`));
    process.exit(1);
}

console.log(
    requireSigning && !allowUnsignedSeed ?
        'Zhimeng signing readiness check passed for public distribution.' :
        'Zhimeng signing readiness check completed; warnings are allowed outside public distribution.'
);
