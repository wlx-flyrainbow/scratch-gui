# 知萌目标自动化检查报告

- 时间: 2026-04-14T15:14:38.792Z
- 前端地址: http://zhimeng-frontend-static
- 后端地址: http://zhimeng-real-backend:3003
- 总体结果: FAIL

## 步骤结果

- [ ] frontend_http: GET http://zhimeng-frontend-static -> 403
- [x] backend_health: GET /health -> 200

## 关键响应摘要

```json
{
  "frontendHead": {
    "url": "http://zhimeng-frontend-static",
    "method": "GET",
    "status": 403,
    "ok": false,
    "json": null,
    "text": "<html>\r\n<head><title>403 Forbidden</title></head>\r\n<body>\r\n<center><h1>403 Forbidden</h1></center>\r\n<hr><center>nginx/1.29.8</center>\r\n</body>\r\n</html>\r\n"
  },
  "health": {
    "url": "http://zhimeng-real-backend:3003/health",
    "method": "GET",
    "status": 200,
    "ok": true,
    "json": {
      "ok": true,
      "now": "2026-04-14T15:14:38.842Z",
      "storage": "mysql"
    },
    "text": "{\"ok\":true,\"now\":\"2026-04-14T15:14:38.842Z\",\"storage\":\"mysql\"}"
  }
}
```
