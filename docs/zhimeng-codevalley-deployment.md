# 知萌 codevalley.cn 宝塔部署计划

> 通用部署复盘与最佳实践见：[宝塔 + Node 项目部署最佳实践](./bt-node-deployment-best-practices.md)。本计划是知萌当前域名和端口的落地版本。

## 1. 域名与环境

当前阿里云 DNS 已将以下域名解析到 `39.106.81.189`：

| 环境 | 域名 | 用途 | 后端端口 | 数据库 | 价格 |
| --- | --- | --- | --- | --- | --- |
| 测试 | `zhimeng-test.codevalley.cn` | 先跑通公网购买闭环 | `3102` | `zhimeng_test` | `0.01` 元 |
| 正式 | `zhimeng.codevalley.cn` | 对外发布与售卖 | `3101` | `zhimeng_prod` | `199` 元 |

两个域名都采用同域部署：

- `/`：官网下载页
- `/pay.html`：付款页
- `/ops.html`：运营确认工作台
- `/auth/*`、`/order/*`、`/admin/*`、`/entitlement/*`、`/payment/*`、`/health`：反向代理到 Node 后端

这样客户端、付款页、运营页都使用同一个 HTTPS Origin，减少 CORS 和跳转风险。

## 2. 服务器目录

建议在宝塔 SSH 终端执行：

```bash
mkdir -p /www/wwwroot/zhimeng-app
mkdir -p /www/wwwroot/zhimeng
mkdir -p /www/wwwroot/zhimeng-test
mkdir -p /www/wwwroot/zhimeng-data/prod/payment-proofs
mkdir -p /www/wwwroot/zhimeng-data/test/payment-proofs
mkdir -p /www/server/zhimeng/env
```

目录说明：

- `/www/wwwroot/zhimeng-app/scratch-gui`：代码仓库
- `/www/wwwroot/zhimeng`：正式静态站根目录
- `/www/wwwroot/zhimeng-test`：测试静态站根目录
- `/www/wwwroot/zhimeng-data/*/payment-proofs`：用户付款截图/凭证附件
- `/www/server/zhimeng/env`：环境变量文件，不放在站点公开目录

## 3. 宝塔面板准备

1. 软件商店安装：
   - Nginx
   - MySQL
   - PM2 管理器或 Node 项目管理器
   - Node.js 20 LTS（建议与本地 `v20.19.0` 保持一致）
2. 网站中创建两个站点：
   - `zhimeng-test.codevalley.cn`，根目录 `/www/wwwroot/zhimeng-test`
   - `zhimeng.codevalley.cn`，根目录 `/www/wwwroot/zhimeng`
3. SSL 中分别申请 Let's Encrypt 证书，并开启强制 HTTPS。
4. MySQL 中创建两个数据库和用户：
   - `zhimeng_test` / `zhimeng_test`
   - `zhimeng_prod` / `zhimeng_prod`

## 4. 上传代码

```bash
cd /www/wwwroot/zhimeng-app
git clone git@github.com:wlx-flyrainbow/scratch-gui.git
cd scratch-gui
git checkout feat/electron
npm ci
```

若服务器没有 GitHub SSH key，可先用 HTTPS clone，或在本地打包上传代码压缩包。

## 5. 配置环境变量

将仓库中的模板复制到服务器环境目录：

```bash
cp deploy/env/zhimeng-test.env.example /www/server/zhimeng/env/zhimeng-test.env
cp deploy/env/zhimeng-prod.env.example /www/server/zhimeng/env/zhimeng-prod.env
chmod 600 /www/server/zhimeng/env/zhimeng-test.env /www/server/zhimeng/env/zhimeng-prod.env
```

必须替换：

- `ZHIMENG_ADMIN_TOKEN`：运营口令，至少 32 位随机值
- `ZHIMENG_MYSQL_PASSWORD`：对应数据库密码
- 正式环境二维码 URL：上线前替换为正式微信/支付宝收款码
- 正式环境价格：默认 `19900` 分，即 `199` 元

生成随机运营口令示例：

```bash
openssl rand -hex 32
```

## 6. 初始化数据库

测试库：

```bash
cd /www/wwwroot/zhimeng-app/scratch-gui
set -a
. /www/server/zhimeng/env/zhimeng-test.env
set +a
npm run db:migrate
```

正式库：

```bash
set -a
. /www/server/zhimeng/env/zhimeng-prod.env
set +a
npm run db:migrate
```

生产环境不建议设置 `ZHIMENG_AUTO_INIT_SCHEMA=1`，数据库迁移应显式执行。

## 7. 发布静态站

先发布测试站：

```bash
rsync -av --delete --exclude='.user.ini' website/ /www/wwwroot/zhimeng-test/
mkdir -p /www/wwwroot/zhimeng-test/downloads
```

发布正式站：

```bash
rsync -av --delete --exclude='.user.ini' website/ /www/wwwroot/zhimeng/
mkdir -p /www/wwwroot/zhimeng/downloads
```

安装包先放：

- 测试：`/www/wwwroot/zhimeng-test/downloads/`
- 正式：`/www/wwwroot/zhimeng/downloads/`

后续下载量变大后再迁到 OSS/CDN。

当前正式首发版本采用知萌独立产品版本 `1.0.0`，不要继续使用上游 Scratch 的 `5.2.16`。正式站下载目录应存在：

