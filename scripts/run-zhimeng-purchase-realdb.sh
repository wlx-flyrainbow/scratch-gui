#!/usr/bin/env bash
# Real MySQL purchase-flow acceptance check.
# Uses an isolated MySQL container and removes it after the run by default.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MYSQL_C="${ZHIMENG_PURCHASE_MYSQL_CONTAINER:-zhimeng-purchase-mysql}"
MYSQL_PORT="${ZHIMENG_PURCHASE_MYSQL_PORT:-33307}"
USERNAME="${ZHIMENG_FLOW_USERNAME:-zhimeng_purchase_inactive}"
PASSWORD="${ZHIMENG_FLOW_PASSWORD:-123456}"
ADMIN_TOKEN="${ZHIMENG_ADMIN_TOKEN:-purchase-flow-admin-token}"

docker rm -f "$MYSQL_C" >/dev/null 2>&1 || true

docker run -d --name "$MYSQL_C" \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=zhimeng_purchase \
  -p "127.0.0.1:${MYSQL_PORT}:3306" \
  mysql:8.0 \
  --character-set-server=utf8mb4 \
  --collation-server=utf8mb4_unicode_ci

cleanup() {
  if [ "${ZHIMENG_PURCHASE_KEEP_MYSQL:-}" != "1" ]; then
    docker rm -f "$MYSQL_C" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

READY=0
for _ in $(seq 1 40); do
  if docker exec "$MYSQL_C" mysqladmin ping -h 127.0.0.1 -uroot -proot >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 2
done

if [ "$READY" != "1" ]; then
  echo "run-zhimeng-purchase-realdb: MySQL not ready on 127.0.0.1:${MYSQL_PORT}" >&2
  docker logs "$MYSQL_C" 2>&1 | tail -n 80 >&2 || true
  exit 1
fi

cd "$ROOT"
ZHIMENG_FLOW_USE_REAL_DB=1 \
ZHIMENG_FLOW_NEW_USER="${ZHIMENG_FLOW_NEW_USER:-0}" \
ZHIMENG_FLOW_USERNAME="$USERNAME" \
ZHIMENG_FLOW_PASSWORD="$PASSWORD" \
ZHIMENG_ADMIN_TOKEN="$ADMIN_TOKEN" \
ZHIMENG_AUTO_INIT_SCHEMA=1 \
ZHIMENG_SEED_DEMO_USER=0 \
ZHIMENG_MYSQL_HOST=127.0.0.1 \
ZHIMENG_MYSQL_PORT="$MYSQL_PORT" \
ZHIMENG_MYSQL_USER=root \
ZHIMENG_MYSQL_PASSWORD=root \
ZHIMENG_MYSQL_DATABASE=zhimeng_purchase \
ZHIMENG_PAYMENT_MODE=manual_qr \
ZHIMENG_PAYMENT_API_BASE=http://127.0.0.1:3001 \
ZHIMENG_WECHAT_PAYMENT_QR_URL=http://127.0.0.1:4173/assets/siang_wxpay_qrcode.jpg \
ZHIMENG_ALIPAY_PAYMENT_QR_URL=http://127.0.0.1:4173/assets/siang_alipay_qrcode.jpg \
ZHIMENG_PAYMENT_ACCOUNT_LABEL=新祥编程官方收款 \
npm run test:zhimeng-purchase-flow
