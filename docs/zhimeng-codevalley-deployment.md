# 新祥编程 codevalley.cn 远程服务器部署指南

> 通用部署复盘与最佳实践见：[宝塔 + Node 项目部署最佳实践](./bt-node-deployment-best-practices.md)。本文是新祥编程当前 `codevalley.cn` 域名、宝塔、Nginx、PM2、MySQL 的落地 Runbook。

本文分两种场景：

- **新服务器首次部署**：服务器还没有代码仓库、站点目录、环境变量、PM2 服务和数据库结构。
- **已有服务器版本更新**：服务器已经部署过，只需要发布新代码、新静态页、新安装包或新环境配置。

## 0. 当前域名与部署模型

目标部署模型如下。2026-06-28 远程部署复核结果：

- `zhimeng.codevalley.cn` 公共 DNS 已解析到 `39.106.81.189`，生产 HTTPS、API 和静态站可公网验收。
- `zhimeng-test.codevalley.cn` 的 Nginx、HTTPS、API 和静态目录已在 `39.106.81.189` 配好，但 1.1.1.1、8.8.8.8 和服务器本机 DNS 暂未解析该测试域名；外部测试前需要补 DNS 记录，临时验收可使用 `curl --resolve zhimeng-test.codevalley.cn:443:39.106.81.189 ...`。

| 环境 | 域名 | 用途 | 后端端口 | 数据库 | 价格 |
| --- | --- | --- | --- | --- | --- |
| 测试 | `zhimeng-test.codevalley.cn` | 先跑通公网购买闭环 | `3102` | `zhimeng_test` | `0.01` 元 |
| 正式 | `zhimeng.codevalley.cn` | 对外发布与售卖 | `3101` | `zhimeng_prod` | 家庭年卡 199 元，7 天陪跑包 699 元 |

两个域名都采用同域部署：

- `/`：官网下载页。
- `/pay.html`：付款页。
- `/ops.html`：运营确认工作台。
- `/releases.json`：客户端下载清单。
- `/downloads/*`：桌面安装包。
- `/auth/*`、`/order/*`、`/admin/*`、`/entitlement/*`、`/payment/*`、`/health`：反向代理到 Node 后端。

这样客户端、付款页、运营页都使用同一个 HTTPS Origin，减少 CORS 和跳转风险。

## 1. 新服务器首次部署

适用场景：新 ECS、新宝塔环境、或服务器上没有 `/www/wwwroot/zhimeng-app/scratch-gui`。

### 1.1 本地先推送代码

服务器部署脚本默认拉 `origin/feat/electron`，所以本地提交后必须先 push：

```bash
cd /Users/apple/wanlexiang/personProject/scratch-gui
git push origin feat/electron
```

### 1.2 宝塔面板准备

在宝塔软件商店安装：

- Nginx
- MySQL
- PM2 管理器或 Node 项目管理器
- Node.js 20 LTS，建议与本地 `v20.19.0` 保持一致

在宝塔网站中创建两个站点：

- `zhimeng-test.codevalley.cn`，根目录 `/www/wwwroot/zhimeng-test`
- `zhimeng.codevalley.cn`，根目录 `/www/wwwroot/zhimeng`

在 SSL 中分别申请 Let's Encrypt 证书，并开启强制 HTTPS。

在 MySQL 中创建两个数据库和用户：

- `zhimeng_test` / `zhimeng_test`
- `zhimeng_prod` / `zhimeng_prod`

### 1.3 拉取代码并初始化目录

在服务器 SSH 中执行：

```bash
mkdir -p /www/wwwroot/zhimeng-app
cd /www/wwwroot/zhimeng-app
git clone git@github.com:wlx-flyrainbow/scratch-gui.git
cd scratch-gui
git checkout feat/electron

bash deploy/scripts/bootstrap-server.sh --yes
```

如果服务器没有 GitHub SSH key，可用 HTTPS clone，或本地打包上传代码压缩包。

初始化后目录结构应为：

