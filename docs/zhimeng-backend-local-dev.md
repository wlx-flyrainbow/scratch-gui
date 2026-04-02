# 知萌后端（本地最小联调版）

存储为 **MySQL**（默认库名 `zhimeng`，见环境变量 `ZHIMENG_MYSQL_*`）。可先起本地库：

```bash
docker compose up -d
```

默认 root 密码为 `root` 时，启动前可设置：

```bash
export ZHIMENG_MYSQL_PASSWORD=root
```

## 启动

仅后端：

```bash
npm run auth-server
```

**一键：后端 + 前端开发服务**（前端已设置 `ZHIMENG_AUTH_API_BASE=http://localhost:3001`）：

```bash
npm run dev:full
```

浏览器打开开发地址（默认 `http://localhost:8601/`，以终端输出为准）。

默认地址：`http://localhost:3001`

健康检查：

```bash
curl http://localhost:3001/health
```

## 测试账号

- 用户名：`demo`
- 密码：`123456`

## 与前端联调

确保前端环境变量：

```bash
ZHIMENG_AUTH_API_BASE=http://localhost:3001
```

前端会调用：

- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /entitlement`

## 集成测试（后端）

使用独立库 `zhimeng_test`（`docker/mysql-init` 会创建）。需 MySQL 已就绪：

```bash
export ZHIMENG_MYSQL_PASSWORD=root
npm run test:backend
```

## 说明

- 用户、订阅与设备绑定、刷新令牌持久化在 **MySQL**；access token 仍为进程内内存（重启失效）。
- 本地联调与自动化测试请使用独立数据库，勿与生产共用。
- 依赖 `express@4`（与 Jest 21 集成测试兼容）；认证 API 仅使用常规路由/中间件，与 Express 5 无功能差异。

## BMAD 技能（可选）

若在本仓库使用 BMAD Agent skills，克隆或更新 `_bmad/` 后请在项目根目录执行 `npm run bmad:sync`。详见 [bmad-skills-sync.md](./bmad-skills-sync.md)。
