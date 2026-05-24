# 宝塔 + Node 项目部署最佳实践

本文来自知萌在 `codevalley.cn` 的一次真实部署复盘，适用于类似形态的项目：

- 一个静态官网或 H5 前端。
- 一个 Node.js API 服务。
- MySQL 作为业务存储。
- 宝塔面板管理 Nginx、站点、数据库、SSL。
- 同一域名下用 Nginx 将 `/api`、`/auth`、`/health` 等路径反向代理到 Node 后端。

目标不是写成一次性操作记录，而是沉淀成后续项目可复用的部署打法。

## 1. 总体原则

### 先跑通测试环境，再复制到正式环境

测试环境和正式环境必须是两套独立资源：

| 类型 | 测试环境 | 正式环境 |
| --- | --- | --- |
| 域名 | `*-test.example.com` | `*.example.com` |
| Node 端口 | 独立端口，如 `3102` | 独立端口，如 `3101` |
| MySQL 数据库 | 独立库 | 独立库 |
| 环境变量文件 | 独立文件 | 独立文件 |
| 运营口令 | 独立口令 | 独立口令 |

不要用一个进程和一套数据库同时承载测试、正式两种流量。人工确认支付、订单、授权这类业务尤其不能混用。

### 部署动作要能重复执行

每一步都应尽量幂等：

- 目录用 `mkdir -p`。
- 代码用 `git fetch` + `git reset --hard origin/<branch>`。
- 数据库迁移使用 `CREATE TABLE IF NOT EXISTS` 或迁移工具。
- PM2 启动前先 `pm2 delete <name> || true`，再 `pm2 start`。
- 静态文件同步用 `rsync`，但要避开宝塔托管文件。

### 验收以公网结果为准

本机 `127.0.0.1`、服务器内部 `curl`、公网 HTTPS 都要验，但最后判断以公网 HTTPS 为准。

最低验收：

```bash
curl -fsSI https://example.com/
curl -fsS https://example.com/health
curl -fsSI https://example.com/pay.html
curl -fsSI https://example.com/ops.html
curl -fsS https://example.com/releases.json
```

如果项目有登录、下单、付款、运营确认等业务闭环，还要走一遍真实测试流程。

## 2. 推荐目录结构

```text
/www/wwwroot/<app>-app/<repo>          # 代码仓库
/www/wwwroot/<app>                    # 正式静态站
/www/wwwroot/<app>-test               # 测试静态站
/www/wwwroot/<app>-data/prod          # 正式上传文件、凭证等业务数据
/www/wwwroot/<app>-data/test          # 测试上传文件、凭证等业务数据
/www/server/<app>/env                 # 环境变量文件，不能放到公开站点目录
```

不要把 `.env`、运营口令、数据库密码、支付密钥放在 `/www/wwwroot/<site>` 这类公开目录。

环境变量文件权限建议：

```bash
chmod 600 /www/server/<app>/env/*.env
```

## 3. 部署顺序

### 阶段 0：域名和端口规划

先明确：

- 测试域名、正式域名。
- 测试 API 端口、正式 API 端口。
- 哪些路径走静态文件，哪些路径反代到 Node。
- 是否需要 `/health`。
- 下载文件、付款二维码、上传凭证等静态或业务文件存放路径。

推荐同域部署：

```text
/                          静态官网
/pay.html                  付款页
/ops.html                  运营页
/health                    Node API
/auth/*                    Node API
/order/*                   Node API
/admin/*                   Node API
/payment/*                 Node API
/entitlement/*             Node API
```

这样可以减少 CORS、Cookie、HTTPS 混合内容和客户端配置问题。

### 阶段 1：宝塔基础资源

在宝塔里先创建：

- 两个站点。
- 两个数据库。
- Nginx。
- Node.js 20。
- PM2。

如果通过宝塔数据库页面创建数据库失败，并提示“数据库管理密码错误”，说明宝塔保存的 MySQL root 密码和真实 MySQL root 密码漂移了。

