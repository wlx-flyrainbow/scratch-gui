/**
 * Backend Jest: align with docker compose (host 3307) when vars unset.
 */
require('../../backend/load-local-env');
if (process.env.ZHIMENG_MYSQL_PORT === undefined) {
    process.env.ZHIMENG_MYSQL_PORT = '3307';
}
if (process.env.ZHIMENG_MYSQL_PASSWORD === undefined) {
    process.env.ZHIMENG_MYSQL_PASSWORD = 'root';
}
