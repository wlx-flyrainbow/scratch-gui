# 知萌 OSS + CDN 实施计划

## 1. 决策结论

当前阶段采用阿里云 OSS + CDN，不自建 MinIO。

原因：

- 知萌当前对象存储主要服务于官网静态资源、`releases.json`、桌面安装包下载，以及后续付款凭证附件。
- 这些资源更需要稳定公网访问、HTTPS、CDN、权限控制和低运维成本。
- MinIO 更适合已有稳定运维能力、较大存储规模、内网私有化或强自主管控诉求的场景；当前阶段自建会增加服务器、磁盘、备份、监控、扩容和安全升级成本。

实施原则：

- 公开下载资源走 OSS 公有读 + CDN。
- 付款截图/凭证走私有 OSS Bucket，不能暴露为公开静态 URL。
- 代码层保留存储抽象，避免业务逻辑绑定单一云厂商。

## 2. 目标范围

### P0：安装包与官网静态分发

- `website/` 静态站资源。
- `website/releases.json`。
- macOS Apple 芯片版安装包。
- macOS Intel 版安装包。
- Windows NSIS 安装包。
- Windows portable 包。

### P1：付款凭证附件迁移

- 用户上传的付款截图。
- 管理后台查看付款截图。
- 订单表只保存附件元数据和 `storage_key`，不保存二进制。

### 暂不实施

- MinIO 自建集群。
- 多云对象存储同步。
- 自动更新差分包。
- 大规模日志、素材库或用户作品存储。

## 3. OSS 资源规划

建议使用两个 Bucket，减少公开资源和隐私附件混放风险。

| Bucket | 访问级别 | 用途 | 建议域名 |
| --- | --- | --- | --- |
| `zhimeng-public` | 公有读 | 官网静态资源、安装包、`releases.json` | `download.codevalley.cn` 或 CDN 域名 |
| `zhimeng-private` | 私有 | 付款截图/凭证附件 | 不直接绑定公网下载域名 |

目录建议：

```text
zhimeng-public/
  website/
    index.html
    pay.html
    ops.html
    assets/
    releases.json
  downloads/
    1.0.0/
      zhimeng-mac-arm64.dmg
      zhimeng-mac-x64.dmg
      zhimeng-windows-x64-setup.exe
      zhimeng-windows-x64-portable.exe

zhimeng-private/
  payment-proofs/
    prod/
      yyyy/mm/dd/<order_id>/<file_id>.<ext>
    test/
      yyyy/mm/dd/<order_id>/<file_id>.<ext>
```

缓存策略：

| 资源 | Cache-Control |
| --- | --- |
| `releases.json` | `public, max-age=300` |
| `index.html` / `pay.html` / `ops.html` | `public, max-age=300` |
| CSS / JS / 图片 | `public, max-age=86400` |
| 安装包 | `public, max-age=31536000, immutable` |

## 4. CDN 规划

### P0 域名选择

建议优先使用独立下载域名：

- `download.codevalley.cn`

好处：

- 下载流量与主站/API 解耦。
- 后续替换 CDN 或对象存储时不影响客户端 API 域名。
- `zhimeng.codevalley.cn` 可以继续服务官网、付款页、运营页和后端反向代理。

如果想减少域名配置，也可以先用：

- `https://zhimeng.codevalley.cn/downloads/...`

但这个路径目前依赖宝塔/Nginx 站点目录，后续切 OSS/CDN 时需要调整 Nginx 或 URL。

### CDN 配置

- 源站：`zhimeng-public` OSS Bucket。
- HTTPS：开启强制 HTTPS。
- 回源 Host：按阿里云 CDN + OSS 推荐配置。
- 缓存刷新：
  - 发布新版本后刷新 `releases.json`。
  - 安装包文件名带版本号，正常不需要频繁刷新。
- 防盗链：
  - P0 可以先不开，避免影响正常下载。
  - 下载量变大后再启用 Referer 白名单或签名 URL。

## 5. 权限与安全

### RAM 用户

创建专用 RAM 用户或角色，不使用主账号 AccessKey。