- `/www/wwwroot/zhimeng-app/scratch-gui`：代码仓库。
- `/www/wwwroot/zhimeng`：正式静态站根目录。
- `/www/wwwroot/zhimeng-test`：测试静态站根目录。
- `/www/wwwroot/zhimeng-data/prod/payment-proofs`：正式付款凭证附件。
- `/www/wwwroot/zhimeng-data/test/payment-proofs`：测试付款凭证附件。
- `/www/server/zhimeng/env`：环境变量文件，不放在站点公开目录。

### 1.4 配置环境变量

复制模板：

```bash
cp deploy/env/zhimeng-test.env.example /www/server/zhimeng/env/zhimeng-test.env
cp deploy/env/zhimeng-prod.env.example /www/server/zhimeng/env/zhimeng-prod.env
chmod 600 /www/server/zhimeng/env/zhimeng-test.env /www/server/zhimeng/env/zhimeng-prod.env
```

必须替换：

- `ZHIMENG_ADMIN_TOKEN`：运营口令，至少 32 位随机值。
- `ZHIMENG_MYSQL_PASSWORD`：对应数据库密码。
- `ZHIMENG_WECHAT_PAYMENT_QR_URL`：正式微信收款码 URL。
- `ZHIMENG_ALIPAY_PAYMENT_QR_URL`：正式支付宝收款码 URL。
- `ZHIMENG_PLAN_FAMILY_YEARLY_AMOUNT_CENTS`：正式家庭年卡价格，默认 `19900`。
- `ZHIMENG_PLAN_BOOTCAMP_7D_AMOUNT_CENTS`：正式 7 天陪跑包价格，默认 `69900`。

生成随机运营口令：

```bash
openssl rand -hex 32
```

### 1.5 配置 Nginx

仓库提供可复制模板：

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
/www/server/nginx/sbin/nginx -s reload
```

如果宝塔环境的 Nginx reload 命令不同，按面板实际路径执行；不要在 `nginx -t` 失败时强行 reload。

### 1.6 初始化数据库并启动 API

测试环境：

```bash
cd /www/wwwroot/zhimeng-app/scratch-gui
GIT_REF=feat/electron bash deploy/scripts/deploy-api.sh test
```

正式环境：

```bash
cd /www/wwwroot/zhimeng-app/scratch-gui
GIT_REF=feat/electron bash deploy/scripts/deploy-api.sh prod
```

脚本会自动：

- 拉取 `origin/feat/electron`。
- 安装生产依赖。
- 加载 `/www/server/zhimeng/env/zhimeng-<env>.env`。
- 执行 `npm run db:migrate`。
- 启动或重启 `zhimeng-api-test` / `zhimeng-api-prod`。

查看状态：

```bash
pm2 status zhimeng-api-test
pm2 status zhimeng-api-prod
pm2 logs zhimeng-api-prod --lines 100
```

### 1.7 上传安装包

安装包不由 `deploy-static.sh` 自动上传；它会保护 `downloads/` 目录，避免部署静态页时误删大文件。

正式站当前 `website/releases.json` 指向以下文件名：

```text
/www/wwwroot/zhimeng/downloads/新祥编程 Setup 1.0.0.exe
/www/wwwroot/zhimeng/downloads/新祥编程 1.0.0.exe
/www/wwwroot/zhimeng/downloads/新祥编程-1.0.0-arm64.dmg
/www/wwwroot/zhimeng/downloads/新祥编程-1.0.0.dmg
```

本地上传到正式站：

```bash
cd /Users/apple/wanlexiang/personProject/scratch-gui

