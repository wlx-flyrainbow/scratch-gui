# 知萌后端（本地最小联调版）

存储为 **MySQL**（默认库名 `zhimeng`，见环境变量 `ZHIMENG_MYSQL_*`）。

## 推荐：Docker MySQL（本仓库 compose）

Compose 将容器 **3306** 映射到本机 **3307**，避免与本机已有 MySQL（占用 `3306`）冲突。

```bash
npm run docker:mysql
npm run env:init
npm run auth-server
```

`env:init` 会在尚不存在 `.env` 时从 `.env.example` 复制一份。`auth-server` 启动时会自动加载项目根目录 `.env`（该文件已在 `.gitignore` 中，勿提交密钥）。

**一键：后端 + 前端**（`npm run dev:full`）会依次：`docker compose up -d` → 等待本机端口上的 MySQL 可连 → 启动认证服务与 webpack。无 `.env` 时，开发模式会使用与 compose 一致的默认主机/端口/账号（见 `backend/load-local-env.js`）。

```bash
npm run dev:full
```

若 **不用 Docker**、已有本机 MySQL：设置 `ZHIMENG_DEV_SKIP_DOCKER=1`，并在 `.env` 中配置 `ZHIMENG_MYSQL_PORT`（常为 `3306`）与密码。

若 **仅想手动起库** 再开发：先 `npm run docker:mysql`，再 `npm run auth-server` 或 `npm run dev:full:serve`。

## 启动

仅后端（需已配置 `.env` 或已 `export` 相应变量）：

```bash
npm run auth-server
```

仅前端 + 后端联调见上 `dev:full`。

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

使用独立库 `zhimeng_test`（`docker/mysql-init` 会创建）。需 MySQL 已就绪（同上 Docker + `npm run docker:mysql`）。Jest 侧在未设置时会默认 `3307` / `root`，与 compose 一致：

```bash
npm run docker:mysql
npm run test:backend
```

若当前环境 Docker 端口映射受限（例如 `3307` 暴露失败），可使用**无宿主机端口映射**的容器测试脚本：

```bash
npm run test:backend:container
```

该脚本会：

- 启动内部网络 MySQL 容器（不映射宿主机端口）
- 自动等待 MySQL 就绪并创建 `zhimeng_test`
- 注入 `ZHIMENG_MYSQL_*` 后执行 `npm run test:backend`
- 测试结束后自动清理容器（可用 `ZHIMENG_KEEP_MYSQL_CONTAINER=1` 保留）

## 真库 + Docker 内网验收（与 `test:zhimeng-goal` 同一套脚本）

在 **Docker 网络** 内起 MySQL、后端与仅用于「前端 HTTP 探测」的 nginx（默认页），再在 **同一网络** 的 Node 容器里执行 `npm run test:zhimeng-goal`，避免宿主机直连容器 IP 超时等问题。

前置：**Docker**、**bash**（WSL / Linux / Git Bash）。项目根目录已执行过 `npm ci`（脚本会把仓库挂载进后端容器；若缺少 `node_modules` 会在容器内跑一次 `npm ci`）。

```bash
npm run test:zhimeng-goal:realdb
```

报告仍写入 `_bmad-output/test-reports/`。调试时可保留容器与网络：`ZHIMENG_REAL_KEEP_CONTAINERS=1 npm run test:zhimeng-goal:realdb`。可选环境变量：`ZHIMENG_REAL_NET`、`ZHIMENG_REAL_MYSQL_CONTAINER`、`ZHIMENG_REAL_BACKEND_CONTAINER`、`ZHIMENG_REAL_FRONTEND_CONTAINER`、`ZHIMENG_NODE_IMAGE`、`ZHIMENG_AUTH_PORT`。

## 说明

- 用户、订阅与设备绑定、刷新令牌持久化在 **MySQL**；access token 仍为进程内内存（重启失效）。
- 本地联调与自动化测试请使用独立数据库，勿与生产共用。
- 依赖 `express@4`（与 Jest 21 集成测试兼容）；认证 API 仅使用常规路由/中间件，与 Express 5 无功能差异。

## BMAD 技能（可选）

若在本仓库使用 BMAD Agent skills，克隆或更新 `_bmad/` 后请在项目根目录执行 `npm run bmad:sync`。详见 [bmad-skills-sync.md](./bmad-skills-sync.md)。