```text
/www/wwwroot/zhimeng/downloads/zhimeng-setup-1.0.0.exe
/www/wwwroot/zhimeng/downloads/zhimeng-portable-1.0.0.exe
/www/wwwroot/zhimeng/downloads/zhimeng-mac-arm64-1.0.0.dmg
/www/wwwroot/zhimeng/downloads/zhimeng-mac-x64-1.0.0.dmg
```

发布顺序：

1. 先上传四个 `1.0.0` 安装包。
2. 确认四个下载 URL 都返回 `200`。
3. 再同步 `website/releases.json` 和官网静态文件。
4. 最后打开 `https://zhimeng.codevalley.cn/` 确认展示“当前版本 1.0.0”。

验证：

```bash
curl -fsSI https://zhimeng.codevalley.cn/downloads/zhimeng-setup-1.0.0.exe
curl -fsSI https://zhimeng.codevalley.cn/downloads/zhimeng-portable-1.0.0.exe
curl -fsSI https://zhimeng.codevalley.cn/downloads/zhimeng-mac-arm64-1.0.0.dmg
curl -fsSI https://zhimeng.codevalley.cn/downloads/zhimeng-mac-x64-1.0.0.dmg
curl -fsS https://zhimeng.codevalley.cn/releases.json
```

## 8. 启动后端

测试环境：

```bash
cd /www/wwwroot/zhimeng-app/scratch-gui
set -a
. /www/server/zhimeng/env/zhimeng-test.env
set +a
pm2 start backend/server.js --name zhimeng-api-test --update-env
pm2 save
```

正式环境：

```bash
set -a
. /www/server/zhimeng/env/zhimeng-prod.env
set +a
pm2 start backend/server.js --name zhimeng-api-prod --update-env
pm2 save
```

重启：

```bash
pm2 restart zhimeng-api-test --update-env
pm2 restart zhimeng-api-prod --update-env
```

查看日志：

```bash
pm2 logs zhimeng-api-test
pm2 logs zhimeng-api-prod
```

## 9. 配置 Nginx

仓库已提供可复制模板：

- `deploy/bt/nginx/zhimeng-test.codevalley.cn.conf`
- `deploy/bt/nginx/zhimeng.codevalley.cn.conf`

在宝塔站点配置中：

1. 保留宝塔生成的 SSL 证书路径。
2. 将 `location ~ ^/(auth|entitlement|order|admin|payment|health)` 反代配置复制到对应站点。
3. 测试站反代到 `127.0.0.1:3102`。
4. 正式站反代到 `127.0.0.1:3101`。
5. 保存后重载 Nginx。

SSH 验证：

```bash
nginx -t
systemctl reload nginx
```

## 10. 客户端打包注意

桌面客户端的 API 地址在构建时注入。测试包和正式包必须分别构建。

测试包：

```bash
set -a
. /www/server/zhimeng/env/zhimeng-test.env
set +a
npm run dist:mac:arm64
npm run dist:mac:x64
npm run dist:win
```

正式包：

```bash
set -a
. /www/server/zhimeng/env/zhimeng-prod.env
set +a
npm run dist:mac:arm64
npm run dist:mac:x64
npm run dist:win
```

生成后上传到对应站点的 `downloads/`，再运行：

```bash
set -a
. /www/server/zhimeng/env/zhimeng-test.env
set +a
npm run release:update-downloads
rsync -av website/releases.json /www/wwwroot/zhimeng-test/releases.json
```

正式环境同理，换成 `zhimeng-prod.env` 和 `/www/wwwroot/zhimeng/releases.json`。

## 11. 测试环境验收

先验 `zhimeng-test.codevalley.cn`：

```bash
curl https://zhimeng-test.codevalley.cn/health
curl -I https://zhimeng-test.codevalley.cn/
curl -I https://zhimeng-test.codevalley.cn/pay.html
curl -I https://zhimeng-test.codevalley.cn/ops.html
```

人工流程：

1. 打开测试客户端。
2. 注册新账号。
3. 点击订阅解锁。
4. 使用 `0.01` 元测试二维码付款。
5. 提交付款凭证。
6. 打开 `https://zhimeng-test.codevalley.cn/ops.html`。
7. 输入测试运营口令。
8. 核对订单并确认到账。
9. 客户端刷新授权，应进入完整编辑器。

测试通过后再部署正式环境。

## 12. 正式上线验收

正式域名上线前检查：

- `https://zhimeng.codevalley.cn/` 可访问。
- `https://zhimeng.codevalley.cn/releases.json` 中四个下载 URL 都是正式 HTTPS 地址。
- `https://zhimeng.codevalley.cn/health` 返回 `ok: true`。
- 正式二维码能展示。
- 正式运营口令不与测试环境相同。
- 正式数据库为空或仅包含已确认迁移数据。
- macOS 正式包完成签名与公证后再对外下载。

## 13. 回滚

代码回滚：

```bash
cd /www/wwwroot/zhimeng-app/scratch-gui
git log --oneline -5
git checkout <previous-good-commit>
npm ci
set -a
. /www/server/zhimeng/env/zhimeng-prod.env
set +a
pm2 restart zhimeng-api-prod --update-env
```

静态站回滚：保留上一次 `website/` 目录压缩包，出问题时解压覆盖站点根目录并重载 Nginx。

数据库回滚：正式迁移前先在宝塔做数据库备份，避免人工确认订单数据丢失。