scp "dist/新祥编程 Setup 1.0.0.exe" root@39.106.81.189:"/www/wwwroot/zhimeng/downloads/"
scp "dist/新祥编程 1.0.0.exe" root@39.106.81.189:"/www/wwwroot/zhimeng/downloads/"
scp "dist/新祥编程-1.0.0-arm64.dmg" root@39.106.81.189:"/www/wwwroot/zhimeng/downloads/"
scp "dist/新祥编程-1.0.0.dmg" root@39.106.81.189:"/www/wwwroot/zhimeng/downloads/"
```

测试站路径换成 `/www/wwwroot/zhimeng-test/downloads/`。

### 1.8 部署静态站

服务器执行：

```bash
cd /www/wwwroot/zhimeng-app/scratch-gui
bash deploy/scripts/deploy-static.sh test
bash deploy/scripts/deploy-static.sh prod
```

脚本会：

- 备份当前站点目录到 `/www/backup`。
- 同步 `website/` 到站点根目录。
- 排除 `.user.ini`。
- 排除并保留 `downloads/`。

### 1.9 首次部署验收

先验测试环境：

```bash
cd /www/wwwroot/zhimeng-app/scratch-gui
bash deploy/scripts/verify-public.sh test
```

再验正式环境：

```bash
bash deploy/scripts/verify-public.sh prod
```

正式环境的脚本默认要求 `/health` 成功，避免官网可访问但注册/登录不可用。

手工检查：

```bash
curl -fsS https://zhimeng.codevalley.cn/health
curl -fsSI https://zhimeng.codevalley.cn/
curl -fsSI https://zhimeng.codevalley.cn/pay.html
curl -fsSI https://zhimeng.codevalley.cn/ops.html
curl -fsS https://zhimeng.codevalley.cn/releases.json
```

下载包检查：

```bash
curl -fsSI "https://zhimeng.codevalley.cn/downloads/%E6%96%B0%E7%A5%A5%E7%BC%96%E7%A8%8B%20Setup%201.0.0.exe"
curl -fsSI "https://zhimeng.codevalley.cn/downloads/%E6%96%B0%E7%A5%A5%E7%BC%96%E7%A8%8B%201.0.0.exe"
curl -fsSI "https://zhimeng.codevalley.cn/downloads/%E6%96%B0%E7%A5%A5%E7%BC%96%E7%A8%8B-1.0.0-arm64.dmg"
curl -fsSI "https://zhimeng.codevalley.cn/downloads/%E6%96%B0%E7%A5%A5%E7%BC%96%E7%A8%8B-1.0.0.dmg"
```

人工业务验收：

1. 打开客户端。
2. 注册新账号。
3. 点击「订阅解锁」。
4. 扫码付款并提交凭证。
5. 打开 `https://zhimeng.codevalley.cn/ops.html`。
6. 输入正式运营口令。
7. 核对订单并确认到账。
8. 客户端刷新授权，应进入完整编辑器。

## 2. 已有服务器版本更新

适用场景：服务器已经部署过，现在要发布新代码、新官网、新付款页、新运营后台、新 `releases.json` 或新安装包。

### 2.1 本地提交并 push

```bash
cd /Users/apple/wanlexiang/personProject/scratch-gui
git status --short
git log --oneline -4
git push origin feat/electron
```

如果服务器脚本使用其他分支或 tag，设置 `GIT_REF=<branch-or-tag>`。

### 2.2 确认本地发布门禁

正式更新前至少跑：

```bash
npm run test:zhimeng-package-metadata
set -a; source deploy/env/zhimeng-prod.env.example; set +a
ZHIMENG_ADMIN_TOKEN=prod-release-check-token-2026-05-27-very-strong npm run release:check
```

如果是公开陌生用户售卖，还必须通过签名门禁：

```bash
ZHIMENG_REQUIRE_CODE_SIGNING=1 npm run release:check-signing
```

如果只是熟人种子用户小范围验证，且暂未取得 Apple Developer ID 或 Windows 代码签名证书，可以临时记录为未签名种子分发：

```bash
ZHIMENG_ALLOW_UNSIGNED_SEED_RELEASE=1 npm run release:check-signing
```

这种模式只能用于种子验证，不应在客服话术中宣称“正式签名/已公证”。

### 2.3 服务器拉代码并更新 API

服务器执行：

```bash
cd /www/wwwroot/zhimeng-app/scratch-gui
GIT_REF=feat/electron bash deploy/scripts/deploy-api.sh prod
```

