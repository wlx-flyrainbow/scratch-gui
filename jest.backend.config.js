/**
 * Backend integration tests only (no React / enzyme).
 * Jest 21: map `node:*` builtins so mysql2 / Express resolve (see Node 16+ `node:` prefix).
 */
const nodeBuiltins = [
    'assert', 'buffer', 'child_process', 'cluster', 'crypto', 'dgram', 'dns', 'events',
    'fs', 'http', 'https', 'net', 'os', 'path', 'querystring', 'readline', 'stream',
    'string_decoder', 'tls', 'tty', 'url', 'util', 'v8', 'vm', 'zlib', 'perf_hooks',
    'worker_threads'
];

const moduleNameMapper = {
    '^node:fs/promises$': 'fs/promises'
};
for (const b of nodeBuiltins) {
    moduleNameMapper[`^node:${b}$`] = b;
}

module.exports = {
    testEnvironment: 'node',
    setupFiles: [
        'raf/polyfill',
        '<rootDir>/test/backend/jest-env.js'
    ],
    testMatch: [
        '<rootDir>/test/backend/**/*.test.js',
        '<rootDir>/test/backend/**/*.unit.test.js'
    ],
    testPathIgnorePatterns: [
        'src/test.js'
    ],
    moduleNameMapper
};
