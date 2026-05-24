# 知萌生产发布闸门清单

本文用于把知萌从“可访问、可下载”推进到“可正式售卖”。当前线上下载链路已经跑通，但生产售卖闭环仍必须通过以下闸门。

## 1. 当前状态

已完成：

- `zhimeng.codevalley.cn` 已部署官网、付款页、运营确认页和 `releases.json`。
- Windows 安装版、Windows 便携版、macOS Apple 芯片版、macOS Intel 芯片版安装包已经上传到正式下载目录。
- 4 个正式下载地址均应指向 `https://zhimeng.codevalley.cn/downloads/`。
- `deploy/env/zhimeng-prod.env.example` 和 `deploy/env/zhimeng-test.env.example` 已提供生产/测试环境模板。
- 宝塔部署路径已固定：
  - 代码仓库：`/www/wwwroot/zhimeng-app/scratch-gui`
  - 正式站点：`/www/wwwroot/zhimeng`
  - 测试站点：`/www/wwwroot/zhimeng-test`
  - 业务数据：`/www/wwwroot/zhimeng-data`
  - 环境变量：`/www/server/zhimeng/env`

仍未完成：

- 生产后端环境变量尚未填入真实密钥、数据库密码和收款二维码。
- 宝塔 PM2/Node 服务需要确认使用生产 env 启动并持久化。
- 生产 MySQL 迁移和健康检查需要以真实 env 执行。
- `npm run release:check` 需要在生产 env 下通过。
- 需要走一遍真实线上新用户购买、运营确认、客户端授权刷新闭环。

## 2. 必填生产变量

生产环境文件建议固定为：

```bash
/www/server/zhimeng/env/zhimeng-prod.env
```

从模板生成：

```bash
cd /www/wwwroot/zhimeng-app/scratch-gui
cp deploy/env/zhimeng-prod.env.example /www/server/zhimeng/env/zhimeng-prod.env
chmod 600 /www/server/zhimeng/env/zhimeng-prod.env
```

必须替换的值：

| 变量 | 生产建议 | 当前处理 |
| --- | --- | --- |
| `ZHIMENG_ADMIN_TOKEN` | `openssl rand -hex 32` 生成，不放入 Git | 必填 |
| `ZHIMENG_MYSQL_PASSWORD` | 宝塔中 `zhimeng_prod` 数据库用户真实密码 | 必填 |
| `ZHIMENG_WECHAT_PAYMENT_QR_URL` | 正式微信收款二维码 HTTPS 地址 | 必填 |
| `ZHIMENG_ALIPAY_PAYMENT_QR_URL` | 正式支付宝收款二维码 HTTPS 地址 | 必填 |
| `ZHIMENG_PLAN_FAMILY_YEARLY_AMOUNT_CENTS` | 正式售卖用 `19900`；测试用 `1` | 正式前确认 |
| `ZHIMENG_CORS_ORIGINS` | `https://zhimeng.codevalley.cn` | 保持同域 |
| `ZHIMENG_PAYMENT_PROOF_STORAGE_DIR` | `/www/wwwroot/zhimeng-data/prod/payment-proofs` | 确认目录存在且非公开 |

生产应保持：

```bash
NODE_ENV=production
ZHIMENG_AUTH_PORT=3101
ZHIMENG_AUTH_API_BASE=https://zhimeng.codevalley.cn
ZHIMENG_PAYMENT_API_BASE=https://zhimeng.codevalley.cn
ZHIMENG_BILLING_URL=https://zhimeng.codevalley.cn
ZHIMENG_CORS_ORIGINS=https://zhimeng.codevalley.cn
ZHIMENG_AUTO_INIT_SCHEMA=0
ZHIMENG_JSON_LIMIT=8mb
ZHIMENG_LEASE_DAYS=7
ZHIMENG_PAYMENT_MODE=manual_qr
ZHIMENG_PAYMENT_CURRENCY=CNY
ZHIMENG_PAYMENT_PROOF_MAX_BYTES=5242880
```

不要在生产开启：

```bash
ZHIMENG_ENABLE_MOCK_PAYMENT=1
ZHIMENG_SEED_DEMO_USER=1
ZHIMENG_AUTO_INIT_SCHEMA=1
```

## 3. 宝塔服务配置

### 3.1 初始化目录