处理方式：

1. 先确认已有数据库和业务是否正常。
2. 通过宝塔“root 密码”功能重置 MySQL root 管理密码。
3. 重试创建数据库。

注意：这一步会改变 MySQL root 密码，但不会改变已有业务库用户的密码。仍然要谨慎，最好避开业务高峰。

### 阶段 2：代码和依赖

推荐：

```bash
cd /www/wwwroot/<app>-app
git clone --branch <branch> https://github.com/<org>/<repo>.git
cd <repo>
npm ci --omit=dev --ignore-scripts --legacy-peer-deps --no-audit --no-fund
```

`--ignore-scripts` 不是总是必须，但在以下场景很有价值：

- `prepublish`、`postinstall` 会下载第三方构建资源。
- 服务器只是跑 Node 后端和发布静态站，不需要完整前端构建。
- 外部资源下载慢或被网络阻断，导致部署卡住。

如果项目后端运行依赖安装脚本生成的产物，不能跳过。要先在本地确认运行时依赖边界。

### 阶段 3：环境变量

环境变量要按环境拆分，例如：

```text
/www/server/<app>/env/<app>-test.env
/www/server/<app>/env/<app>-prod.env
```

最少包含：

- `NODE_ENV`
- API 端口。
- 公网 API Base URL。
- CORS Origin。
- MySQL 连接信息。
- 上传目录。
- 运营口令或后台密钥。
- 支付相关配置。
- 下载地址或发布版本信息。

口令生成：

```bash
openssl rand -hex 32
```

加载方式：

```bash
set -a
. /www/server/<app>/env/<app>-prod.env
set +a
npm run db:migrate
```

### 阶段 4：数据库迁移

数据库迁移应显式执行，不建议依赖生产启动时自动初始化。

```bash
set -a
. /www/server/<app>/env/<app>-test.env
set +a
npm run db:migrate

set -a
. /www/server/<app>/env/<app>-prod.env
set +a
npm run db:migrate
```

执行后至少验证：

```bash
curl -fsS http://127.0.0.1:<port>/health
```

接口应明确返回当前存储类型，例如 `storage: mysql`。

### 阶段 5：静态站发布

宝塔站点目录里常见 `.user.ini` 等保护文件，可能无法删除。同步时不要简单 `rsync --delete` 全删。

推荐：

```bash
rsync -a --delete --exclude='.user.ini' website/ /www/wwwroot/<app-test>/
rsync -a --delete --exclude='.user.ini' website/ /www/wwwroot/<app>/
```

下载目录建议独立保留：

```bash
mkdir -p /www/wwwroot/<app>/downloads
mkdir -p /www/wwwroot/<app-test>/downloads
```

如果 `rsync --delete` 会误删安装包目录，要额外排除：

```bash
rsync -a --delete --exclude='.user.ini' --exclude='downloads/' website/ /www/wwwroot/<app>/
```

### 阶段 6：Nginx 反向代理

配置必须同时覆盖 HTTP 和 HTTPS。一个常见问题是 HTTP 已经正常，但 HTTPS 还在旧默认站点。

推荐先写 HTTP，再拿到证书后补 443：

