# 知萌目标自动化检查报告

- 时间: 2026-05-07T15:21:08.082Z
- 前端地址: http://127.0.0.1:3001/health
- 后端地址: http://127.0.0.1:3001
- 支付确认模式: mock-paid
- 预期初始授权状态: inactive
- 总体结果: PASS

## 步骤结果

- [x] frontend_http: GET http://127.0.0.1:3001/health -> 200
- [x] backend_health: GET /health -> 200
- [x] auth_login: POST /auth/login -> 200
- [x] entitlement_initial: GET /entitlement -> 200, status=inactive
- [x] order_create: POST /order/create -> 200
- [x] order_status_before: GET /order/:id/status -> 200
- [x] order_mock_paid: POST /order/:id/mock-paid -> 200
- [x] order_status_after: GET /order/:id/status -> 200
- [x] auth_refresh: POST /auth/refresh -> 200
- [x] entitlement_active: GET /entitlement -> 200

## 关键响应摘要

```json
{
  "frontendHead": {
    "url": "http://127.0.0.1:3001/health",
    "method": "GET",
    "status": 200,
    "ok": true,
    "json": {
      "ok": true,
      "now": "2026-05-07T15:21:08.131Z",
      "storage": "mysql"
    },
    "text": "{\"ok\":true,\"now\":\"2026-05-07T15:21:08.131Z\",\"storage\":\"mysql\"}"
  },
  "health": {
    "url": "http://127.0.0.1:3001/health",
    "method": "GET",
    "status": 200,
    "ok": true,
    "json": {
      "ok": true,
      "now": "2026-05-07T15:21:08.144Z",
      "storage": "mysql"
    },
    "text": "{\"ok\":true,\"now\":\"2026-05-07T15:21:08.144Z\",\"storage\":\"mysql\"}"
  },
  "login": {
    "url": "http://127.0.0.1:3001/auth/login",
    "method": "POST",
    "status": 200,
    "ok": true,
    "json": {
      "access_token": "at_f42e570f67fa4540b6ea68ae7a8cd7e2",
      "refresh_token": "rt_ed40c9afa41045db8030a7cd3e780a3d",
      "user": {
        "id": "1",
        "username": "demo",
        "nickname": "知萌体验账号"
      },
      "permissions": {
        "student": true,
        "educator": false
      },
      "entitlement": {
        "status": "inactive",
        "plan": "",
        "features": [],
        "device_limit": 3,
        "expires_at": null,
        "devices": [],
        "lease": {
          "issuedAt": "2026-05-07T15:21:08.253Z",
          "expiresAt": "2026-05-14T15:21:08.253Z"
        }
      }
    },
    "text": "{\"access_token\":\"at_f42e570f67fa4540b6ea68ae7a8cd7e2\",\"refresh_token\":\"rt_ed40c9afa41045db8030a7cd3e780a3d\",\"user\":{\"id\":\"1\",\"username\":\"demo\",\"nickname\":\"知萌体验账号\"},\"permissions\":{\"student\":true,\"educator\":false},\"entitlement\":{\"status\":\"inactive\",\"plan\":\"\",\"features\":[],\"device_limit\":3,\"expires_at\":null,\"devices\":[],\"lease\":{\"issuedAt\":\"2026-05-07T15:21:08.253Z\",\"expiresAt\":\"2026-05-14T15:21:08.253Z\"}}}"
  },
  "entitlementBefore": {
    "url": "http://127.0.0.1:3001/entitlement",
    "method": "GET",
    "status": 200,
    "ok": true,
    "json": {
      "status": "inactive",
      "plan": "",
      "features": [],
      "device_limit": 3,
      "expires_at": null,
      "devices": [],
      "lease": {
        "issuedAt": "2026-05-07T15:21:08.256Z",
        "expiresAt": "2026-05-14T15:21:08.256Z"
      }
    },
    "text": "{\"status\":\"inactive\",\"plan\":\"\",\"features\":[],\"device_limit\":3,\"expires_at\":null,\"devices\":[],\"lease\":{\"issuedAt\":\"2026-05-07T15:21:08.256Z\",\"expiresAt\":\"2026-05-14T15:21:08.256Z\"}}"
  },
  "createOrder": {
    "url": "http://127.0.0.1:3001/order/create",
    "method": "POST",
    "status": 200,
    "ok": true,
    "json": {
      "order_id": "o_1",
      "pay_url": "https://billing.zhimeng.example.com/pay/1",
      "qr_code_url": "https://billing.zhimeng.example.com/qr/1"
    },
    "text": "{\"order_id\":\"o_1\",\"pay_url\":\"https://billing.zhimeng.example.com/pay/1\",\"qr_code_url\":\"https://billing.zhimeng.example.com/qr/1\"}"
  },
  "orderBefore": {
    "url": "http://127.0.0.1:3001/order/o_1/status",
    "method": "GET",
    "status": 200,
    "ok": true,
    "json": {
      "order_id": "o_1",
      "status": "created",
      "provider": "wechat",
      "provider_trade_no": null,
      "paid_at": null,
      "fulfilled_at": null
    },
    "text": "{\"order_id\":\"o_1\",\"status\":\"created\",\"provider\":\"wechat\",\"provider_trade_no\":null,\"paid_at\":null,\"fulfilled_at\":null}"
  },
  "mockPaid": {
    "url": "http://127.0.0.1:3001/order/o_1/mock-paid",
    "method": "POST",
    "status": 200,
    "ok": true,
    "json": {
      "ok": true,
      "order_id": "o_1",
      "status": "fulfilled",
      "idempotent": false
    },
    "text": "{\"ok\":true,\"order_id\":\"o_1\",\"status\":\"fulfilled\",\"idempotent\":false}"
  },
  "orderAfter": {
    "url": "http://127.0.0.1:3001/order/o_1/status",
    "method": "GET",
    "status": 200,
    "ok": true,
    "json": {
      "order_id": "o_1",
      "status": "fulfilled",
      "provider": "mock",
      "provider_trade_no": null,
      "paid_at": "2026-05-07T15:21:08.264Z",
      "fulfilled_at": "2026-05-07T15:21:08.264Z"
    },
    "text": "{\"order_id\":\"o_1\",\"status\":\"fulfilled\",\"provider\":\"mock\",\"provider_trade_no\":null,\"paid_at\":\"2026-05-07T15:21:08.264Z\",\"fulfilled_at\":\"2026-05-07T15:21:08.264Z\"}"
  },
  "refresh": {
    "url": "http://127.0.0.1:3001/auth/refresh",
    "method": "POST",
    "status": 200,
    "ok": true,
    "json": {
      "access_token": "at_51532d9f5227413488bcecc2881d4fd0"
    },
    "text": "{\"access_token\":\"at_51532d9f5227413488bcecc2881d4fd0\"}"
  },
  "entitlement": {
    "url": "http://127.0.0.1:3001/entitlement",
    "method": "GET",
    "status": 200,
    "ok": true,
    "json": {
      "status": "active",
      "plan": "family_yearly",
      "features": [
        "cloud_save",
        "share",
        "community",
        "backpack"
      ],
      "device_limit": 3,
      "expires_at": "2027-05-07T15:21:08.264Z",
      "devices": [],
      "lease": {
        "issuedAt": "2026-05-07T15:21:08.272Z",
        "expiresAt": "2026-05-14T15:21:08.272Z"
      }
    },
    "text": "{\"status\":\"active\",\"plan\":\"family_yearly\",\"features\":[\"cloud_save\",\"share\",\"community\",\"backpack\"],\"device_limit\":3,\"expires_at\":\"2027-05-07T15:21:08.264Z\",\"devices\":[],\"lease\":{\"issuedAt\":\"2026-05-07T15:21:08.272Z\",\"expiresAt\":\"2026-05-14T15:21:08.272Z\"}}"
  }
}
```
