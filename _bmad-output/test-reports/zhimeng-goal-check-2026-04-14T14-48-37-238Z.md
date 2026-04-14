# 知萌目标自动化检查报告

- 时间: 2026-04-14T14:48:37.238Z
- 前端地址: http://127.0.0.1:8601
- 后端地址: http://127.0.0.1:3003
- 总体结果: FAIL

## 步骤结果

- [x] frontend_http: GET http://127.0.0.1:8601 -> 200
- [ ] backend_health: 请求失败: fetch failed

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
  }
}
```