```nginx
server {
    listen 80;
    server_name example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name example.com;

    root /www/wwwroot/example;
    index index.html;

    ssl_certificate /www/server/panel/vhost/cert/example.com/fullchain.pem;
    ssl_certificate_key /www/server/panel/vhost/cert/example.com/privkey.pem;

    client_max_body_size 8m;

    location ~ ^/(auth|entitlement|order|admin|payment|health)(/|$) {
        proxy_pass http://127.0.0.1:3101;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 60s;
    }

    location = /releases.json {
        add_header Cache-Control "public, max-age=300";
        try_files $uri =404;
    }

    location /downloads/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

验证：

```bash
nginx -t
/www/server/nginx/sbin/nginx -s reload || /www/server/nginx/sbin/nginx
```

宝塔环境里 `systemctl reload nginx` 可能失败，因为 Nginx 不一定由 systemd 管理。优先用宝塔 Nginx 路径或 `/etc/init.d/nginx reload`。

### 阶段 7：PM2 启动

测试环境：

```bash
set -a
. /www/server/<app>/env/<app>-test.env
set +a
pm2 start backend/server.js --name <app>-api-test --update-env
```

正式环境：

```bash
set -a
. /www/server/<app>/env/<app>-prod.env
set +a
pm2 start backend/server.js --name <app>-api-prod --update-env
pm2 save
```

如果 PM2 提示 in-memory 版本落后，可以后续窗口执行：

```bash
pm2 update
pm2 save
```

不要在业务启动失败时先忽略 PM2 状态。最低要看到：

```bash
pm2 status
curl -fsS http://127.0.0.1:<port>/health
```

### 阶段 8：SSL

宝塔申请 Let's Encrypt 后，可能出现“证书已签发并落盘，但自定义 Nginx 配置没有挂上 443 server”的情况。

排查证书：

```bash
find /www/server/panel/vhost -maxdepth 4 -type f \
  \( -name 'fullchain.pem' -o -name 'privkey.pem' \)
```

常见路径：

```text
/www/server/panel/vhost/cert/<domain>/fullchain.pem
/www/server/panel/vhost/cert/<domain>/privkey.pem
/www/server/panel/vhost/letsencrypt/<domain>/fullchain.pem
/www/server/panel/vhost/letsencrypt/<domain>/privkey.pem
```

如果 HTTPS 返回旧站点或默认页：

1. 确认 443 server block 是否存在。
2. 确认 `server_name` 是否是目标域名。
3. 确认证书路径是否存在。
4. `nginx -t`。
5. 重载宝塔 Nginx。
6. `curl -k -I https://domain/` 看是否命中新站点。

## 4. 知萌这次部署踩坑复盘

### MySQL 管理密码漂移

现象：

```text
数据库管理密码错误
```

影响：

- 宝塔无法创建新数据库。
- MySQL root 免密也不可用。

处理：

- 用宝塔数据库 root 密码功能重置 root 管理密码。
- 再创建 `zhimeng_test`、`zhimeng_prod`。

后续最佳实践：

- 不依赖 root 跑业务。
- 每个项目创建独立数据库用户。
- root 密码变更要记录在运维密钥管理工具，不写进仓库。

### npm 安装脚本卡外部下载

现象：

```text
Downloading https://downloads.scratch.mit.edu/microbit/scratch-microbit.hex.zip
```

长时间不继续。

处理：

- 停止卡住的安装进程。
- 改用 `npm ci --omit=dev --ignore-scripts --legacy-peer-deps --no-audit --no-fund`。

后续最佳实践：

- 后端服务部署和前端构建拆开。
- 构建产物在 CI 或本地生成，服务器只拉运行时依赖。
- 必须下载的构建资源提前缓存到自有对象存储。

### `.user.ini` 阻止静态站同步

现象：

```text
rsync: delete_file: unlink(.user.ini) failed: Operation not permitted
```

处理：

```bash
rsync -a --delete --exclude='.user.ini' website/ /www/wwwroot/<site>/
```

后续最佳实践：

- 所有宝塔站点同步命令默认排除 `.user.ini`。
- 需要保留的 `downloads/`、`uploads/`、`storage/` 也默认排除。

### Nginx 服务不是 systemd active

现象：

```text
nginx.service is not active, cannot reload.
```

但 `nginx -t` 正常，Nginx 实际可用。

处理：

```bash
/etc/init.d/nginx reload || /www/server/nginx/sbin/nginx -s reload || /www/server/nginx/sbin/nginx
```

后续最佳实践：

- 宝塔环境不要默认假设 `systemctl reload nginx` 可用。
- 始终先 `nginx -t`，再按实际进程管理方式 reload。

### HTTPS 命中旧默认页

现象：

- HTTP 首页是新站点。
- HTTPS 返回旧页面或默认页。

原因：

