# 知萌目标自动化检查报告

- 时间: 2026-04-14T14:34:30.853Z
- 前端地址: http://127.0.0.1:8601
- 后端地址: http://127.0.0.1:3001
- 总体结果: PASS

## 步骤结果

- [x] frontend_http: GET http://127.0.0.1:8601 -> 200
- [x] backend_health: GET /health -> 200
- [x] auth_login: POST /auth/login -> 200
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
    "url": "http://127.0.0.1:8601",
    "method": "GET",
    "status": 200,
    "ok": true,
    "json": null,
    "text": "<!DOCTYPE html>\n<html>\n  <head>\n    \n    <meta charset=\"UTF-8\">\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n    <meta name=\"google\" value=\"notranslate\">\n    <link rel=\"shortcut icon\" href=\"static/favicon.ico\">\n    <title>Scratch 3.0 GUI</title>\n  <script defer src=\"gui.js\"></script></head>\n  <body>\n    \n  </body>\n</html>\n"
  },
  "health": {
    "url": "http://127.0.0.1:3001/health",
    "method": "GET",
    "status": 200,
    "ok": true,
    "json": {
      "ok": true,
      "now": "2026-04-14T14:34:30.894Z",
      "storage": "mysql"
    },
    "text": "{\"ok\":true,\"now\":\"2026-04-14T14:34:30.894Z\",\"storage\":\"mysql\"}"
  },
  "login": {
    "url": "http://127.0.0.1:3001/auth/login",
    "method": "POST",
    "status": 200,
    "ok": true,
    "json": {
      "access_token": "at_efae180b9d94470697be9c2072adba43",
      "refresh_token": "rt_6d2bace54cfb45f1af8f2a0d73136783",
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
          "issuedAt": "2026-04-14T14:34:31.327Z",
          "expiresAt": "2026-04-21T14:34:31.327Z"
        }
      }
    },
    "text": "{\"access_token\":\"at_efae180b9d94470697be9c2072adba43\",\"refresh_token\":\"rt_6d2bace54cfb45f1af8f2a0d73136783\",\"user\":{\"id\":\"1\",\"username\":\"demo\",\"nickname\":\"知萌体验账号\"},\"permissions\":{\"student\":true,\"educator\":false},\"entitlement\":{\"status\":\"inactive\",\"plan\":\"\",\"features\":[],\"device_limit\":3,\"expires_at\":null,\"devices\":[],\"lease\":{\"issuedAt\":\"2026-04-14T14:34:31.327Z\",\"expiresAt\":\"2026-04-21T14:34:31.327Z\"}}}"
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
      "paid_at": "2026-04-14T14:34:31.333Z"
    },
    "text": "{\"order_id\":\"o_1\",\"status\":\"paid\",\"paid_at\":\"2026-04-14T14:34:31.333Z\"}"
  },
  "refresh": {
    "url": "http://127.0.0.1:3001/auth/refresh",
    "method": "POST",
    "status": 200,
    "ok": true,
    "json": {
      "access_token": "at_93db11771d4447ebb9abfe986d13b649"
    },
    "text": "{\"access_token\":\"at_93db11771d4447ebb9abfe986d13b649\"}"
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
      "expires_at": "2027-04-14T14:34:31.333Z",
      "devices": [],
      "lease": {
        "issuedAt": "2026-04-14T14:34:31.338Z",
        "expiresAt": "2026-04-21T14:34:31.338Z"
      }
    },
    "text": "{\"status\":\"active\",\"plan\":\"family_yearly\",\"features\":[\"cloud_save\",\"share\",\"community\",\"backpack\"],\"device_limit\":3,\"expires_at\":\"2027-04-14T14:34:31.333Z\",\"devices\":[],\"lease\":{\"issuedAt\":\"2026-04-14T14:34:31.338Z\",\"expiresAt\":\"2026-04-21T14:34:31.338Z\"}}"
  }
}
```
