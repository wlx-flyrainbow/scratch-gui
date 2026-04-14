# 知萌：环境变量示例

本地跑认证后端时，可在项目根目录复制 `.env.example` 为 `.env`（或执行 `npm run env:init`），`backend/server.js` 会自动读取 `.env`。

可在启动前注入以下变量：

```bash
ZHIMENG_AUTH_API_BASE=https://api.zhimeng.example.com
ZHIMENG_BILLING_URL=https://billing.zhimeng.example.com
ZHIMENG_REGISTER_URL=https://accounts.zhimeng.example.com/register
ZHIMENG_LEASE_DAYS=7
ZHIMENG_PROJECT_HOST=https://projects.zhimeng.example.com
ZHIMENG_ASSET_HOST=https://assets.zhimeng.example.com
ZHIMENG_BACKPACK_HOST=https://backpack.zhimeng.example.com

# Auth 后端（Node，可选；本地 docker compose 见 docs/zhimeng-backend-local-dev.md）
ZHIMENG_AUTH_PORT=3001
ZHIMENG_MYSQL_HOST=127.0.0.1
ZHIMENG_MYSQL_PORT=3306
# 使用仓库内 docker compose 时映射为 3307，见 docs/zhimeng-backend-local-dev.md
ZHIMENG_MYSQL_USER=root
ZHIMENG_MYSQL_PASSWORD=
ZHIMENG_MYSQL_DATABASE=zhimeng
# 连接超时（毫秒，默认 10000）
ZHIMENG_MYSQL_CONNECT_TIMEOUT=10000

# dev:full 跳过 docker compose（本机已有 MySQL 时）
# ZHIMENG_DEV_SKIP_DOCKER=1

# wait-for-mysql 最长等待（毫秒，默认 120000）
# ZHIMENG_MYSQL_WAIT_MS=120000
```

## 用途

- `ZHIMENG_AUTH_API_BASE`：认证/授权 API 根地址
- `ZHIMENG_BILLING_URL`：支付/账单页入口
- `ZHIMENG_REGISTER_URL`：注册页入口
- `ZHIMENG_LEASE_DAYS`：离线授权租约天数
- `ZHIMENG_PROJECT_HOST`：项目读写服务地址
- `ZHIMENG_ASSET_HOST`：资源服务地址
- `ZHIMENG_BACKPACK_HOST`：Backpack 服务地址（启用背包能力时必填）
- `ZHIMENG_AUTH_PORT`：本地认证服务端口（默认 `3001`）
- `ZHIMENG_MYSQL_*`：认证服务使用的 MySQL 连接（`DATABASE` 默认 `zhimeng`；集成测试建议 `zhimeng_test`）
- `ZHIMENG_MYSQL_CONNECT_TIMEOUT`：MySQL 连接超时（毫秒，默认 `10000`）
