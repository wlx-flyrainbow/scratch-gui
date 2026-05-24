/**
 * Load project root `.env` into process.env (does not override existing vars).
 * No dotenv dependency — single-file parser for KEY=VAL lines.
 */
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
    /* Local dev defaults (match docker-compose host port 3307). Skip in production without .env. */
    if (process.env.NODE_ENV !== 'production') {
        if (process.env.ZHIMENG_MYSQL_HOST === undefined) {
            process.env.ZHIMENG_MYSQL_HOST = '127.0.0.1';
        }
        if (process.env.ZHIMENG_MYSQL_PORT === undefined) {
            process.env.ZHIMENG_MYSQL_PORT = '3307';
        }
        if (process.env.ZHIMENG_MYSQL_USER === undefined) {
            process.env.ZHIMENG_MYSQL_USER = 'root';
        }
        if (process.env.ZHIMENG_MYSQL_PASSWORD === undefined) {
            process.env.ZHIMENG_MYSQL_PASSWORD = 'root';
        }
        if (process.env.ZHIMENG_MYSQL_DATABASE === undefined) {
            process.env.ZHIMENG_MYSQL_DATABASE = 'zhimeng';
        }
        if (process.env.ZHIMENG_PLAN_FAMILY_YEARLY_AMOUNT_CENTS === undefined) {
            process.env.ZHIMENG_PLAN_FAMILY_YEARLY_AMOUNT_CENTS = '1';
        }
    }
    module.exports = {loaded: false, defaults: true};
} else {
    const text = fs.readFileSync(envPath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith('#')) {
            continue;
        }
        const i = t.indexOf('=');
        if (i === -1) {
            continue;
        }
        const key = t.slice(0, i).trim();
        let val = t.slice(i + 1).trim();
        if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
        ) {
            val = val.slice(1, -1);
        }
        if (process.env[key] === undefined) {
            process.env[key] = val;
        }
    }
    module.exports = {loaded: true, defaults: false};
}
