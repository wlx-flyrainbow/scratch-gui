# 知萌目标自动化检查报告

- 时间: 2026-05-07T15:03:34.329Z
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
      "now": "2026-05-07T15:03:34.364Z",
      "storage": "mysql"
    },
    "text": "{\"ok\":true,\"now\":\"2026-05-07T15:03:34.364Z\",\"storage\":\"mysql\"}"
  },
  "health": {
    "url": "http://127.0.0.1:3001/health",
    "method": "GET",
    "status": 200,
    "ok": true,
    "json": {
      "ok": true,
      "now": "2026-05-07T15:03:34.372Z",
      "storage": "mysql"
    },
    "text": "{\"ok\":true,\"now\":\"2026-05-07T15:03:34.372Z\",\"storage\":\"mysql\"}"
  },
  "login": {
    "url": "http://127.0.0.1:3001/auth/login",
    "method": "POST",
    "status": 200,
    "ok": true,
    "json": {
      "access_token": "at_a4022f0ecd704d03bd228906e27ddb81",
      "refresh_token": "rt_4f947fba25374864b3211103a766773a",
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
          "issuedAt": "2026-05-07T15:03:34.452Z",
          "expiresAt": "2026-05-14T15:03:34.452Z"
        }
      }
    },
    "text": "{\"access_token\":\"at_a4022f0ecd704d03bd228906e27ddb81\",\"refresh_token\":\"rt_4f947fba25374864b3211103a766773a\",\"user\":{\"id\":\"1\",\"username\":\"demo\",\"nickname\":\"知萌体验账号\"},\"permissions\":{\"student\":true,\"educator\":false},\"entitlement\":{\"status\":\"inactive\",\"plan\":\"\",\"features\":[],\"device_limit\":3,\"expires_at\":null,\"devices\":[],\"lease\":{\"issuedAt\":\"2026-05-07T15:03:34.452Z\",\"expiresAt\":\"2026-05-14T15:03:34.452Z\"}}}"
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
        "issuedAt": "2026-05-07T15:03:34.454Z",
        "expiresAt": "2026-05-14T15:03:34.454Z"
      }
    },
    "text": "{\"status\":\"inactive\",\"plan\":\"\",\"features\":[],\"device_limit\":3,\"expires_at\":null,\"devices\":[],\"lease\":{\"issuedAt\":\"2026-05-07T15:03:34.454Z\",\"expiresAt\":\"2026-05-14T15:03:34.454Z\"}}"
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
      "paid_at": null
    },
    "text": "{\"order_id\":\"o_1\",\"status\":\"created\",\"paid_at\":null}"
  },
  "mockPaid": {
    "url": "http://127.0.0.1:3001/order/o_1/mock-paid",
    "method": "POST",
    "status": 200,
    "ok": true,
    "json": {
      "ok": true,
      "order_id": "o_1",
      "status": "paid"
    },
    "text": "{\"ok\":true,\"order_id\":\"o_1\",\"status\":\"paid\"}"
  },
  "orderAfter": {
    "url": "http://127.0.0.1:3001/order/o_1/status",
    "method": "GET",
    "status": 200,
    "ok": true,
    "json": {
      "order_id": "o_1",
      "status": "paid",
      "paid_at": "2026-05-07T15:03:34.460Z"
    },
    "text": "{\"order_id\":\"o_1\",\"status\":\"paid\",\"paid_at\":\"2026-05-07T15:03:34.460Z\"}"
  },
  "refresh": {
    "url": "http://127.0.0.1:3001/auth/refresh",
    "method": "POST",
    "status": 200,
    "ok": true,
    "json": {
      "access_token": "at_b4fed8531c684d5f879596b6166d9b84"
    },
    "text": "{\"access_token\":\"at_b4fed8531c684d5f879596b6166d9b84\"}"
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
      "expires_at": "2027-05-07T15:03:34.460Z",
      "devices": [],
      "lease": {
        "issuedAt": "2026-05-07T15:03:34.466Z",
        "expiresAt": "2026-05-14T15:03:34.466Z"
      }
    },
    "text": "{\"status\":\"active\",\"plan\":\"family_yearly\",\"features\":[\"cloud_save\",\"share\",\"community\",\"backpack\"],\"device_limit\":3,\"expires_at\":\"2027-05-07T15:03:34.460Z\",\"devices\":[],\"lease\":{\"issuedAt\":\"2026-05-07T15:03:34.466Z\",\"expiresAt\":\"2026-05-14T15:03:34.466Z\"}}"
  }
}
```
