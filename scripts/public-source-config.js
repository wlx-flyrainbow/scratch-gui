const path = require('path');

const root = path.resolve(__dirname, '..');
const defaultTargetDir = path.resolve(root, '..', 'newsiang-client-public');

const publicSourceUrl =
    process.env.ZHIMENG_PUBLIC_SOURCE_URL ||
    'https://github.com/wlx-flyrainbow/newsiang-client-public';

const publicSourceGitUrl =
    process.env.ZHIMENG_PUBLIC_SOURCE_GIT_URL ||
    `${publicSourceUrl.replace(/#.*$/, '').replace(/\/$/, '')}.git`;

const requiredPaths = [
    '.babelrc',
    '.browserslistrc',
    '.editorconfig',
    '.eslintignore',
    '.eslintrc.js',
    '.gitignore',
    '.npmignore',
    '.nvmrc',
    'LICENSE',
    'README.md',
    'docs/agpl-source-disclosure.md',
    'docs/build-and-run.md',
    'docs/public-api.md',
    'docs/release-source-map.md',
    'docs/third-party-notices.md',
    'electron-main.js',
    'electron-preload.js',
    'package-lock.json',
    'package.json',
    'scripts/prepublish.mjs',
    'src',
    'static',
    'webpack.config.js'
];

const copyEntries = [
    '.babelrc',
    '.browserslistrc',
    '.editorconfig',
    '.env.example',
    '.eslintignore',
    '.eslintrc.js',
    '.gitignore',
    '.npmignore',
    '.nvmrc',
    'LICENSE',
    'docs/agpl-source-disclosure.md',
    'electron-main.js',
    'electron-preload.js',
    'package-lock.json',
    'scripts/prepublish.mjs',
    'src',
    'static',
    'webpack.config.js'
];

const allowedDocs = [
    'docs/agpl-source-disclosure.md',
    'docs/build-and-run.md',
    'docs/public-api.md',
    'docs/release-source-map.md',
    'docs/third-party-notices.md'
];

const forbiddenPathPatterns = [
    /(^|\/)\.DS_Store$/i,
    /^\.env$/i,
    /^\.env\.production$/i,
    /^\.secrets(?:\/|$)/i,
    /^_bmad-output(?:\/|$)/i,
    /^backend(?:\/|$)/i,
    /^build(?:\/|$)/i,
    /^data(?:\/|$)/i,
    /^dist(?:\/|$)/i,
    /^docker(?:\/|$)/i,
    /^docker-compose\.ya?ml$/i,
    /^node_modules(?:\/|$)/i,
    /^scripts\/(?:init-env|migrate-zhimeng-db)\.js$/i,
    /^website(?:\/|$)/i,
    /^docs\/zhimeng-/i,
    /\.(?:pem|p12|pfx|key|mobileprovision)$/i
];

const secretPatterns = [
    {
        id: 'private-key',
        pattern: /-----BEGIN (?:RSA |DSA |EC |OPENSSH |)?PRIVATE KEY-----/i
    },
    {
        id: 'aws-access-key',
        pattern: /\bAKIA[0-9A-Z]{16}\b/
    },
    {
        id: 'openai-api-key',
        pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/
    },
    {
        id: 'github-token',
        pattern: /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/
    },
    {
        id: 'google-api-key',
        pattern: /\bAIza[0-9A-Za-z_-]{35}\b/
    },
    {
        id: 'slack-token',
        pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/
    }
];

module.exports = {
    allowedDocs,
    copyEntries,
    defaultTargetDir,
    forbiddenPathPatterns,
    publicSourceGitUrl,
    publicSourceUrl,
    requiredPaths,
    root,
    secretPatterns
};
