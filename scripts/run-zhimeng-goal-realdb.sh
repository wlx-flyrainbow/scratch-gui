#!/usr/bin/env bash
# Real MySQL + backend in Docker network, then run the same goal check as mock mode.
# Requires: Docker, bash. Tested on WSL/Linux (paths use repo root).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NET="${ZHIMENG_REAL_NET:-zhimeng-net}"
MYSQL_C="${ZHIMENG_REAL_MYSQL_CONTAINER:-zhimeng-real-mysql}"
BACKEND_C="${ZHIMENG_REAL_BACKEND_CONTAINER:-zhimeng-real-backend}"
FRONTEND_C="${ZHIMENG_REAL_FRONTEND_CONTAINER:-zhimeng-frontend-static}"
NODE_IMAGE="${ZHIMENG_NODE_IMAGE:-node:20-bullseye}"
AUTH_PORT="${ZHIMENG_AUTH_PORT:-3003}"
CHECK_USERNAME="${ZHIMENG_CHECK_USERNAME:-zhimeng_goal_inactive}"
CHECK_PASSWORD="${ZHIMENG_CHECK_PASSWORD:-123456}"
ADMIN_TOKEN="${ZHIMENG_CHECK_ADMIN_TOKEN:-zhimeng-goal-admin-token}"

docker rm -f "$BACKEND_C" "$FRONTEND_C" "$MYSQL_C" >/dev/null 2>&1 || true
docker network rm "$NET" >/dev/null 2>&1 || true
docker network create "$NET"

docker run -d --name "$MYSQL_C" --network "$NET" \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=zhimeng \
  mysql:8.0 \
  --character-set-server=utf8mb4 \
  --collation-server=utf8mb4_unicode_ci

for _ in $(seq 1 30); do
  if docker exec "$MYSQL_C" mysqladmin ping -h 127.0.0.1 -uroot -proot >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

docker run -d --name "$FRONTEND_C" --network "$NET" nginx:alpine

docker run -d --name "$BACKEND_C" --network "$NET" \
  -e NODE_ENV=production \
  -e "ZHIMENG_ADMIN_TOKEN=$ADMIN_TOKEN" \
  -e "ZHIMENG_AUTH_PORT=$AUTH_PORT" \
  -e ZHIMENG_MYSQL_HOST="$MYSQL_C" \
  -e ZHIMENG_MYSQL_PORT=3306 \
  -e ZHIMENG_MYSQL_USER=root \
  -e ZHIMENG_MYSQL_PASSWORD=root \
  -e ZHIMENG_MYSQL_DATABASE=zhimeng \
  -v "$ROOT:/app" \
  -w /app \
  "$NODE_IMAGE" \
  bash -lc 'test -d node_modules || npm ci --silent; node backend/server.js'

READY=0
for _ in $(seq 1 40); do
  if docker run --rm --network "$NET" "$NODE_IMAGE" node -e \
    "require('http').get('http://$BACKEND_C:$AUTH_PORT/health',(r)=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))" \
    >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 2
done
if [ "$READY" != "1" ]; then
  echo "run-zhimeng-goal-realdb: backend not ready at http://$BACKEND_C:$AUTH_PORT/health" >&2
  docker logs "$BACKEND_C" 2>&1 | tail -n 80 >&2 || true
  docker rm -f "$BACKEND_C" "$FRONTEND_C" "$MYSQL_C" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
  exit 1
fi

docker run --rm --network "$NET" \
  -e ZHIMENG_MYSQL_HOST="$MYSQL_C" \
  -e ZHIMENG_MYSQL_PORT=3306 \
  -e ZHIMENG_MYSQL_USER=root \
  -e ZHIMENG_MYSQL_PASSWORD=root \
  -e ZHIMENG_MYSQL_DATABASE=zhimeng \
  -e "ZHIMENG_CHECK_USERNAME=$CHECK_USERNAME" \
  -e "ZHIMENG_CHECK_PASSWORD=$CHECK_PASSWORD" \
  -v "$ROOT:/app" \
  -w /app \
  "$NODE_IMAGE" \
  bash -lc 'node scripts/seed-zhimeng-goal-user.js'

docker run --rm --network "$NET" \
  -e "ZHIMENG_CHECK_BACKEND_BASE=http://$BACKEND_C:$AUTH_PORT" \
  -e "ZHIMENG_CHECK_FRONTEND_BASE=http://$FRONTEND_C" \
  -e "ZHIMENG_CHECK_USERNAME=$CHECK_USERNAME" \
  -e "ZHIMENG_CHECK_PASSWORD=$CHECK_PASSWORD" \
  -e "ZHIMENG_CHECK_ADMIN_TOKEN=$ADMIN_TOKEN" \
  -e ZHIMENG_CHECK_INITIAL_ENTITLEMENT_STATUS=inactive \
  -e ZHIMENG_CHECK_PAYMENT_MODE=manual-confirm \
  -v "$ROOT:/app" \
  -w /app \
  "$NODE_IMAGE" \
  bash -lc 'npm run test:zhimeng-goal'

EXIT_CODE=$?

if [ "${ZHIMENG_REAL_KEEP_CONTAINERS:-}" != "1" ]; then
  docker rm -f "$BACKEND_C" "$FRONTEND_C" "$MYSQL_C" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
fi

exit "$EXIT_CODE"
