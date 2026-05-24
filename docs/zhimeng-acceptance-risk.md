# 知萌：验收标准与风险应对

## Milestone 0（合规+品牌）

### 验收标准

- `package.json` 中 `build.appId`、`build.productName` 已品牌化
- Electron 窗口标题为“知萌”
- AGPL 合规说明文档可对外发布

### 风险与应对

- 风险：AGPL 合规不清晰导致发布受阻
- 应对：先完成法务确认，再推进商业发布

## Milestone A1（Auth/Entitlement API）

### 验收标准

- 登录、刷新、拉取 entitlement、登出 API 可联调
- 设备绑定/解绑可联调

### 风险与应对

- 风险：接口定义频繁变更
- 应对：先冻结 MVP 字段，再迭代扩展字段

## Milestone A2（客户端接入）

### 验收标准

- 启动可加载本地授权缓存
- 租约过期后可刷新；刷新失败进入受限模式
- `canSave/canShare/enableCommunity/showComingSoon` 随 entitlement 生效
- token 不落地到 renderer 明文存储

### 风险与应对

- 风险：离线策略误判导致误封可用用户
- 应对：保守降级，仅关闭云能力，不影响本地编辑

## Milestone B（支付与下载页）

### 验收标准

- 下载页可下载安装包
- 用户创建订单、扫码付款、提交付款凭证后，运营可人工确认并开通 entitlement

### 当前状态（2026-04-13）

- 已实现后端最小订单链路：`POST /order/create`、`GET /order/:id/status`
- 已实现本地回调模拟：`POST /order/:id/mock-paid`（用于本地联调验收）
- 已切换 MVP 路线为静态二维码收款 + 用户付款凭证 + 运营人工确认 entitlement
- 已实现客户端动作：授权提示条支持“前往购买”“刷新授权”
- 已补充自动化回归：`test/backend/order-flow.unit.test.js`（mock DB）
- 后续增强：订单专属二维码、真实支付网关回调签名校验、回调幂等与对账任务

### 风险与应对

- 风险：用户仅提交交易尾号，运营无法准确核账
- 应对：微信要求转账单号；支付宝要求订单号和商家订单号；尾号仅作辅助检索，人工确认以收款方账单实际到账为准

## Milestone C/D（设备管理与更新）

### 验收标准

- 设备解绑可恢复登录
- 自动更新支持 stable/beta 渠道

### 风险与应对

- 风险：错误更新导致大面积故障
- 应对：灰度发布 + 回滚机制 + 渠道隔离

## 监控指标（建议）

- 登录成功率、刷新成功率
- entitlement 拉取成功率
- 授权失败原因分布（过期/设备超限/网络）
- 支付成功率、回调成功率