如果只是静态页变化、没有后端代码和数据库变化，可以跳过 API 更新。但只要改了 `backend/`、`deploy/env/`、鉴权、订单、设备限制、付款凭证或运营后台接口，就应执行这一步。

如果只改了服务器 env，例如 `ZHIMENG_ADMIN_TOKEN`、支付二维码、下载 URL 或 CORS 域名，也需要至少重启 API 让 PM2 进程重新加载环境变量：

```bash
cd /www/wwwroot/zhimeng-app/scratch-gui
set -a
. /www/server/zhimeng/env/zhimeng-prod.env
set +a
pm2 restart zhimeng-api-prod --update-env
pm2 save
```

否则静态页虽然已经更新，后端仍会使用旧进程里的 env，运营页可能出现 `Unauthorized`。

### 2.4 上传或替换安装包

如果本次版本更新生成了新安装包，先上传到 `downloads/`。当前 `1.0.0` 正式包命令：

```bash
cd /Users/apple/wanlexiang/personProject/scratch-gui

scp "dist/新祥编程 Setup 1.0.0.exe" root@39.106.81.189:"/www/wwwroot/zhimeng/downloads/"
scp "dist/新祥编程 1.0.0.exe" root@39.106.81.189:"/www/wwwroot/zhimeng/downloads/"
scp "dist/新祥编程-1.0.0-arm64.dmg" root@39.106.81.189:"/www/wwwroot/zhimeng/downloads/"
scp "dist/新祥编程-1.0.0.dmg" root@39.106.81.189:"/www/wwwroot/zhimeng/downloads/"
```

如果版本号变化，需要同步更新：

- `deploy/env/zhimeng-prod.env.example` 中四个下载 URL。
- `website/releases.json`。
- 实际上传文件名。
- `ZHIMENG_RELEASE_VERSION` 和 `releasedAt`。

注意：`npm run release:update-downloads` 会按**当前 shell 已加载的环境变量**重写 `website/releases.json`。如果服务器 `/www/server/zhimeng/env/zhimeng-prod.env` 仍是旧版本，就会把仓库里的正确清单覆盖回旧版本。生成前先检查：

```bash
grep -E "ZHIMENG_RELEASE_VERSION|ZHIMENG_WINDOWS_NSIS_URL|ZHIMENG_MACOS" /www/server/zhimeng/env/zhimeng-prod.env
```

当前 `1.0.0` 发布应看到 `ZHIMENG_RELEASE_VERSION=1.0.0`，且下载 URL 使用 `新祥编程` 包名。脚本已增加防呆：如果生成清单版本与 `package.json` 版本不一致，或下载 URL 指向旧 `zhimeng-*` 包名，会直接失败；只有显式回滚时才允许设置 `ZHIMENG_ALLOW_RELEASE_VERSION_MISMATCH=1`。

可在服务器加载正式 env 后重新生成下载清单：

```bash
cd /www/wwwroot/zhimeng-app/scratch-gui
set -a
. /www/server/zhimeng/env/zhimeng-prod.env
set +a
npm run release:update-downloads
```

### 2.5 部署静态站

```bash
cd /www/wwwroot/zhimeng-app/scratch-gui
bash deploy/scripts/deploy-static.sh prod
```

这个脚本会同步最新 `website/`、`pay.html`、`ops.html`、`releases.json`、海报、视频封面等静态文件，但不会删除 `downloads/`。

同步前它会校验 `website/releases.json`：版本必须等于 `package.json`，下载 URL 必须包含版本号，且不能指向旧 `zhimeng-*` 包名。校验失败时会拒绝部署，避免错误清单发布到线上。

### 2.6 版本更新验收

服务器或本地执行：

```bash
cd /www/wwwroot/zhimeng-app/scratch-gui
bash deploy/scripts/verify-public.sh prod
```

成功标准：

- 首页展示“新祥编程”。
- `pay.html` 展示“新祥编程订单支付”。
- `ops.html` 不再出现旧中文品牌“知萌”。
- `releases.json` 与仓库 `website/releases.json` 一致。
- 四个安装包 URL 返回 200。
- `/health` 返回成功。

