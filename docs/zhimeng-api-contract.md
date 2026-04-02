# 知萌：后端 API 契约（MVP）

## 认证 Auth

### `POST /auth/login`

请求：

```json
{
  "username": "demo",
  "password": "******"
}
```

响应：

```json
{
  "access_token": "jwt_or_opaque",
  "refresh_token": "refresh_token",
  "user": {
    "id": "u_1",
    "username": "demo",
    "nickname": "知萌用户"
  },
  "permissions": {
    "student": true,
    "educator": false
  },
  "entitlement": {
    "status": "active",
    "features": ["cloud_save", "share", "community", "backpack"]
  }
}
```

### `POST /auth/refresh`

请求：

```json
{
  "refresh_token": "refresh_token"
}
```

响应：

```json
{
  "access_token": "new_access_token"
}
```

### `POST /auth/logout`

请求：

```json
{
  "refresh_token": "refresh_token"
}
```

响应：`204 No Content`

## 授权 Entitlement

### `GET /entitlement`

Header:

```text
Authorization: Bearer <access_token>
```

响应：

```json
{
  "status": "active",
  "plan": "family_yearly",
  "expires_at": "2027-03-01T00:00:00.000Z",
  "device_limit": 3,
  "features": ["cloud_save", "share", "community", "backpack"],
  "devices": []
}
```

### `POST /entitlement/device/bind`

请求：

```json
{
  "device_id": "win-uuid",
  "device_name": "LAPTOP-001"
}
```

响应：

```json
{
  "ok": true,
  "device_count": 1
}
```

### `POST /entitlement/device/unbind`

请求：

```json
{
  "device_id": "win-uuid"
}
```

响应：

```json
{
  "ok": true
}
```

## 订单与支付 Order

### `POST /order/create`

请求：

```json
{
  "plan": "family_yearly",
  "channel": "wechat",
  "return_url": "https://billing.example.com/result"
}
```

响应：

```json
{
  "order_id": "o_123",
  "pay_url": "https://pay.example.com/...",
  "qr_code_url": "https://pay.example.com/qr/o_123"
}
```

### `GET /order/:id/status`

响应：

```json
{
  "order_id": "o_123",
  "status": "paid",
  "paid_at": "2026-03-30T09:00:00.000Z"
}
```

## 是否自建 Project/Backpack 服务

MVP 建议：

1. 本地项目编辑能力优先，云能力先按 entitlement 控制开关。
2. 若走商业化闭环，需尽快规划自建 Project/Asset/Backpack 服务，减少对外部服务耦合。
