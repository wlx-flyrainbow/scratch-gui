# 知萌：授权与租约设计

## 总体目标

- 按账号售卖（在线登录）
- 支持离线短期可用（租约）
- 订阅状态可控（未开通、已开通、到期、冻结、设备上限、特性开关）

## token 生命周期

- `access_token`: 15 分钟 - 1 小时
- `refresh_token`: 30 天（可服务端吊销）
- 应用启动时优先读本地缓存；若 access 过期则尝试 refresh

## entitlement 数据结构（建议）

```json
{
  "status": "active",
  "plan": "family_yearly",
  "expires_at": "2027-03-01T00:00:00.000Z",
  "device_limit": 3,
  "status_reason": "",
  "status_updated_at": null,
  "features": ["cloud_save", "share", "community", "backpack"],
  "devices": [
    {
      "device_id": "win-xxxx",
      "device_name": "LAPTOP-01",
      "last_seen_at": "2026-03-30T08:00:00.000Z"
    }
  ],
  "lease": {
    "issuedAt": "2026-03-30T08:00:00.000Z",
    "expiresAt": "2026-04-06T08:00:00.000Z"
  }
}
```

## 租约策略

- 登录、注册和刷新授权后拉取 entitlement，并绑定当前 `device_id`
- 绑定成功后客户端构造 `lease.expiresAt`
- 默认离线宽限：7 天（可通过 `ZHIMENG_LEASE_DAYS` 配置）
- 启动流程：
  1. 读取本地 token + entitlement
  2. entitlement 为 `active` 且 lease 未过期：允许进入完整编辑器
  3. lease 过期：尝试联网 refresh + 重新拉 entitlement
  4. 刷新失败：进入锁定体验，提示联网刷新

冻结策略：

- `status=frozen` 优先级最高；即使订阅尚未到期，接口也返回 `frozen`。
- 客户端一旦联网刷新到 `frozen`，立即锁定完整编辑器。
- 离线状态无法实时感知冻结，最多受现有 7 天离线租约约束。

到期策略：

- 数据库存储的 `status` 可仍为 `active`。
- API 统一做有效状态解析：`active` 且 `subscription_expires_at <= now` 时返回 `expired`。

设备策略：

- 一个账号最多绑定 3 台设备。
- 客户端生成一次性随机 `device_id` 并持久保存；Electron 使用本机 auth store，浏览器开发环境使用 localStorage。
- 同一设备重复绑定只刷新 `last_seen_at`。
- 第 4 台设备绑定返回 `409 Device limit exceeded`，客户端进入 `deviceLimit` 锁定态。
- MVP 不做用户自助解绑；解绑只由运营在 `ops.html` 完成。

## 状态与功能矩阵

| 状态 | 完整编辑器 | 本地保存 | 云保存 | 分享/社区/背包 |
| --- | --- | --- | --- | --- |
| 已登录 + entitlement active + 租约有效 | Y | Y | Y（按 feature） | Y（按 feature） |
| 已登录 + active 但租约过期 | N | N | N | N |
| 未登录 | N | N | N | N |
| 已登录 + inactive | N | N | N | N |
| 已登录 + expired | N | N | N | N |
| 已登录 + frozen | N | N | N | N |
| 已登录 + deviceLimit | N | N | N | N |

## 套餐续期

- `family_yearly`：确认到账后延长 365 天。
- `bootcamp_7d`：确认到账后延长 7 天。
- 续期基准为 `max(now, 当前未来到期时间)`。
- 已有未来年卡时购买 `bootcamp_7d` 不得缩短或覆盖原年卡套餐。

## 当前实现映射（本仓库）

- `src/lib/auth-hoc.jsx`
  - 启动读取缓存、尝试 refresh、下发 capability prop
- `src/lib/auth/api.js`
  - `login/refresh/fetchEntitlement/logout`
- `src/lib/auth/lease.js`
  - `buildLease/isLeaseValid`
- `src/lib/auth/storage.js`
  - 走 `window.zhimengAuth` bridge（Electron）或 localStorage fallback
  - 保存随机 `device_id`，不采集硬件序列号
- `website/ops.html`
  - 运营查询账号、冻结/解冻账号、解绑旧设备

## 后续增强建议

1. 增加 “租约将过期” 提前提醒（如剩余 < 24 小时）。
2. 自助设备管理（如短信/邮箱验证后解绑）可在 MVP 后评估。
3. 增加 feature flag 白名单，支持套餐灰度投放。