- 80 server block 配好了。
- 443 server block 没有配，或证书未挂到当前站点配置。

处理：

- 确认证书已存在。
- 手动补全 `listen 443 ssl http2` 的 server block。
- 重载 Nginx。
- 再用 HTTPS 公网校验。

后续最佳实践：

- “HTTP 200” 不等于部署完成。
- 所有上线验收必须以 HTTPS 为主。

## 5. 标准验收清单

### 服务器内部

```bash
pm2 status
curl -fsS http://127.0.0.1:<test-port>/health
curl -fsS http://127.0.0.1:<prod-port>/health
curl -fsSI http://127.0.0.1/ -H 'Host: test.example.com'
curl -fsSI http://127.0.0.1/ -H 'Host: example.com'
```

### 公网 HTTP/HTTPS

```bash
curl -fsSI http://test.example.com/
curl -fsSI https://test.example.com/
curl -fsS https://test.example.com/health

curl -fsSI http://example.com/
curl -fsSI https://example.com/
curl -fsS https://example.com/health
```

### 静态资源

```bash
curl -fsSI https://example.com/pay.html
curl -fsSI https://example.com/ops.html
curl -fsS https://example.com/releases.json
curl -fsSI https://example.com/assets/logo.png
```

### 业务闭环

按真实用户路径验证：

1. 打开官网。
2. 下载或进入客户端。
3. 注册新账号。
4. 登录。
5. 创建订单。
6. 展示付款二维码。
7. 提交付款凭证。
8. 运营页看到待确认订单。
9. 运营确认到账。
10. 客户端刷新授权。
11. 进入完整功能。

## 6. 回滚策略

### 代码回滚

```bash
cd /www/wwwroot/<app>-app/<repo>
git fetch origin
git reset --hard <previous-good-commit>
npm ci --omit=dev --ignore-scripts --legacy-peer-deps --no-audit --no-fund
pm2 restart <app>-api-prod --update-env
```

### 静态站回滚

发布前保存一份：

```bash
tar -czf /www/backup/<app>-site-$(date +%Y%m%d%H%M%S).tar.gz -C /www/wwwroot/<app> .
```

回滚：

```bash
tar -xzf /www/backup/<backup>.tar.gz -C /www/wwwroot/<app>
nginx -t
/www/server/nginx/sbin/nginx -s reload
```

### 数据库回滚

生产迁移前先做宝塔数据库备份。订单、支付凭证、授权数据属于业务账本，不能随意删库重建。

## 7. 上线前决策

上线前至少确认：

- 是否已有真实安装包上传到 `/downloads/`。
- `releases.json` 是否指向真实 HTTPS URL。
- 付款二维码是否为当前收款主体。
- 测试价格是否已经切回正式价格。
- 测试运营口令和正式运营口令是否不同。
- 正式数据库是否为空或经过确认的数据。
- 证书是否能自动续签。
- 是否有最低限度备份任务。
- 客户端构建时注入的 API Base 是否指向正确环境。

## 8. 推荐的下一步工程化

为了把部署从“人工操作”升级为“可重复交付”，建议后续补齐：

- `deploy/scripts/bootstrap-server.sh`：安装 Node、pm2、目录初始化。
- `deploy/scripts/deploy-static.sh`：同步静态站并保护 `.user.ini`、`downloads/`。
- `deploy/scripts/deploy-api.sh`：拉代码、安装依赖、迁移数据库、重启 PM2。
- `deploy/scripts/verify-public.sh`：公网验收。
- `deploy/nginx/*.conf`：每个域名一份完整 HTTP + HTTPS 模板。
- `deploy/env/*.example`：不含真实密钥的环境模板。

脚本要支持：

```bash
./deploy/scripts/deploy-api.sh test
./deploy/scripts/deploy-api.sh prod
./deploy/scripts/verify-public.sh test
./deploy/scripts/verify-public.sh prod
```

这样后续项目只需要替换项目名、域名、端口和路径，而不是重新摸一遍宝塔面板。