```bash
mkdir -p /www/wwwroot/zhimeng-data/prod/payment-proofs
mkdir -p /www/server/zhimeng/env
chmod 700 /www/wwwroot/zhimeng-data/prod/payment-proofs
```

### 3.2 数据库迁移

```bash
cd /www/wwwroot/zhimeng-app/scratch-gui
set -a
. /www/server/zhimeng/env/zhimeng-prod.env
set +a
npm run db:migrate
```

### 3.3 PM2 启动

```bash
cd /www/wwwroot/zhimeng-app/scratch-gui
set -a
. /www/server/zhimeng/env/zhimeng-prod.env
set +a
pm2 delete zhimeng-api-prod || true
pm2 start backend/server.js --name zhimeng-api-prod --update-env
pm2 save
```

重启：

```bash
cd /www/wwwroot/zhimeng-app/scratch-gui
set -a
. /www/server/zhimeng/env/zhimeng-prod.env
set +a
pm2 restart zhimeng-api-prod --update-env
```

查看：

```bash
pm2 status
pm2 logs zhimeng-api-prod --lines 100
```

## 4. 发布检查命令

在服务器或本地都可以跑。若在本地跑，需要先加载同一份生产 env。

```bash
cd /www/wwwroot/zhimeng-app/scratch-gui
set -a
. /www/server/zhimeng/env/zhimeng-prod.env
set +a
npm run release:check
```

通过标准：

```text
Zhimeng release environment looks ready.
```

如果失败，必须逐条处理失败项，不要跳过。

## 5. 公网健康检查

```bash
curl -fsS https://zhimeng.codevalley.cn/health
curl -fsSI https://zhimeng.codevalley.cn/
curl -fsSI https://zhimeng.codevalley.cn/pay.html
curl -fsSI https://zhimeng.codevalley.cn/ops.html
curl -fsS https://zhimeng.codevalley.cn/releases.json
```

下载包验证：

```bash
curl -fsSI https://zhimeng.codevalley.cn/downloads/zhimeng-setup-5.2.16.exe
curl -fsSI https://zhimeng.codevalley.cn/downloads/zhimeng-portable-5.2.16.exe
curl -fsSI https://zhimeng.codevalley.cn/downloads/zhimeng-mac-arm64-5.2.16.dmg
curl -fsSI https://zhimeng.codevalley.cn/downloads/zhimeng-mac-x64-5.2.16.dmg
```

## 6. 线上购买闭环验收

正式售卖前必须人工走一次：

1. 打开正式客户端。
2. 注册一个全新账号。
3. 未付费状态下确认不能进入完整编辑器。
4. 点击“订阅解锁”。
5. 确认订单金额、二维码、付款备注和支付方式展示正确。
6. 提交付款凭证。
7. 打开 `https://zhimeng.codevalley.cn/ops.html`。
8. 使用生产 `ZHIMENG_ADMIN_TOKEN` 登录运营确认。
9. 核对到账记录、金额、订单号和用户信息。
10. 确认到账并开通授权。
11. 客户端点击刷新授权。
12. 确认进入完整编辑器。

验收记录至少保留：

- 测试账号。
- 订单号。
- 付款渠道。
- 实付金额。
- 运营确认时间。
- 客户端授权刷新结果。

## 7. 当前工作区归类

建议提交：

- `docs/zhimeng-brand-assets-inventory.md`
- `docs/zhimeng-customer-faq.md`
- `docs/zhimeng-private-domain-launch-copy.md`
- `docs/zhimeng-launch-poster-copy.md`
- `docs/zhimeng-demo-video-script.md`
- `docs/zhimeng-seed-user-tracking.md`
- `docs/zhimeng-seed-user-tracking.csv`
- `scripts/generate-zhimeng-demo-video.js`
- `website/assets/posters/`
- `website/posters/`
- `website/index.html`
- PRD、tasks、营销计划、商标管理文档中对应状态更新

不建议提交：

- `.tmp/zhimeng-demo-video-frames/`：演示视频生成中间帧，体积大且可再生成。

## 8. 下一步决策

优先顺序：

1. 将营销/品牌素材按功能提交。
2. 在宝塔填写 `/www/server/zhimeng/env/zhimeng-prod.env`。
3. 启动或重启 `zhimeng-api-prod`。
4. 跑 `npm run release:check`。
5. 跑正式域名健康检查。
6. 走新用户购买闭环。
