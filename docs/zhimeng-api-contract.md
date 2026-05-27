# 知萌：后端 API 契约（MVP）

## 认证 Auth

### `POST /auth/register`

客户端内置注册主路径。注册成功后直接返回登录态，但 entitlement 默认为 `inactive`，用户仍需进入订阅中心完成购买和人工确认后才可解锁完整编辑器。

请求：

```json
{
  "username": "new_user",
  "password": "******",
  "nickname": "知萌用户"
}
```

约束：

- `username`：3-32 位字母、数字或下划线。
- `password`：至少 6 位。
- `nickname`：可选。

响应：`201 Created`

```json
{
  "access_token": "jwt_or_opaque",
  "refresh_token": "refresh_token",
  "user": {
    "id": "u_2",
    "username": "new_user",
    "nickname": "知萌用户"
  },
  "permissions": {
    "student": true,
    "educator": false
  },
  "entitlement": {
    "status": "inactive",
    "plan": "",
    "features": []
  }
}
```

错误：

- `400`：账号或密码格式不符合要求。
- `409`：账号已存在。

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

状态口径：

- `inactive`：未开通。
- `active`：已开通且未到期。
- `expired`：数据库状态可能仍为 `active`，但 `subscription_expires_at <= now` 时接口统一返回 `expired`。
- `frozen`：运营冻结，优先级高于到期判断。

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

错误：

- `403 Account frozen`：账号被冻结，客户端应锁定完整编辑器。
- `409 Device limit exceeded`：账号已达到设备上限。MVP 只允许运营在 `ops.html` 解绑旧设备。

### `POST /entitlement/device/unbind`

用户自助解绑在 MVP 阶段不开放。客户端调用该接口会返回 `403`，解绑只由运营通过后台完成。

响应：

```json
{
  "message": "Device unbind requires operator support"
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
  "status": "created",
  "plan": "family_yearly",
  "channel": "wechat",
  "amount_cents": 19900,
  "currency": "CNY",
  "payment_mode": "manual_qr",
  "payment_account_label": "知萌官方收款",
  "payment_note": "付款备注请填写：ZM-o_123",
  "pay_url": "https://billing.example.com/pay.html?order_id=o_123&proof_token=pay_xxx",
  "qr_code_url": "https://cdn.example.com/zhimeng/pay/wechat.png"
}
```

### `GET /order/:id/payment-page`

支付页用订单专用 `proof_token` 拉取公开订单信息。该 token 只用于展示订单和提交付款凭证，不是登录 token。

查询参数：

- `proof_token`：`POST /order/create` 返回的 `pay_url` 中携带

响应：

```json
{
  "order_id": "o_123",
  "status": "created",
  "amount_cents": 19900,
  "currency": "CNY",
  "payment_mode": "manual_qr",
  "payment_account_label": "知萌官方收款",
  "payment_note": "付款备注请填写：ZM-o_123",
  "qr_code_url": "https://cdn.example.com/zhimeng/pay/wechat.png",
  "payment_proof": null
}
```

### `POST /order/:id/payment-proof`

用户扫码付款后提交凭证。网页支付页使用 `proof_token`，客户端也可用 `Authorization` 提交。提交凭证不会把订单标记为 `paid`；订单仍保持 `created`，等待运营核账。

凭证字段按支付渠道填写：

- 微信：`transfer_no` 填“转账单号”，`trade_no_tail` 可填转账单号后 6-10 位。
- 支付宝：`transfer_no` 填“订单号”，`merchant_order_no` 填“商家订单号”，`trade_no_tail` 可填支付宝订单号后 6-10 位。
- 仅有尾号不能单独证明到账，只能作为辅助检索；运营确认必须以收款方账单实际到账为准。
- `proof_attachment` 可选，用于上传付款截图；仅支持 JPG、PNG、WebP，默认最大 5MB。截图只作为辅助证据，不能替代订单号字段。

请求：

```json
{
  "proof_token": "pay_xxx",
  "method": "wechat",
  "paid_at": "2026-05-23T10:00:00.000Z",
  "amount": "199.00",
  "currency": "CNY",
  "transfer_no": "10001073012026022000408766083107",
  "merchant_order_no": "",
  "trade_no_tail": "8766083107",
  "payer_note": "已付款，备注 ZM-o_123",
  "proof_attachment": {
    "filename": "wechat-bill.jpg",
    "mime_type": "image/jpeg",
    "data_url": "data:image/jpeg;base64,..."
  }
}
```

