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

## 2. 当前服务器磁盘状态

检查时间：2026-05-25

当前服务器根盘：

- 规格：40G 系统盘。
- 清理前：`37G/40G`，使用率 `98%`，可用空间约 `889M`。
- 已执行低风险清理：删除旧上传包、压缩 systemd journal、清空宝塔回收站。
- 清理后：`31G/40G`，使用率 `82%`，可用空间约 `6.8G`。

主要占用来源：

| 路径 | 占用 | 判断 |
| --- | ---: | --- |
| `/www/wwwroot/zhimeng/downloads` | 约 1.2G | 当前线上 4 个安装包，不能直接删除 |
| `/www/wwwroot/zhimeng-app/scratch-gui` | 约 1.1G | 部署代码、`.git`、`node_modules` |
| `/www/backup/zhimeng-prod-site-20260525134124.tar.gz` | 约 1.1G | 本次部署备份，可确认后转存或删除 |
| `/root/backup_wwwroot_20260310.tar.gz` | 约 2.4G | 历史站点备份，可确认后转存或删除 |
| `/www/server` | 约 4.7G | 宝塔、MySQL、运行环境 |

短期风险：

- 40G 系统盘对多站点 + 安装包 + Node 依赖 + MySQL + 宝塔备份来说偏小。
- 只靠清理可以暂时降到 80% 左右，但后续每次上传 4 个安装包或部署备份都会再次逼近 90%。
- 根盘打满会影响 MySQL 写入、PM2 日志、Nginx 日志、宝塔面板和部署脚本。

## 3. 扩容到 100G 的成本估算

当前目标是将系统盘从 40G 扩到 100G，新增容量约 60G。

> 注意：云盘最终费用取决于地域、云盘类型、实例付费方式、是否包年包月、是否有活动折扣。下面用于决策估算，正式执行前必须以阿里云 ECS 控制台“云盘扩容”页面的实际报价为准。

### 3.1 估算口径

阿里云 ECS 云盘支持按量付费和包年包月。知萌服务器当前在华北 2 北京，适合直接在原系统盘上做在线扩容，不建议为了省少量磁盘费迁移服务器。

按常见 ESSD / ESSD Entry / 高效云盘价格口径，新增 60G 的成本大致可以按以下区间预估：

| 方案 | 新增容量 | 粗略月成本 | 粗略年成本 | 适用判断 |
| --- | ---: | ---: | ---: | --- |
| 高效云盘或入门型云盘 | 60G | 约 15-30 元/月 | 约 180-360 元/年 | 够用，但性能和规格需看当前系统盘类型 |
| ESSD Entry / ESSD PL0 | 60G | 约 30-60 元/月 | 约 360-720 元/年 | 更推荐，价格可接受，运维简单 |
| 更高等级 ESSD | 60G | 约 60 元/月以上 | 约 720 元/年以上 | 当前知萌没有必要 |

保守预算：

- 按月：准备 `50 元/月` 左右的磁盘增量预算。
- 按年：准备 `600 元/年` 左右的磁盘增量预算。
- 若控制台有包年包月折扣，实际可能低于该估算。

### 3.2 扩容收益

扩到 100G 后：

- 当前已用约 31G，占用率会降到约 31%。
- 即使保留当前 4 个安装包、Node 依赖、部署备份和 MySQL 数据，也有较大缓冲。
- 能降低“部署中途磁盘满导致站点/数据库异常”的风险。

但扩容不能替代 OSS + CDN：

- 安装包下载会持续消耗服务器磁盘和带宽。
- 每个版本 4 个安装包约 1.2G，保留 3 个版本就是约 3.6G。
- 如果未来用户量增加，安装包下载流量由 ECS/Nginx 承担，不如 OSS + CDN 稳。

### 3.3 扩容实施步骤

建议在低峰期执行：

1. 在阿里云控制台为当前 ECS 系统盘创建快照。
2. 在 ECS 控制台选择云盘扩容，将系统盘从 40G 扩到 100G。
3. 等待控制台扩容完成。
4. 登录服务器确认块设备容量：

```bash
lsblk
df -h /
```

5. 如果文件系统未自动扩展，按系统类型执行在线扩容。

AlmaLinux / ext4 常见命令：

```bash
growpart /dev/vda 1
resize2fs /dev/vda1
df -h /
```

如果文件系统是 XFS：

```bash
growpart /dev/vda 1
xfs_growfs /
df -h /
```

6. 验证服务：

```bash
curl -fsS https://zhimeng.codevalley.cn/health
pm2 status
```

7. 在宝塔首页确认磁盘使用率已经下降。

## 4. OSS + CDN 成本模型

### 4.1 当前安装包规模

当前 1.0.0 版本安装包：

