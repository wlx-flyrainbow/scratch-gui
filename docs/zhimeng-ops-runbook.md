# 知萌上线运维 Runbook

## 发布前闸门

1. 运行数据库迁移：`npm run db:migrate`
2. 运行发布校验：`npm run release:check`
3. 运行 mock 购买闭环验收：`npm run test:zhimeng-purchase-flow`
4. 运行真库购买闭环验收：`npm run test:zhimeng-purchase-flow:realdb`
5. 运行新用户完整流程真库验收：`npm run test:zhimeng-new-user-flow:realdb`
6. 确认客户端内置注册可创建 inactive 账号，注册后仍需订阅和人工确认才可解锁。
7. 构建 macOS 与 Windows 包：`npm run dist:mac:arm64`、`npm run dist:mac:x64`、`npm run dist:win`
8. 上传 macOS Apple 芯片版、macOS Intel 芯片版、Windows 安装包与便携包到 CDN，设置 `.env.production` 中的 `ZHIMENG_MACOS_ARM64_URL` / `ZHIMENG_MACOS_X64_URL` / `ZHIMENG_WINDOWS_NSIS_URL` / `ZHIMENG_WINDOWS_PORTABLE_URL`，执行 `npm run release:update-downloads`。
9. 确认 `website/releases.json` 指向真实 CDN 地址，并记录版本 tag。

本地桌面 UI 验收请使用 `npm run electron-dev:full` 启动完整栈；只启动 `npm run electron-dev` 时不会自动启动认证后端，注册/登录会报网络连接失败。

## 关键监控指标

- 登录成功率、登录失败原因分布
- 注册成功率、注册失败原因分布
- refresh 成功率、refresh 401 数量
- `/entitlement` 成功率与延迟
- 订单 `created` 到 `fulfilled` 的耗时
- `paid` 或 `created` 超时未完成数量
- MySQL 连接失败、健康检查 503
- 5xx 与 429 数量

## 告警建议

- `/health` 连续 3 次 503：立即告警
- 5 分钟内 5xx 比例超过 2%：告警
- 订单超过 30 分钟未 `fulfilled`：告警并进入人工排查
- refresh 401 突增：排查 token 策略、时间同步和数据库状态

## 客服与运营查询

受保护接口统一使用 `X-Zhimeng-Admin-Token`：

若已部署静态站，可打开 `ops.html`，输入 API 地址和 `ZHIMENG_ADMIN_TOKEN`，查看已提交付款凭证的订单并人工确认到账。确认页会要求填写操作人、真实交易号、确认金额和币种；确认前仍必须核对商户/银行实际到账记录。

```bash
curl -H "X-Zhimeng-Admin-Token: $ZHIMENG_ADMIN_TOKEN" \
  https://api.example.com/admin/user/<username>

curl -H "X-Zhimeng-Admin-Token: $ZHIMENG_ADMIN_TOKEN" \
  https://api.example.com/admin/order/o_<id>

curl -H "X-Zhimeng-Admin-Token: $ZHIMENG_ADMIN_TOKEN" \
  'https://api.example.com/admin/orders?status=created&has_payment_proof=1'

curl -H "X-Zhimeng-Admin-Token: $ZHIMENG_ADMIN_TOKEN" \
  https://api.example.com/admin/order/o_<id>/payment-proof-attachment/<attachment_id> \
  --output payment-proof.jpg
```

人工确认订单：

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-Zhimeng-Admin-Token: $ZHIMENG_ADMIN_TOKEN" \
  -d '{"operator":"ops","provider_trade_no":"manual-xxx","amount_cents":19900,"currency":"CNY","note":"offline paid"}' \
  https://api.example.com/admin/order/o_<id>/manual-confirm
```

人工确认前必须核对订单金额、币种、付款时间、渠道订单号、交易尾号和实际到账记录。微信看“转账单号”；支付宝看“订单号”和“商家订单号”。`ops.html` 会阻止确认金额或币种与订单不一致的提交，但运营仍需以真实收款方账单为准。付款截图只作为辅助证据，管理员查看截图必须走受保护接口，不要把截图放到公开静态目录。用户提交的尾号只能辅助检索，不能单独证明到账。用户提交付款凭证后，订单状态仍为 `created`；只有该人工确认接口成功后，订单才会进入 `paid -> fulfilled` 并开通授权。

## 回滚流程

1. 暂停下载页新版本入口，恢复 `website/releases.json` 到上一稳定版本。
2. 后端回滚到上一镜像或上一 tag。
3. 若数据库迁移已执行，优先使用补偿脚本修复数据；避免无备份的破坏性回滚。
4. 对受影响订单用 `/admin/order/:id` 查询状态，必要时重新执行人工确认。
5. 发布复盘：记录影响范围、根因、补偿动作和防复发项。

## 灰度策略

- `beta` 渠道先发布给内部/小范围用户，观察 24-72 小时。
- 指标稳定后再更新 `stable` 下载链接。
- 保留上一稳定版安装包，直到新版本稳定至少一周。
