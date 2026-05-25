const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');
const requireSigned = process.env.ZHIMENG_REQUIRE_MAC_SIGNED === '1';
const failures = [];
const warnings = [];
const checkedApps = new Set();

const run = (command, args) => {
    try {
        childProcess.execFileSync(command, args, {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe']
        });
        return {ok: true, output: ''};
    } catch (err) {
        return {
            ok: false,
            output: String(`${err.stdout || ''}${err.stderr || ''}`).trim()
        };
    }
};

const collectPaths = (dir, predicate) => {
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir, {withFileTypes: true});
    return entries.flatMap(entry => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name.endsWith('.app')) {
            return predicate(fullPath, entry) ? [fullPath] : [];
        }
        if (entry.isDirectory()) return collectPaths(fullPath, predicate);
        return predicate(fullPath, entry) ? [fullPath] : [];
    });
};

const findApps = dir => collectPaths(
    dir,
    (fullPath, entry) => entry.isDirectory() && fullPath.endsWith('.app')
);

const findDmgs = dir => collectPaths(
    dir,
    (fullPath, entry) => entry.isFile() && /\.dmg$/i.test(fullPath)
);

const configuredDmgPaths = () => {
    const raw = process.env.ZHIMENG_MAC_RELEASE_DMG_PATHS || '';
    if (!raw.trim()) return [];
    return raw
        .split(path.delimiter)
        .map(item => item.trim())
        .filter(Boolean)
        .map(item => path.resolve(root, item));
};

const report = (id, message) => {
    if (requireSigned) failures.push(`${id}: ${message}`);
    else warnings.push(`${id}: ${message}`);
};

const firstLine = output => String(output || '').split(/\r?\n/).find(Boolean) || 'command failed';

const checkApp = (appPath, source) => {
    const key = fs.realpathSync.native(appPath);
    if (checkedApps.has(key)) return;
    checkedApps.add(key);

    const relativePath = path.relative(root, appPath);
    const label = relativePath.startsWith('..') ? appPath : relativePath;
    const sourceLabel = source ? ` from ${source}` : '';
    const signed = run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath]);
    const accepted = run('spctl', ['--assess', '--type', 'execute', '--verbose=2', appPath]);

    if (!signed.ok) {
        report(
            label,
            `is not signed with a valid macOS code signature${sourceLabel}: ${firstLine(signed.output)}`
        );
    }
    if (!accepted.ok) {
        report(
            label,
            `is not accepted by Gatekeeper assessment${sourceLabel}: ${firstLine(accepted.output)}`
        );
    }
};

const attachDmg = dmgPath => {
    const mountPoint = fs.mkdtempSync(path.join(os.tmpdir(), 'zhimeng-mac-release-'));
    const result = run('hdiutil', [
        'attach',
        dmgPath,
        '-mountpoint',
        mountPoint,
        '-nobrowse',
        '-readonly'
    ]);
    if (!result.ok) {
        fs.rmSync(mountPoint, {force: true, recursive: true});
        return {ok: false, output: result.output};
    }
    return {ok: true, mountPoint};
};

const detachDmg = mountPoint => {
    run('hdiutil', ['detach', mountPoint]);
    fs.rmSync(mountPoint, {force: true, recursive: true});
};

const checkDmg = dmgPath => {
    const relativePath = path.relative(root, dmgPath);
    const label = relativePath.startsWith('..') ? dmgPath : relativePath;

    if (!fs.existsSync(dmgPath)) {
        report(label, 'DMG file does not exist');
        return [];
    }

    const verified = run('hdiutil', ['verify', dmgPath]);
    if (!verified.ok) {
        report(label, `DMG checksum verification failed: ${firstLine(verified.output)}`);
        return [];
    }

    const attached = attachDmg(dmgPath);
    if (!attached.ok) {
        report(label, `DMG could not be mounted: ${firstLine(attached.output)}`);
        return [];
    }

    try {
        const apps = findApps(attached.mountPoint);
        if (apps.length === 0) {
            report(label, 'DMG does not contain a .app bundle');
            return [];
        }
        apps.forEach(appPath => checkApp(appPath, label));
        return apps;
    } finally {
        detachDmg(attached.mountPoint);
    }
};

if (fs.existsSync(distDir)) {
    const apps = findApps(distDir);
    const dmgs = findDmgs(distDir);
    if (apps.length === 0 && dmgs.length === 0) {
        warnings.push(
            'No .app or .dmg artifact found under dist/; run a macOS package build before mac release validation.'
        );
    }

    apps.forEach(appPath => checkApp(appPath));
    dmgs.forEach(dmgPath => checkDmg(dmgPath));
} else {
    warnings.push('dist/ does not exist; run a macOS package build before mac release validation.');
}

configuredDmgPaths().forEach(dmgPath => checkDmg(dmgPath));

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
