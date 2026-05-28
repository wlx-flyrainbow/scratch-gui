const fs = require('fs');
const path = require('path');

const {
    allowedDocs,
    defaultTargetDir,
    forbiddenPathPatterns,
    requiredPaths,
    root,
    secretPatterns
} = require('./public-source-config');

const failures = [];
const warnings = [];

const parseArgs = () => {
    const args = process.argv.slice(2);
    let target = process.env.ZHIMENG_PUBLIC_SOURCE_DIR || defaultTargetDir;

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--target') {
            target = args[++i];
        } else if (arg.startsWith('--target=')) {
            target = arg.slice('--target='.length);
        } else {
            throw new Error(`Unknown argument: ${arg}`);
        }
    }

    return path.resolve(root, target);
};

const toPosix = value => value.split(path.sep).join('/');

const addFailure = (id, message) => failures.push({id, message});

const walk = (dir, files = []) => {
    if (!fs.existsSync(dir)) return files;

    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
        if (entry.name === '.git') continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(fullPath, files);
        } else if (entry.isFile()) {
            files.push(fullPath);
        }
    }

    return files;
};

const relativeToTarget = (target, filePath) => toPosix(path.relative(target, filePath));

const isTextFile = filePath => {
    const ext = path.extname(filePath).toLowerCase();
    return [
        '',
        '.css',
        '.html',
        '.js',
        '.json',
        '.jsx',
        '.md',
        '.mjs',
        '.sh',
        '.sql',
        '.svg',
        '.txt',
        '.yml'
    ].includes(ext);
};

const checkRequiredPaths = target => {
    for (const requiredPath of requiredPaths) {
        if (!fs.existsSync(path.join(target, requiredPath))) {
            addFailure(requiredPath, `${requiredPath} must exist in the public source export`);
        }
    }
};

const checkForbiddenPaths = (target, files) => {
    const allPaths = new Set();
    const collect = dir => {
        if (!fs.existsSync(dir)) return;
        for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
            if (entry.name === '.git') continue;
            const fullPath = path.join(dir, entry.name);
            const rel = relativeToTarget(target, fullPath);
            allPaths.add(rel);
            if (entry.isDirectory()) collect(fullPath);
        }
    };

    collect(target);

    for (const rel of allPaths) {
        for (const pattern of forbiddenPathPatterns) {
            if (pattern.test(rel)) {
                addFailure(rel, `${rel} must not be exported to the public source repository`);
            }
        }
    }

    for (const filePath of files) {
        const rel = relativeToTarget(target, filePath);
        if (/payment-proof|付款凭证|seed-user|真实订单|用户数据/i.test(rel)) {
            addFailure(rel, `${rel} looks like user, payment, seed, or operations data`);
        }
    }
};

const checkDocsWhitelist = (target, files) => {
    const allowed = new Set(allowedDocs);
    for (const filePath of files) {
        const rel = relativeToTarget(target, filePath);
        if (rel.startsWith('docs/') && !allowed.has(rel)) {
            addFailure(rel, `${rel} is not in the public docs whitelist`);
        }
    }
};

const checkContent = (target, files) => {
    for (const filePath of files) {
        const rel = relativeToTarget(target, filePath);
        const stat = fs.statSync(filePath);
        if (stat.size > 2 * 1024 * 1024 || !isTextFile(filePath)) continue;

        const text = fs.readFileSync(filePath, 'utf8');
        for (const {id, pattern} of secretPatterns) {
            if (pattern.test(text)) {
                addFailure(rel, `${rel} matched high-risk secret pattern: ${id}`);
            }
        }
    }
};

const checkPackage = target => {
    const packagePath = path.join(target, 'package.json');
    if (!fs.existsSync(packagePath)) return;

    let pkg;
    try {
        pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    } catch (err) {
        addFailure('package.json', `package.json must be valid JSON: ${err.message}`);
        return;
    }

    if (pkg.license !== 'AGPL-3.0-only') {
        addFailure('package.license', 'package.json license must remain AGPL-3.0-only');
    }

    const scripts = pkg.scripts || {};
    ['build', 'start', 'prepublish', 'electron-dev'].forEach(scriptName => {
        if (!scripts[scriptName]) {
            addFailure(`package.scripts.${scriptName}`, `${scriptName} script must exist`);
        }
    });

    const scriptText = JSON.stringify(scripts);
    [
        'deploy:',
        'release:',
        'verify-public',
        'auth-server',
        'db:migrate',
        'docker:mysql',
        'env:init',
        'backend/server.js',
        'docker compose',
        'run-zhimeng-goal',
        'run-zhimeng-purchase'
    ].forEach(needle => {
        if (scriptText.includes(needle)) {
            addFailure('package.scripts', `public package scripts must not include internal script marker ${needle}`);
        }
    });
};

const printResults = target => {
    warnings.forEach(warning => {
        console.warn(`[public-source warning] ${warning.id}: ${warning.message}`);
    });

    if (failures.length > 0) {
        failures.forEach(failure => {
            console.error(`[public-source failure] ${failure.id}: ${failure.message}`);
        });
        console.error(`Public source check failed for ${target}.`);
        process.exit(1);
    }

    console.log(`Public source check passed for ${target}.`);
};

const main = () => {
    const target = parseArgs();
    if (!fs.existsSync(target)) {
        addFailure('target', `public source target does not exist: ${target}`);
        printResults(target);
        return;
    }

    const files = walk(target);
    if (files.length === 0) {
        addFailure('target', `public source target is empty: ${target}`);
    }

    checkRequiredPaths(target);
    checkForbiddenPaths(target, files);
    checkDocsWhitelist(target, files);
    checkContent(target, files);
    checkPackage(target);
    printResults(target);
};

try {
    main();
} catch (err) {
    console.error(err.message || err);
    process.exit(1);
}
