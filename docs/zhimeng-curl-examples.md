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

同一账号最多绑定 3 台设备。第 4 台返回 `409 Device limit exceeded`；用户自助解绑暂不开放，由运营在 `ops.html` 或后台接口处理。

## 运营查询、冻结和解绑设备

```bash
curl -s http://localhost:3001/admin/user/demo \
  -H "X-Zhimeng-Admin-Token: ADMIN_TOKEN"

curl -s -X POST http://localhost:3001/admin/user/demo/freeze \
  -H "X-Zhimeng-Admin-Token: ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"operator\":\"ops\",\"reason\":\"payment dispute\",\"note\":\"退款处理中\"}"

curl -s -X POST http://localhost:3001/admin/user/demo/unfreeze \
  -H "X-Zhimeng-Admin-Token: ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"operator\":\"ops\",\"reason\":\"resolved\"}"

curl -s -X POST http://localhost:3001/admin/user/demo/device/unbind \
  -H "X-Zhimeng-Admin-Token: ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"device_id\":\"dev-001\",\"operator\":\"ops\",\"reason\":\"changed computer\"}"
```
