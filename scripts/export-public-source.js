const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const {
    copyEntries,
    defaultTargetDir,
    publicSourceGitUrl,
    publicSourceUrl,
    root
} = require('./public-source-config');

const parseArgs = () => {
    const args = process.argv.slice(2);
    const result = {
        clean: true,
        sourceRef: process.env.ZHIMENG_PUBLIC_SOURCE_REF || '',
        target: process.env.ZHIMENG_PUBLIC_SOURCE_DIR || defaultTargetDir
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--no-clean') {
            result.clean = false;
        } else if (arg === '--target') {
            result.target = args[++i];
        } else if (arg.startsWith('--target=')) {
            result.target = arg.slice('--target='.length);
        } else if (arg === '--source-ref') {
            result.sourceRef = args[++i];
        } else if (arg.startsWith('--source-ref=')) {
            result.sourceRef = arg.slice('--source-ref='.length);
        } else {
            throw new Error(`Unknown argument: ${arg}`);
        }
    }

    result.target = path.resolve(root, result.target);
    result.sourceRef = result.sourceRef.trim();
    return result;
};

const relative = filePath => path.relative(root, filePath) || '.';

const assertSafeTarget = target => {
    const rel = path.relative(root, target);
    if (!rel || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
        throw new Error(`Refusing to export inside the core repository: ${target}`);
    }
};

const ensureDir = dir => fs.mkdirSync(dir, {recursive: true});

const runGitBuffer = args => childProcess.execFileSync('git', args, {
    cwd: root,
    maxBuffer: 100 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore']
});

const gitRefPath = (sourceRef, relativePath) => `${sourceRef}:${relativePath.split(path.sep).join('/')}`;

const gitObjectType = (sourceRef, relativePath) => {
    try {
        return childProcess.execFileSync('git', ['cat-file', '-t', gitRefPath(sourceRef, relativePath)], {
            cwd: root,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore']
        }).trim();
    } catch (err) {
        return '';
    }
};

const readSourceFile = (sourceRelativePath, sourceRef) => {
    if (sourceRef) {
        return runGitBuffer(['show', gitRefPath(sourceRef, sourceRelativePath)]);
    }
    return fs.readFileSync(path.join(root, sourceRelativePath));
};

const sourcePathExists = (sourceRelativePath, sourceRef) => {
    if (sourceRef) {
        return Boolean(gitObjectType(sourceRef, sourceRelativePath));
    }
    return fs.existsSync(path.join(root, sourceRelativePath));
};

const copyPath = (sourceRelativePath, targetRoot) => {
    const src = path.join(root, sourceRelativePath);
    const dest = path.join(targetRoot, sourceRelativePath);

    if (!fs.existsSync(src)) {
        throw new Error(`Required export source is missing: ${sourceRelativePath}`);
    }

    ensureDir(path.dirname(dest));
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
        fs.cpSync(src, dest, {recursive: true});
    } else {
        fs.copyFileSync(src, dest);
    }
};

const exportArchiveFromRef = (sourceRef, targetRoot) => {
    for (const entry of copyEntries) {
        if (!sourcePathExists(entry, sourceRef)) {
            throw new Error(`Required export source is missing in ${sourceRef}: ${entry}`);
        }
    }

    const archive = childProcess.spawnSync(
        'git',
        ['archive', '--format=tar', sourceRef, '--', ...copyEntries],
        {
            cwd: root,
            encoding: null,
            maxBuffer: 500 * 1024 * 1024
        }
    );
    if (archive.error) throw archive.error;
    if (archive.status !== 0) {
        const stderr = archive.stderr ? archive.stderr.toString('utf8').trim() : '';
        throw new Error(`git archive failed for ${sourceRef}: ${stderr}`);
    }

    const tar = childProcess.spawnSync(
        'tar',
        ['-xf', '-', '-C', targetRoot],
        {
            encoding: 'utf8',
            input: archive.stdout
        }
    );
    if (tar.error) throw tar.error;
    if (tar.status !== 0) {
        throw new Error(`tar extraction failed for ${sourceRef}: ${tar.stderr.trim()}`);
    }
};

const cleanTarget = target => {
    ensureDir(target);
    for (const entry of fs.readdirSync(target)) {
        if (entry === '.git') continue;
        fs.rmSync(path.join(target, entry), {force: true, recursive: true});
    }
};