建议拆分两类权限：

| 身份 | 权限 | 用途 |
| --- | --- | --- |
| `zhimeng-release-uploader` | 写 `zhimeng-public` 指定前缀，刷新 CDN | 发布安装包和静态站 |
| `zhimeng-server-storage` | 读写 `zhimeng-private/payment-proofs/*` | 后端处理付款凭证 |

### 私有附件访问

付款截图访问必须满足：

- Bucket 私有。
- 管理员接口校验 `X-Zhimeng-Admin-Token`。
- 后端生成短期签名 URL，或由后端读取后代理返回。
- 不把私有附件 URL 写入 `payment_proof_json` 给前端直接展示。
- 日志中不打印 AccessKey、签名 URL、完整附件内容。

### 生命周期

建议先设置：

- `zhimeng-public/downloads/`：不自动删除，手工保留最近 2-3 个稳定版本。
- `zhimeng-private/payment-proofs/prod/`：保留 365 天。
- `zhimeng-private/payment-proofs/test/`：保留 30 天。

## 6. 实施阶段

### Phase 1：OSS/CDN 基础设施

目标：准备公开下载能力。

任务：

1. 创建 `zhimeng-public` Bucket。
2. 创建 `zhimeng-private` Bucket。
3. 为 `zhimeng-public` 配置 CDN 域名。
4. 申请并绑定 HTTPS 证书。
5. 配置缓存规则。
6. 创建 RAM 用户和最小权限策略。
7. 本地安装并配置 `ossutil` 或发布脚本所需凭证。

验收：

```bash
curl -I https://download.codevalley.cn/website/releases.json
curl -I https://download.codevalley.cn/downloads/1.0.0/zhimeng-windows-x64-setup.exe
```

预期：

- HTTP 状态为 `200`。
- `releases.json` 缓存时间约 5 分钟。
- 安装包缓存时间较长。
- HTTPS 证书有效。

### Phase 2：安装包上传与下载清单切换

目标：让正式下载地址从服务器本地目录切到 OSS/CDN。

任务：

1. 生成正式安装包。
2. 上传安装包到 `zhimeng-public/downloads/<version>/`。
3. 设置 `.env.production` 中四个下载地址：

```bash
ZHIMENG_MACOS_ARM64_URL=https://download.codevalley.cn/downloads/1.0.0/zhimeng-mac-arm64.dmg
ZHIMENG_MACOS_X64_URL=https://download.codevalley.cn/downloads/1.0.0/zhimeng-mac-x64.dmg
ZHIMENG_WINDOWS_NSIS_URL=https://download.codevalley.cn/downloads/1.0.0/zhimeng-windows-x64-setup.exe
ZHIMENG_WINDOWS_PORTABLE_URL=https://download.codevalley.cn/downloads/1.0.0/zhimeng-windows-x64-portable.exe
```

4. 更新下载清单：

```bash
set -a
. ./.env.production
set +a
npm run release:update-downloads
```

5. 上传 `website/releases.json`。
6. 刷新 CDN 中的 `website/releases.json` 或根路径对应清单。

验收：

```bash
npm run release:check
npm run release:verify-public
```

同时手工检查：

- 官网下载按钮能下载四个包。
- `website/releases.json` 不包含 `YOUR-CDN`、`example.com`、`localhost`。
- 新版本清单发布前，安装包 URL 已经全部可访问，避免用户点到 404。

### Phase 3：静态站迁移到 OSS/CDN

目标：把官网静态资源也迁到 OSS/CDN，降低宝塔站点静态流量压力。

任务：

1. 上传 `website/` 全量文件到 `zhimeng-public/website/`。
2. 确认默认首页和路径规则。
3. 决定访问方式：
   - 方案 A：`download.codevalley.cn/website/` 只承载下载页。
   - 方案 B：`zhimeng.codevalley.cn` 仍由 Nginx 承载官网，下载资源走 `download.codevalley.cn`。
4. 当前建议采用方案 B，保留同域付款/API 流程，先只把大文件下载迁走。

