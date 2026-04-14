# 知萌目标自动化检查报告

- 时间: 2026-04-14T15:13:49.918Z
- 前端地址: http://host.docker.internal:8601
- 后端地址: http://zhimeng-real-backend:3003
- 总体结果: FAIL

## 步骤结果

- [ ] frontend_http: 请求失败: fetch failed
- [x] backend_health: GET /health -> 200

## 关键响应摘要

```json
{
  "health": {
    "url": "http://zhimeng-real-backend:3003/health",
    "method": "GET",
    "status": 200,
    "ok": true,
    "json": {
      "ok": true,
      "now": "2026-04-14T15:13:49.967Z",
      "storage": "mysql"
    },
    "text": "{\"ok\":true,\"now\":\"2026-04-14T15:13:49.967Z\",\"storage\":\"mysql\"}"
  }
}
```