const runGit = args => {
    try {
        return childProcess.execFileSync('git', args, {
            cwd: root,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore']
        }).trim();
    } catch (err) {
        return '';
    }
};

const coreRevision = sourceRef => {
    if (sourceRef) {
        return runGit(['rev-parse', `${sourceRef}^{commit}`]) || sourceRef;
    }
    return runGit(['rev-parse', 'HEAD']) || 'unknown';
};

const coreStatus = (paths = []) => {
    const args = ['status', '--short'];
    if (paths.length > 0) {
        args.push('--', ...paths);
    }
    return runGit(args);
};

const exportInputPaths = () => Array.from(new Set([
    ...copyEntries,
    'package.json',
    'scripts/check-public-source.js',
    'scripts/export-public-source.js',
    'scripts/public-source-config.js'
]));

const readPackageJson = sourceRef => JSON.parse(readSourceFile('package.json', sourceRef).toString('utf8'));

const publicPackageJson = pkg => {
    const scripts = pkg.scripts || {};
    const publicScripts = {
        'build': scripts.build,
        'clean': scripts.clean,
        'start': scripts.start,
        'prepublish': scripts.prepublish,
        'electron': scripts.electron,
        'electron-dev': scripts['electron-dev'],
        'pack': scripts.pack,
        'dist': scripts.dist,
        'dist:mac': scripts['dist:mac'],
        'dist:mac:arm64': scripts['dist:mac:arm64'],
        'dist:mac:x64': scripts['dist:mac:x64'],
        'dist:mac:all': scripts['dist:mac:all'],
        'dist:win': scripts['dist:win'],
        'dist:linux': scripts['dist:linux'],
        'watch': scripts.watch,
        'test:lint': scripts['test:lint']
    };

    return {
        ...pkg,
        homepage: `${publicSourceUrl}#readme`,
        repository: {
            type: 'git',
            url: publicSourceGitUrl
        },
        scripts: publicScripts
    };
};

const writeFile = (targetRoot, relativePath, content) => {
    const fullPath = path.join(targetRoot, relativePath);
    ensureDir(path.dirname(fullPath));
    fs.writeFileSync(fullPath, content);
};

const nodeVersion = sourceRef => {
    if (!sourcePathExists('.nvmrc', sourceRef)) {
        return '20.x';
    }
    return readSourceFile('.nvmrc', sourceRef)
        .toString('utf8')
        .trim();
};

const buildAndRunDoc = (pkg, sourceRef) => `# Build and Run

This public repository contains the AGPL-covered corresponding source for the
NewSiang desktop client.

## Requirements

- Node.js ${nodeVersion(sourceRef)}
- npm

## Install

\`\`\`bash
npm install
npm run prepublish
\`\`\`

If the micro:bit download is blocked in your network, download
\`scratch-microbit.hex.zip\` separately and run:

\`\`\`bash
SCRATCH_MICROBIT_HEX_ZIP=/path/to/scratch-microbit.hex.zip npm run prepublish
\`\`\`

## Build the web client

\`\`\`bash
npm run build
\`\`\`

## Run the web client locally

\`\`\`bash
npm start
\`\`\`

## Run the desktop shell

\`\`\`bash
npm run electron-dev
\`\`\`

## Auth API

The public client expects an auth and entitlement API. Production service
implementation, user data, payment operations, and deployment details are not
included in this public source export. See \`docs/public-api.md\` for the
client-facing contract.

## Release version

Package version: ${pkg.version}
`;

const publicApiDoc = () => `# Public Client API

The public client talks to an auth and entitlement service through HTTP APIs.
The production service implementation, secrets, user data, and operations data
are not included in this public source repository.

Client-facing API groups:

- \`POST /auth/register\`
- \`POST /auth/login\`
- \`POST /auth/refresh\`
- \`POST /auth/logout\`
- \`GET /entitlement\`
- \`POST /entitlement/device/bind\`
- \`POST /order/create\`
- \`GET /order/:id/status\`
- \`POST /order/:id/payment-proof\`
- \`GET /order/:id/payment-page\`

The client treats server entitlement as the source of truth. UI state alone is
not a payment or authorization boundary.
`;

