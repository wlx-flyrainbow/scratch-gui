# 知萌上线运维 Runbook

## 发布前闸门

1. 运行数据库迁移：`npm run db:migrate`
2. 运行发布校验：`npm run release:check`
3. 运行 real-db 验收：`npm run test:zhimeng-goal:realdb`
4. 构建 Windows 包：`npm run dist:win`
5. 确认 `website/releases.json` 指向真实 CDN 地址，并记录版本 tag。

## 关键监控指标

- 登录成功率、登录失败原因分布
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

```bash
curl -H "X-Zhimeng-Admin-Token: $ZHIMENG_ADMIN_TOKEN" \
  https://api.example.com/admin/user/<username>

curl -H "X-Zhimeng-Admin-Token: $ZHIMENG_ADMIN_TOKEN" \
  https://api.example.com/admin/order/o_<id>
```

人工确认订单：

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-Zhimeng-Admin-Token: $ZHIMENG_ADMIN_TOKEN" \
  -d '{"operator":"ops","provider_trade_no":"manual-xxx","note":"offline paid"}' \
  https://api.example.com/admin/order/o_<id>/manual-confirm
```

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
