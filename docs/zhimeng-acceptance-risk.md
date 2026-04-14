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
- 用户支付后 entitlement 自动开通

### 当前状态（2026-04-13）

- 已实现后端最小订单链路：`POST /order/create`、`GET /order/:id/status`
- 已实现本地回调模拟：`POST /order/:id/mock-paid`（用于本地联调验收）
- 已实现客户端动作：授权提示条支持“前往购买”“刷新授权”
- 已补充自动化回归：`test/backend/order-flow.unit.test.js`（mock DB）
- 待完成：真实支付网关回调签名校验、回调幂等与对账任务

### 风险与应对

- 风险：支付回调丢失或延迟
- 应对：订单状态轮询 + 对账补偿任务

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