const thirdPartyNoticesDoc = pkg => `# Third-Party Notices

This project is licensed as ${pkg.license}.

Third-party packages are declared in \`package.json\` and \`package-lock.json\`.
Install dependencies with \`npm install\` to retrieve their published license
metadata from the npm registry.

Keep upstream copyright and license notices intact when redistributing modified
versions of this client.
`;

const noticeText = () => `NOTICE

This source release includes software licensed under the GNU Affero General
Public License v3.0 (AGPLv3).

Corresponding Source for the released client is available from this repository.
`;

const publicEnvExample = () => `# Public client configuration example.
# Copy to .env for local development if you want to point the client at an auth service.

ZHIMENG_AUTH_API_BASE=http://localhost:3001
ZHIMENG_BILLING_URL=http://localhost:3001
# ZHIMENG_REGISTER_URL=http://localhost:3001/register
`;

const releaseSourceMapDoc = (pkg, revision, sourceRef, sourceStatus, fullStatus) => {
    const sourceDirtyText = sourceStatus ? 'yes' : 'no';
    const sourceText = sourceRef ? `git ref ${sourceRef}` : 'working tree';
    const fullStatusLine = sourceRef ?
        '' :
        `- Core working tree had any uncommitted changes: ${fullStatus ? 'yes' : 'no'}\n`;

    return `# Release Source Map

- Package version: ${pkg.version}
- Export source: ${sourceText}
- Core repository commit: ${revision}
- Export generated at: ${new Date().toISOString()}
- Exported source inputs had uncommitted changes: ${sourceDirtyText}
${fullStatusLine}

For a public release, the final installer should point to the public repository
tag created from this exported source tree.
`;
};

const publicReadme = pkg => `# 新祥编程客户端公开源码

This repository contains the public AGPL corresponding source for the
NewSiang / 新祥编程 desktop client.

It is generated from the internal core repository and intentionally excludes
production secrets, certificates, user data, payment proofs, operations notes,
commercial plans, and private service implementations.

## License

- License: ${pkg.license}
- Source disclosure: \`docs/agpl-source-disclosure.md\`
- Build and run: \`docs/build-and-run.md\`
- Release source map: \`docs/release-source-map.md\`

## Quick Start

\`\`\`bash
npm install
npm run prepublish
npm run build
npm start
\`\`\`

For desktop packaging:

\`\`\`bash
npm run electron-dev
\`\`\`
`;

const writeGeneratedFiles = (target, pkg, revision, sourceRef, sourceStatus, fullStatus) => {
    writeFile(target, '.env.example', publicEnvExample());
    writeFile(target, 'package.json', `${JSON.stringify(publicPackageJson(pkg), null, 2)}\n`);
    writeFile(target, 'NOTICE', noticeText());
    writeFile(target, 'README.md', publicReadme(pkg));
    writeFile(target, 'docs/build-and-run.md', buildAndRunDoc(pkg, sourceRef));
    writeFile(target, 'docs/public-api.md', publicApiDoc());
    writeFile(
        target,
        'docs/release-source-map.md',
        releaseSourceMapDoc(pkg, revision, sourceRef, sourceStatus, fullStatus)
    );
    writeFile(target, 'docs/third-party-notices.md', thirdPartyNoticesDoc(pkg));
};

const main = () => {
    const {clean, sourceRef, target} = parseArgs();
    assertSafeTarget(target);
    if (clean) cleanTarget(target);
    ensureDir(target);

    if (sourceRef) {
        exportArchiveFromRef(sourceRef, target);
    } else {
        for (const entry of copyEntries) {
            copyPath(entry, target);
        }
    }

    const pkg = readPackageJson(sourceRef);
    const revision = coreRevision(sourceRef);
    const sourceStatus = sourceRef ? '' : coreStatus(exportInputPaths());
    const fullStatus = sourceRef ? '' : coreStatus();
    writeGeneratedFiles(target, pkg, revision, sourceRef, sourceStatus, fullStatus);

    console.log(`Exported public source to ${relative(target)}`);
    if (sourceRef) {
        console.log(`Export source ref: ${sourceRef}`);
    }
    console.log(`Core revision: ${revision}`);
    if (sourceStatus) {
        console.log('Exported source inputs have uncommitted changes; release-source-map.md records them.');
    }
    if (fullStatus) {
        console.log('Core working tree has uncommitted changes; release-source-map.md records them.');
    }
};

try {
    main();
} catch (err) {
    console.error(err.message || err);
    process.exit(1);
}
