# 知萌：环境变量示例

本地跑认证后端时，可在项目根目录复制 `.env.example` 为 `.env`（或执行 `npm run env:init`），`backend/server.js` 会自动读取 `.env`。

可在启动前注入以下变量：

```bash
ZHIMENG_AUTH_API_BASE=https://api.zhimeng.example.com
ZHIMENG_BILLING_URL=https://billing.zhimeng.example.com
ZHIMENG_REGISTER_URL=https://accounts.zhimeng.example.com/register
ZHIMENG_LEASE_DAYS=7
ZHIMENG_CLOUD_HOST=cloud.zhimeng.example.com
ZHIMENG_PROJECT_HOST=https://projects.zhimeng.example.com
ZHIMENG_ASSET_HOST=https://assets.zhimeng.example.com
ZHIMENG_BACKPACK_HOST=https://backpack.zhimeng.example.com

# Auth 后端（Node，可选；本地 docker compose 见 docs/zhimeng-backend-local-dev.md）
ZHIMENG_AUTH_PORT=3001
ZHIMENG_ADMIN_TOKEN=replace-with-random-admin-token
ZHIMENG_AUTO_INIT_SCHEMA=0
ZHIMENG_CORS_ORIGINS=https://download.zhimeng.example.com,https://app.zhimeng.example.com
ZHIMENG_JSON_LIMIT=1mb
ZHIMENG_RATE_LIMIT_WINDOW_MS=60000
ZHIMENG_RATE_LIMIT_MAX=600
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
# 仅本地/测试使用：显式开启 mock 支付确认与 demo 用户种子
# ZHIMENG_ENABLE_MOCK_PAYMENT=1
# ZHIMENG_SEED_DEMO_USER=1

# wait-for-mysql 最长等待（毫秒，默认 120000）
# ZHIMENG_MYSQL_WAIT_MS=120000
```

## 用途

- `ZHIMENG_AUTH_API_BASE`：认证/授权 API 根地址
- `ZHIMENG_BILLING_URL`：支付/账单页入口
- `ZHIMENG_REGISTER_URL`：注册页入口
- `ZHIMENG_LEASE_DAYS`：离线授权租约天数
- `ZHIMENG_CLOUD_HOST`：Scratch 云变量 WebSocket 主机（不含 `ws://` / `wss://`；暂不启用云变量时可留空）
- `ZHIMENG_PROJECT_HOST`：项目读写服务地址
- `ZHIMENG_ASSET_HOST`：资源服务地址
- `ZHIMENG_BACKPACK_HOST`：Backpack 服务地址（启用背包能力时必填）
- `ZHIMENG_AUTH_PORT`：本地认证服务端口（默认 `3001`）
- `ZHIMENG_ADMIN_TOKEN`：运营/后台接口令牌，用于受保护的人工确认订单等操作；生产必须使用高强度随机值
- `ZHIMENG_AUTO_INIT_SCHEMA`：生产默认不隐式建表；生产部署请先运行 `npm run db:migrate`，仅明确设为 `1` 时启动自动建表
- `ZHIMENG_CORS_ORIGINS`：允许访问认证 API 的来源白名单，逗号分隔；生产未配置时默认不允许浏览器跨域访问
- `ZHIMENG_JSON_LIMIT`：JSON 请求体大小限制，默认 `1mb`
- `ZHIMENG_RATE_LIMIT_WINDOW_MS` / `ZHIMENG_RATE_LIMIT_MAX`：基础请求限流窗口与最大次数；生产默认 `60000` / `600`
- `ZHIMENG_ENABLE_MOCK_PAYMENT`：仅本地/测试开启 `/order/:id/mock-paid`，生产默认关闭
- `ZHIMENG_SEED_DEMO_USER`：仅本地/测试允许自动创建 `demo` 用户，生产默认关闭
- `ZHIMENG_MYSQL_*`：认证服务使用的 MySQL 连接（`DATABASE` 默认 `zhimeng`；集成测试建议 `zhimeng_test`）
- `ZHIMENG_MYSQL_CONNECT_TIMEOUT`：MySQL 连接超时（毫秒，默认 `10000`）
