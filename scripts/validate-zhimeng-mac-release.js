const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');
const requireSigned = process.env.ZHIMENG_REQUIRE_MAC_SIGNED === '1';
const failures = [];
const warnings = [];

const run = (command, args) => {
    try {
        childProcess.execFileSync(command, args, {stdio: 'pipe'});
        return true;
    } catch (err) {
        return false;
    }
};

const findApps = dir => {
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir, {withFileTypes: true});
    return entries.flatMap(entry => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name.endsWith('.app')) return [fullPath];
        if (entry.isDirectory()) return findApps(fullPath);
        return [];
    });
};

if (fs.existsSync(distDir)) {
    const apps = findApps(distDir);
    if (apps.length === 0) {
        warnings.push(
            'No .app bundle found under dist/; DMG-only outputs must be mounted before signature validation.'
        );
    }

    apps.forEach(appPath => {
        const relativePath = path.relative(root, appPath);
        const signed = run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath]);
        const accepted = run('spctl', ['--assess', '--type', 'execute', '--verbose=2', appPath]);

        if (!signed) {
            const message = `${relativePath} is not signed with a valid macOS code signature.`;
            if (requireSigned) failures.push(message);
            else warnings.push(message);
        }
        if (!accepted) {
            const message = `${relativePath} is not accepted by Gatekeeper assessment.`;
            if (requireSigned) failures.push(message);
            else warnings.push(message);
        }
    });
} else {
    warnings.push('dist/ does not exist; run a macOS package build before mac release validation.');
}

if (warnings.length > 0) {
    console.warn('Zhimeng mac release warnings:');
    warnings.forEach(message => console.warn(`- ${message}`));
}

if (failures.length > 0) {
    console.error('Zhimeng mac release check failed:');
    failures.forEach(message => console.error(`- ${message}`));
    process.exit(1);
}

if (requireSigned && warnings.length > 0) {
    console.error(
        'Zhimeng mac release check failed: signature validation was required but no app bundle was verified.'
    );
    process.exit(1);
}

console.log('Zhimeng mac release check passed.');
