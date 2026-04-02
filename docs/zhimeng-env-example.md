# 知萌：环境变量示例

可在启动前注入以下变量：

```bash
ZHIMENG_AUTH_API_BASE=https://api.zhimeng.example.com
ZHIMENG_BILLING_URL=https://billing.zhimeng.example.com
ZHIMENG_REGISTER_URL=https://accounts.zhimeng.example.com/register
ZHIMENG_LEASE_DAYS=7
ZHIMENG_PROJECT_HOST=https://projects.zhimeng.example.com
ZHIMENG_ASSET_HOST=https://assets.zhimeng.example.com

# Auth 后端（Node，可选；本地 docker compose 见 docs/zhimeng-backend-local-dev.md）
ZHIMENG_AUTH_PORT=3001
ZHIMENG_MYSQL_HOST=127.0.0.1
ZHIMENG_MYSQL_PORT=3306
ZHIMENG_MYSQL_USER=root
ZHIMENG_MYSQL_PASSWORD=
ZHIMENG_MYSQL_DATABASE=zhimeng
# 连接超时（毫秒，默认 10000）
ZHIMENG_MYSQL_CONNECT_TIMEOUT=10000
```

## 用途

- `ZHIMENG_AUTH_API_BASE`：认证/授权 API 根地址
- `ZHIMENG_BILLING_URL`：支付/账单页入口
- `ZHIMENG_REGISTER_URL`：注册页入口
- `ZHIMENG_LEASE_DAYS`：离线授权租约天数
- `ZHIMENG_PROJECT_HOST`：项目读写服务地址
- `ZHIMENG_ASSET_HOST`：资源服务地址
- `ZHIMENG_AUTH_PORT`：本地认证服务端口（默认 `3001`）
- `ZHIMENG_MYSQL_*`：认证服务使用的 MySQL 连接（`DATABASE` 默认 `zhimeng`；集成测试建议 `zhimeng_test`）
- `ZHIMENG_MYSQL_CONNECT_TIMEOUT`：MySQL 连接超时（毫秒，默认 `10000`）