支付宝示例：

```json
{
  "proof_token": "pay_xxx",
  "method": "alipay",
  "paid_at": "2026-04-25T15:35:51.000Z",
  "amount": "199.00",
  "currency": "CNY",
  "transfer_no": "2026042522001495731403194971",
  "merchant_order_no": "17771025413602210395734",
  "trade_no_tail": "1403194971",
  "payer_note": "支付宝账单详情"
}
```

响应：

```json
{
  "order_id": "o_123",
  "status": "created",
  "payment_proof": {
    "method": "wechat",
    "paidAt": "2026-05-23T10:00:00.000Z",
    "amountCents": 19900,
    "currency": "CNY",
    "transferNo": "10001073012026022000408766083107",
    "merchantOrderNo": "",
    "tradeNoTail": "8766083107",
    "attachment": {
      "id": "9f0a...",
      "filename": "wechat-bill.jpg",
      "mimeType": "image/jpeg",
      "sizeBytes": 120000,
      "sha256": "..."
    }
  }
}
```

### `GET /admin/order/:id/payment-proof-attachment/:attachment_id`

管理员查看付款截图。该接口必须携带 `X-Zhimeng-Admin-Token`，图片文件不应暴露为公开静态 URL。

响应：图片二进制，`Content-Type` 为上传时记录的图片类型。

### `GET /order/:id/status`

响应：

```json
{
  "order_id": "o_123",
  "status": "paid",
  "paid_at": "2026-03-30T09:00:00.000Z",
  "payment_proof": null
}
```

### `GET /admin/orders`

Header:

```text
X-Zhimeng-Admin-Token: <admin-token>
```

查询参数：

- `status`：可选，如 `created`
- `has_payment_proof`：可选，传 `1` 时只返回已提交付款凭证的订单
- `limit`：可选，默认 `50`，最大 `200`

响应：

```json
{
  "orders": [
    {
      "order_id": "o_123",
      "status": "created",
      "amount_cents": 19900,
      "currency": "CNY",
      "payment_proof": {
        "method": "wechat",
        "transferNo": "10001073012026022000408766083107",
        "merchantOrderNo": "",
        "tradeNoTail": "123456"
      }
    }
  ]
}
```

该接口供 `website/ops.html` 使用，用于拉取已提交付款凭证、等待人工核账的订单。

### `GET /admin/user/:username`

查询账号授权、设备和历史订单。返回的 `entitlement.status` 使用与 `GET /entitlement` 相同的有效状态口径。

Header:

```text
X-Zhimeng-Admin-Token: <admin-token>
```

响应：

```json
{
  "user": {
    "id": "1",
    "username": "demo",
    "nickname": "知萌体验账号"
  },
  "entitlement": {
    "status": "active",
    "plan": "family_yearly",
    "expires_at": "2027-05-26T00:00:00.000Z",
    "device_limit": 3,
    "status_reason": "",
    "status_updated_at": null,
    "devices": [
      {
        "device_id": "zm_xxx",
        "device_name": "知萌客户端 macOS",
        "last_seen_at": "2026-05-26T10:00:00.000Z"
      }
    ]
  },
  "orders": []
}
```

### `POST /admin/user/:username/freeze`

冻结账号。冻结后客户端下一次联网刷新授权会进入锁定态；离线客户端最多受 7 天离线租约约束。

请求：

```json
{
  "operator": "ops",
  "reason": "risk control",
  "note": "付款争议处理中"
}
```

### `POST /admin/user/:username/unfreeze`

解冻账号。若仍在订阅有效期内，状态恢复为 `active`；若已过期或未开通，恢复为 `inactive`。

请求字段同冻结接口。

### `POST /admin/user/:username/device/unbind`

运营解绑旧设备，解绑后该账号可绑定新设备。

请求：

```json
{
  "device_id": "zm_xxx",
  "operator": "ops",
  "reason": "user changed computer",
  "note": "家长反馈旧电脑已不用"
}
```

## 是否自建 Project/Backpack 服务

MVP 建议：

1. 本地项目编辑能力优先，云能力先按 entitlement 控制开关。
2. 若走商业化闭环，需尽快规划自建 Project/Asset/Backpack 服务，减少对外部服务耦合。
