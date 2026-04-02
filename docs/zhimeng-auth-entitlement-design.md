# 知萌：授权与租约设计

## 总体目标

- 按账号售卖（在线登录）
- 支持离线短期可用（租约）
- 订阅状态可控（到期、设备上限、特性开关）

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

- 登录后拉取 entitlement，并在客户端构造 `lease.expiresAt`
- 默认离线宽限：7 天（可通过 `ZHIMENG_LEASE_DAYS` 配置）
- 启动流程：
  1. 读取本地 token + entitlement
  2. entitlement lease 未过期：允许进入应用
  3. lease 过期：尝试联网 refresh + 重新拉 entitlement
  4. 刷新失败：进入受限模式（云能力关闭）

## 状态与功能矩阵

| 状态 | 本地编辑 | 本地保存 | 云保存 | 分享/社区/背包 |
| --- | --- | --- | --- | --- |
| 已登录 + entitlement active | Y | Y | Y | Y（按 feature） |
| 已登录 + 离线租约有效 | Y | Y | N | N |
| 已登录 + 租约过期 | Y | Y | N | N |
| 未登录 | Y | Y | N | N |
| 已登录 + entitlement inactive | Y | Y | N | N |

## 当前实现映射（本仓库）

- `src/lib/auth-hoc.jsx`
  - 启动读取缓存、尝试 refresh、下发 capability prop
- `src/lib/auth/api.js`
  - `login/refresh/fetchEntitlement/logout`
- `src/lib/auth/lease.js`
  - `buildLease/isLeaseValid`
- `src/lib/auth/storage.js`
  - 走 `window.zhimengAuth` bridge（Electron）或 localStorage fallback

## 后续增强建议

1. 增加 “租约将过期” 提前提醒（如剩余 < 24 小时）。
2. 登录失败分级错误码（账号冻结、设备超限、套餐过期）。
3. 增加 feature flag 白名单，支持套餐灰度投放。