如果脚本失败，先看失败分类：

- `remote releases.json differs from local`：服务器静态站还没部署最新 `website/releases.json`。
- `download URL points to legacy zhimeng-*`：线上清单仍指向旧包名。
- `missing required text: 新祥编程`：线上页面还没部署新品牌静态文件。
- `download URL -> 404`：安装包没上传、文件名不一致，或 Nginx 路径不对。
- `/health` 失败：PM2 后端未启动、Nginx 反代错误或 env/数据库配置错误。
- `ops.html` 显示 `Unauthorized`：运营口令和后端进程中的 `ZHIMENG_ADMIN_TOKEN` 不一致。先重启 API 加载最新 env，再清理浏览器保存的旧口令。
- 测试域名 `fetch failed` 或 `Could not resolve host: zhimeng-test.codevalley.cn`：先补阿里云 DNS 记录；补记录前只能用 `curl --resolve` 验证测试站 Host 绑定，不能把它视为普通用户已可访问。

运营口令排查：

```bash
cd /www/wwwroot/zhimeng-app/scratch-gui
set -a
. /www/server/zhimeng/env/zhimeng-prod.env
set +a
pm2 restart zhimeng-api-prod --update-env
curl -fsS -H "X-Zhimeng-Admin-Token: $ZHIMENG_ADMIN_TOKEN" \
  "https://zhimeng.codevalley.cn/admin/orders?limit=1"
```

如果命令行验证通过，但浏览器仍失败，在 `ops.html` 控制台执行：

```js
localStorage.removeItem('zhimengOpsAdminToken');
location.reload();
```

### 2.7 PM2 与 Nginx 快速排查

```bash
pm2 status zhimeng-api-prod
pm2 logs zhimeng-api-prod --lines 100
nginx -t
/www/server/nginx/sbin/nginx -s reload
```

## 3. 客户端打包注意

桌面客户端的 API 地址在构建时注入。测试包和正式包必须分别构建。

正式包优先使用一键脚本，避免误把 `localhost:3001` 打进用户安装包：

```bash
ZHIMENG_REQUIRE_CODE_SIGNING=1 npm run release:check-signing
npm run dist:desktop:prod
npm run test:zhimeng-desktop-bundle
```

生产 macOS 包必须使用 Apple Developer ID 证书签名并完成 notarization 后再上传到正式下载目录。未签名/未公证的 DMG 会触发 Gatekeeper 的“无法验证开发者”，不应作为正式公开包交付。完成签名后执行：

```bash
ZHIMENG_REQUIRE_MAC_SIGNED=1 npm run test:zhimeng-mac-release
```

熟人种子用户可用未签名包验证购买和授权闭环，但客服需要提前说明系统安全提示。

## 4. 回滚

### 4.1 API 回滚

```bash
cd /www/wwwroot/zhimeng-app/scratch-gui
git log --oneline -5
git reset --hard <previous-good-commit>

set -a
. /www/server/zhimeng/env/zhimeng-prod.env
set +a

npm ci --omit=dev --ignore-scripts --legacy-peer-deps --no-audit --no-fund
npm run db:migrate
pm2 restart zhimeng-api-prod --update-env
```

数据库迁移前先在宝塔做数据库备份。订单、支付凭证、授权数据属于业务账本，不能随意删库重建。

### 4.2 静态站回滚

`deploy-static.sh` 会在 `/www/backup` 下生成站点备份。出问题时可解压上一个备份覆盖站点根目录，并保留 `downloads/`。

```bash
ls -lh /www/backup | tail
tar -xzf /www/backup/<previous-site-backup>.tar.gz -C /www/wwwroot/zhimeng
/www/server/nginx/sbin/nginx -s reload
```

### 4.3 下载包回滚

保留最近一个稳定版本安装包。若新版安装包有问题：

1. 将 `website/releases.json` 切回上一稳定版本 URL。
2. 部署静态站。
3. 执行 `bash deploy/scripts/verify-public.sh prod`。
