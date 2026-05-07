# 知萌目标自动化检查报告

- 时间: 2026-05-07T15:26:35.985Z
- 前端地址: http://zhimeng-frontend-static
- 后端地址: http://zhimeng-real-backend:3003
- 支付确认模式: manual-confirm
- 预期初始授权状态: inactive
- 总体结果: PASS

## 步骤结果

- [x] frontend_http: GET http://zhimeng-frontend-static -> 200
- [x] backend_health: GET /health -> 200
- [x] auth_login: POST /auth/login -> 200
- [x] entitlement_initial: GET /entitlement -> 200, status=inactive
- [x] order_create: POST /order/create -> 200
- [x] order_status_before: GET /order/:id/status -> 200
- [x] order_manual_confirm: POST /admin/order/:id/manual-confirm -> 200
- [x] order_status_after: GET /order/:id/status -> 200
- [x] auth_refresh: POST /auth/refresh -> 200
- [x] entitlement_active: GET /entitlement -> 200

## 关键响应摘要

```json
{
  "frontendHead": {
    "url": "http://zhimeng-frontend-static",
    "method": "GET",
    "status": 200,
    "ok": true,
    "json": null,
    "text": "<!DOCTYPE html>\n<html>\n<head>\n<title>Welcome to nginx!</title>\n<style>\nhtml { color-scheme: light dark; }\nbody { width: 35em; margin: 0 auto;\nfont-family: Tahoma, Verdana, Arial, sans-serif; }\n</style>\n</head>\n<body>\n<h1>Welcome to nginx!</h1>\n<p>If you see this page, nginx is successfully installed and working.\nFurther configuration is required for the web server, reverse proxy, \nAPI gateway, load balancer, content cache, or other features.</p>\n\n<p>For online documentation and support please refer to\n<a href=\"https://nginx.org/\">nginx.org</a>.<br/>\nTo engage with the community please visit\n<a href=\"https://community.nginx.org/\">community.nginx.org</a>.<br/>\nFor enterprise grade support, professional services, additional \nsecurity features and capabilities please refer to\n<a href=\"https://f5.com/nginx\">f5.com/nginx</a>.</p>\n\n<p><em>Thank you for using nginx.</em></p>\n</body>\n</html>\n"
  },
  "health": {
    "url": "http://zhimeng-real-backend:3003/health",
    "method": "GET",
    "status": 200,
    "ok": true,
    "json": {
      "ok": true,
      "now": "2026-05-07T15:26:36.040Z",
      "storage": "mysql"
    },
    "text": "{\"ok\":true,\"now\":\"2026-05-07T15:26:36.040Z\",\"storage\":\"mysql\"}"
  },
  "login": {
    "url": "http://zhimeng-real-backend:3003/auth/login",
    "method": "POST",
    "status": 200,
    "ok": true,
    "json": {
      "access_token": "at_dade14ac3f3b412290b3a98ac2fe300b",
      "refresh_token": "rt_da9daf63be9e48b887a614f111b2f521",
      "user": {
        "id": "1",
        "username": "zhimeng_goal_inactive",
        "nickname": "知萌目标验收账号"
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
          "issuedAt": "2026-05-07T15:26:36.206Z",
          "expiresAt": "2026-05-14T15:26:36.206Z"
        }
      }
    },
    "text": "{\"access_token\":\"at_dade14ac3f3b412290b3a98ac2fe300b\",\"refresh_token\":\"rt_da9daf63be9e48b887a614f111b2f521\",\"user\":{\"id\":\"1\",\"username\":\"zhimeng_goal_inactive\",\"nickname\":\"知萌目标验收账号\"},\"permissions\":{\"student\":true,\"educator\":false},\"entitlement\":{\"status\":\"inactive\",\"plan\":\"\",\"features\":[],\"device_limit\":3,\"expires_at\":null,\"devices\":[],\"lease\":{\"issuedAt\":\"2026-05-07T15:26:36.206Z\",\"expiresAt\":\"2026-05-14T15:26:36.206Z\"}}}"
  },
  "entitlementBefore": {
    "url": "http://zhimeng-real-backend:3003/entitlement",
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
        "issuedAt": "2026-05-07T15:26:36.209Z",
        "expiresAt": "2026-05-14T15:26:36.209Z"
      }
    },
    "text": "{\"status\":\"inactive\",\"plan\":\"\",\"features\":[],\"device_limit\":3,\"expires_at\":null,\"devices\":[],\"lease\":{\"issuedAt\":\"2026-05-07T15:26:36.209Z\",\"expiresAt\":\"2026-05-14T15:26:36.209Z\"}}"
  },
  "createOrder": {
    "url": "http://zhimeng-real-backend:3003/order/create",
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
    "url": "http://zhimeng-real-backend:3003/order/o_1/status",
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
  "manualConfirm": {
    "url": "http://zhimeng-real-backend:3003/admin/order/o_1/manual-confirm",
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
    "url": "http://zhimeng-real-backend:3003/order/o_1/status",
    "method": "GET",
    "status": 200,
    "ok": true,
    "json": {
      "order_id": "o_1",
      "status": "fulfilled",
      "provider": "manual",
      "provider_trade_no": "goal-2026-05-07T15-26-35-985Z",
      "paid_at": "2026-05-07T15:26:36.000Z",
      "fulfilled_at": "2026-05-07T15:26:36.000Z"
    },
    "text": "{\"order_id\":\"o_1\",\"status\":\"fulfilled\",\"provider\":\"manual\",\"provider_trade_no\":\"goal-2026-05-07T15-26-35-985Z\",\"paid_at\":\"2026-05-07T15:26:36.000Z\",\"fulfilled_at\":\"2026-05-07T15:26:36.000Z\"}"
  },
  "refresh": {
    "url": "http://zhimeng-real-backend:3003/auth/refresh",
    "method": "POST",
    "status": 200,
    "ok": true,
    "json": {
      "access_token": "at_6380e567dee848e9bd88cfae2cca214a"
    },
    "text": "{\"access_token\":\"at_6380e567dee848e9bd88cfae2cca214a\"}"
  },
  "entitlement": {
    "url": "http://zhimeng-real-backend:3003/entitlement",
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
      "expires_at": "2027-05-07T15:26:36.000Z",
      "devices": [],
      "lease": {
        "issuedAt": "2026-05-07T15:26:36.257Z",
        "expiresAt": "2026-05-14T15:26:36.257Z"
      }
    },
    "text": "{\"status\":\"active\",\"plan\":\"family_yearly\",\"features\":[\"cloud_save\",\"share\",\"community\",\"backpack\"],\"device_limit\":3,\"expires_at\":\"2027-05-07T15:26:36.000Z\",\"devices\":[],\"lease\":{\"issuedAt\":\"2026-05-07T15:26:36.257Z\",\"expiresAt\":\"2026-05-14T15:26:36.257Z\"}}"
  }
}
```
