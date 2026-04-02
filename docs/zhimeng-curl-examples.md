# 知萌：后端 API curl 联调示例

前提：已启动本地 mock 服务（默认 `http://localhost:3001`）。

```bash
npm run auth-server
```

## 健康检查

```bash
curl -s http://localhost:3001/health
```

## 登录

```bash
curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"demo\",\"password\":\"123456\"}"
```

从响应中记下 `access_token` 与 `refresh_token`。

## 拉取授权（entitlement）

将 `ACCESS_TOKEN` 替换为上一步的 `access_token`：

```bash
curl -s http://localhost:3001/entitlement \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

## 刷新 access token

将 `REFRESH_TOKEN` 替换为登录返回的 `refresh_token`：

```bash
curl -s -X POST http://localhost:3001/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"REFRESH_TOKEN\"}"
```

## 登出

```bash
curl -s -i -X POST http://localhost:3001/auth/logout \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"REFRESH_TOKEN\"}"
```

成功时返回 `204 No Content`。

## 设备绑定（可选）

```bash
curl -s -X POST http://localhost:3001/entitlement/device/bind \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"device_id\":\"dev-001\",\"device_name\":\"Test PC\"}"
```