| 文件 | 大小 |
| --- | ---: |
| macOS Apple 芯片版 DMG | 约 312M |
| macOS Intel 芯片版 DMG | 约 317M |
| Windows 安装版 EXE | 约 253M |
| Windows 便携版 EXE | 约 253M |
| 合计 | 约 1.2G |

如果 OSS 只保存最近 2 个正式版本：

- 存储量约 2.4G。
- 按 OSS 标准存储单价估算，存储费通常只是每月几毛钱级别。

真正需要关注的是 CDN 下载流量。

### 4.2 OSS 费用组成

OSS 费用通常包括：

- 存储费用：对象占用容量。
- 请求费用：上传、下载、列举等请求。
- 流量费用：如果通过 CDN 分发，主要看 CDN 下行流量和回源策略。

首发阶段对象数量少、请求量低，OSS 本身费用可以忽略不计；核心成本来自安装包被下载产生的 CDN 下行流量。

参考估算：

| 月下载次数 | 单次平均下载 | 月 CDN 流量 | 粗略判断 |
| ---: | ---: | ---: | --- |
| 100 次 | 300M | 约 30G | 成本很低 |
| 1,000 次 | 300M | 约 300G | 仍适合按量或小流量包 |
| 10,000 次 | 300M | 约 3T | 应购买 CDN 流量包并监控成本 |

说明：

- 这里按用户只下载一个安装包估算，不按 4 个包全部下载。
- 若用户反复下载、下载失败重试或多个平台都下载，流量会放大。
- CDN 价格有地域阶梯和资源包差异，正式预算以阿里云 CDN 控制台为准。

### 4.3 扩盘 vs OSS + CDN

| 方案 | 解决的问题 | 不能解决的问题 |
| --- | --- | --- |
| 系统盘扩到 100G | 防止服务器根盘被部署、日志、备份打满 | 不能降低安装包下载带宽压力 |
| OSS + CDN | 安装包分发、下载速度、流量承载、源站减压 | 不能替代服务器运行 API、数据库和部署空间 |
| 两者都做 | 服务器稳定 + 下载分发稳定 | 成本略高，但首发阶段仍可控 |

推荐结论：

1. 磁盘扩容到 100G：作为基础稳定性改造，建议做。
2. 安装包迁到 OSS + CDN：作为产品化下载分发改造，建议做。
3. 当前正式服务器保留最近 1 个版本安装包作为应急兜底，其余版本从 OSS/CDN 下载。

## 5. 目标范围

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

## 6. OSS 资源规划

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

## 7. CDN 规划

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

## 8. 权限与安全

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

## 9. 实施阶段

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

### Phase 1.5：服务器磁盘扩容

目标：在 OSS/CDN 完成前先把根盘风险降下来。

任务：

1. 阿里云控制台创建 ECS 系统盘快照。
2. 系统盘扩容到 100G。
3. 服务器内扩展分区和文件系统。
4. 验证 `df -h /` 使用率低于 50%。
5. 验证知萌官网、API、运营页可用。

验收：

```bash
df -h /
curl -fsS https://zhimeng.codevalley.cn/health
pm2 status
```

预期：

- `/` 总容量约 100G。
- 当前使用率约 30%-40%。
- `zhimeng-api-prod` 为 `online`。

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

## 10. 发布操作顺序

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

## 11. 回滚方案

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

## 12. 成本控制

首发阶段建议：

- OSS 使用按量付费。
- 不急着购买大额资源包。
- 下载量稳定后再评估 OSS 存储包和 CDN 流量包。
- 安装包保留最近 2-3 个版本，历史版本归档或删除。
- 测试环境付款截图 30 天自动删除。
- 宝塔服务器只保留最近 1 个稳定安装包版本作为应急兜底。
- `/www/backup` 只保留最近 1-2 次部署备份，其余转存 OSS 或删除。
- systemd journal 固定限制到 200M-500M。

重点监控：

- CDN 下行流量。
- OSS 外网流出流量。
- 安装包下载次数。
- 4xx/5xx 比例。
- 私有 Bucket 请求失败数。
- ECS 根盘使用率，超过 80% 预警，超过 90% 立即清理或扩容。

## 13. 推荐落地顺序

推荐按这个顺序推进：

1. 先扩容 ECS 系统盘到 100G，消除根盘打满风险。
2. 删除或转存旧备份：
   - `/root/backup_wwwroot_20260310.tar.gz`
   - `/www/backup/zhimeng-prod-site-20260525134124.tar.gz`
3. 配置 journal 上限和宝塔回收站清理策略。
4. 创建 OSS Bucket 和 CDN 域名。
5. 上传 1.0.0 四个安装包到 OSS。
6. 将 `releases.json` 下载地址切换到 CDN。
7. 验证下载、官网、API、运营页。
8. 后续再迁移付款凭证到私有 OSS。

## 14. 完成标准

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