验收：

```bash
curl -fsS https://zhimeng.codevalley.cn/releases.json
curl -I https://download.codevalley.cn/downloads/1.0.0/zhimeng-windows-x64-setup.exe
```

### Phase 4：付款凭证迁移到私有 OSS

目标：替换当前本地 `ZHIMENG_PAYMENT_PROOF_STORAGE_DIR` 存储层。

后端改造建议：

1. 新增存储配置：

```bash
ZHIMENG_STORAGE_PROVIDER=oss
ZHIMENG_OSS_REGION=oss-cn-xxx
ZHIMENG_OSS_PRIVATE_BUCKET=zhimeng-private
ZHIMENG_OSS_PAYMENT_PROOF_PREFIX=payment-proofs/prod
ZHIMENG_OSS_ACCESS_KEY_ID=...
ZHIMENG_OSS_ACCESS_KEY_SECRET=...
ZHIMENG_OSS_SIGNED_URL_EXPIRES_SECONDS=300
```

2. 新增 `StorageProvider` 抽象：

```text
putObject(key, buffer, metadata)
getSignedReadUrl(key, expiresSeconds)
deleteObject(key)
```

3. 保留本地存储实现作为开发环境默认值。
4. 生产环境切 OSS 实现。
5. 管理员查看付款截图时，仍从受保护接口进入，不直接暴露 OSS 永久地址。

验收：

```bash
npm run test:backend
```

手工检查：

- 用户可以提交付款凭证。
- 后端数据库只保存元数据和 `storage_key`。
- 管理员可以查看截图。
- 未携带 admin token 不能查看截图。
- OSS 控制台能看到对象落在 `payment-proofs/prod/`。

## 7. 发布操作顺序

正式发版时按这个顺序：

1. 构建并签名安装包。
2. 上传安装包到 OSS/CDN。
3. 用 `curl -I` 确认四个安装包 URL 都是 `200`。
4. 更新 `website/releases.json`。
5. 上传并刷新 `releases.json`。
6. 执行 `npm run release:check`。
7. 执行 `npm run release:verify-public`。
8. 再对外发布下载入口。

不要先发布新的 `releases.json` 再上传安装包。

## 8. 回滚方案

### 下载包回滚

1. 恢复上一版本 `releases.json`。
2. 上传并刷新 CDN。
3. 验证上一版本四个下载 URL。
4. 官网公告或客服口径说明当前推荐版本。

### OSS/CDN 故障

短期应急：

- 将 `releases.json` 切回 `https://zhimeng.codevalley.cn/downloads/` 本地下载目录。
- 宝塔/Nginx 保留最近一个稳定版本安装包作为兜底。

长期处理：

- 排查 CDN 回源、证书、Bucket 权限、RAM 权限和缓存规则。
- 修复后再切回 CDN 地址。

## 9. 成本控制

首发阶段建议：

- OSS 使用按量付费。
- 不急着购买大额资源包。
- 下载量稳定后再评估 OSS 存储包和 CDN 流量包。
- 安装包保留最近 2-3 个版本，历史版本归档或删除。
- 测试环境付款截图 30 天自动删除。

重点监控：

- CDN 下行流量。
- OSS 外网流出流量。
- 安装包下载次数。
- 4xx/5xx 比例。
- 私有 Bucket 请求失败数。

## 10. 完成标准

P0 完成标准：

- `download.codevalley.cn` 或等价 CDN 域名可用。
- 四个安装包均在 OSS/CDN 上返回 `200`。
- `website/releases.json` 指向 OSS/CDN 真实 HTTPS 地址。
- `npm run release:check` 通过。
- `npm run release:verify-public` 通过。
- 宝塔服务器不再承担大安装包下载流量。

P1 完成标准：

- 付款截图写入私有 OSS。
- 后端接口仍保持受保护访问。
- 本地开发仍可使用本地目录存储。
- 数据库不保存二进制，只保存元数据和 `storage_key`。
- 生产和测试环境使用不同前缀或不同 Bucket 隔离。
