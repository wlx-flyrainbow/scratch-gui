# 新祥编程公开源码仓库管理方案

## 1. 目标

当前 `scratch-gui` 仓库继续作为核心开发仓库，不改变现有工作流。

另建一个干净的公开源码仓库，用于对外提供 AGPL 对应源码。公开仓库只包含可公开、可构建、可追溯、无密钥、无用户数据的代码和必要文档。

该方案不是为了规避 AGPL，而是为了把 AGPL 对应源码发布变成可控流程：

- 核心仓库保留完整开发上下文、内部文档、运营资料和未公开实验。
- 公开仓库提供发布版本中 AGPL 覆盖部分的完整对应源码。
- 公开仓库不携带核心仓库历史，避免历史提交中存在内部资料或敏感信息。
- 每个公开安装包都能对应到公开仓库的 tag 或 commit。

## 2. 仓库分工

### 2.1 核心仓库

仓库：`scratch-gui`

定位：内部开发主仓库。

可以包含：

- 完整产品开发代码。
- 未发布实验代码。
- 内部 PRD、TASKS、商业化计划、运营方案。
- 发布、部署、验收、种子用户跟进相关内部文档。
- 用于本地开发的脱敏示例配置。

不得提交：

- 真实 `.env`。
- 生产数据库密码。
- 支付密钥、AI key、OSS/CDN key。
- Apple/Windows 证书、私钥、profile。
- 用户数据、订单数据、付款凭证。
- 数据库 dump、真实日志、客服记录。

### 2.2 公开源码仓库

建议仓库名：

- `newsiang-client-public`
- 或 `newsiang-scratch-public`

定位：AGPL 对应源码发布仓库。

必须满足：

- 包含对外发布客户端对应的完整 AGPL 源码。
- 包含构建、安装、运行、修改该客户端所需的源码和脚本。
- 包含 `LICENSE`、`README.md`、必要 NOTICE、构建说明和脱敏配置示例。
- 不包含核心仓库完整 git history。
- 不包含密钥、证书、用户数据、运营数据和内部商业文档。

公开仓库不是演示仓库，也不是精简样例仓库。凡是进入公开安装包、属于 AGPL 覆盖部分且构建/运行/修改需要的源码，都必须能在公开仓库找到。

## 3. 公开范围

### 3.1 必须导出的内容

代码与配置：

- `src/` 中进入客户端包的源码。
- `electron-main.js`、`electron-preload.js` 等 Electron 客户端入口。
- 构建、打包、测试所需的公开脚本。
- `package.json`、lockfile、webpack/babel/eslint 等必要配置。
- `LICENSE`。
- `.env.example` 或公开配置示例。
- 公开源码披露文案。
- 公开运行所需的静态资源和基础素材。

必要文档：

- `README.md`
- `NOTICE` 或 `THIRD_PARTY_NOTICES`
- 构建、安装、运行说明。
- 源码版本与发布包对应说明。
- 必要的公开 API 说明，限于客户端运行和二次开发需要理解的接口。

### 3.2 不导出的内容

私有配置与凭据：

- `.env`
- `.env.production`
- `.secrets`
- `*.pem`
- `*.p12`
- `*.pfx`
- `*.mobileprovision`
- 数据库连接串。
- AI key、支付 key、OSS/CDN key、JWT secret。

用户与运营数据：

- 订单数据。
- 付款凭证。
- 用户表、孩子作品、客服记录。
- 运营备注、利润成本、渠道归因。
- 种子用户跟进表。

商业与内部文档：

- 商业化计划。
- 长期战略。
- 利润目标和定价测算。
- 私域销售话术。
- 7 天陪跑交付 SOP。
- 商标申请材料。
- 代码签名证书申请细节。
- 服务器部署细节。
- 内部验收报告和复盘。

私有服务：

- 生产后端私有业务规则。
- `backend/` 默认不导出；客户端只保留公开 API 契约。
- `docker/`、`docker-compose.yml` 默认不导出；本地数据库和服务编排属于内部开发/部署辅助。
- AI prompt、模型路由、限流和成本控制。
- 付费素材授权源文件。
- 运营后台私有能力。
- 服务器运维、备份和监控脚本。

官网与支付页：

- `website/` 默认不导出。
- 官网销售页、下载页、`pay.html`、`purchase.html`、`releases.json`、`ops.html` 都留在核心仓库。
- 公开仓只保留源码披露文案、构建说明和必要的公开 API 摘要；官网是否展示源码链接由官网部署内容负责，不要求官网源码进入公开仓。

## 4. docs 导出规则

`docs/` 不整体公开，只按白名单导出。

### 4.1 公开 docs 白名单

公开仓库可以包含：

- `docs/agpl-source-disclosure.md`
- `docs/build-and-run.md`
- `docs/public-api.md`
- `docs/third-party-notices.md`
- `docs/release-source-map.md`

如果以上文件当前不存在，应在导出流程中由公开模板生成，或从核心仓库中维护的公开文档复制。

### 4.2 不公开 docs 类型

以下类型默认不进入公开仓库：

- `docs/zhimeng-commercialization-*.md`
- `docs/zhimeng-strategy-*.md`
- `docs/zhimeng-ops-*.md`
- `docs/zhimeng-seed-*.md`
- `docs/zhimeng-2026-revenue-*.md`
- `docs/zhimeng-code-signing-*.md`
- `docs/zhimeng-trademark-*.md`
- `docs/zhimeng-brand-*.md`
- `_bmad-output/`

判断标准：

> 不是构建、安装、运行、修改 AGPL 客户端所必需的文档，不进入公开仓库。

但公开仓库必须保证用户拿到源码后知道如何安装依赖、构建客户端、运行客户端、定位对应发布版本。

## 5. 导出流程

每次公开发布前执行一次导出。

默认本地导出目录：

```text
/Users/apple/wanlexiang/personProject/newsiang-client-public
```

常用命令：

```bash
npm run public:export
npm run public:check
```

如需导出到其他目录：

```bash
ZHIMENG_PUBLIC_SOURCE_DIR=/path/to/newsiang-client-public npm run public:export
ZHIMENG_PUBLIC_SOURCE_DIR=/path/to/newsiang-client-public npm run public:check
```

如需覆盖公开仓库地址：

```bash
ZHIMENG_PUBLIC_SOURCE_URL=https://github.com/<org>/<repo> npm run public:export
```

如果核心仓库有其他未完成改动，发布用导出应从已确认的 Git commit/tag 生成，避免把未提交的客户端代码混入公开仓：

```bash
npm run public:export -- --source-ref HEAD
npm run public:check
```

流程：

1. 在核心仓库完成开发、测试和发布候选确认。
2. 执行 `npm run public:export`，将白名单文件复制到公开仓库工作区；正式发布优先使用 `--source-ref <commit-or-tag>`。
3. 导出脚本生成或更新 `README.md`、`NOTICE`、公开构建说明、公开 API 摘要和源码版本对应说明。
   版本对应说明会分别记录“公开导出输入是否有未提交改动”和“核心仓库整体是否还有未提交改动”。
   发布时要求公开导出输入为干净状态；核心仓库中与公开导出无关的内部工作可以继续保留在核心仓库，不进入公开仓库。
4. 执行 `npm run public:check`，确认无密钥、证书、真实用户数据、订单数据、内部商业文档。
5. 在公开仓库提交并打 tag。
6. 将官网、客户端帮助菜单、安装包发布说明中的源码链接指向公开仓库对应 tag。
7. 保存发布记录：客户端版本、核心仓库 commit、公开仓库 commit/tag、安装包下载地址、发布日期。

不允许手工临时复制文件作为长期流程。手工复制容易漏文件、漏版本，也容易把内部文档或敏感数据带入公开仓库。

当前导出脚本会保留公开仓库的 `.git` 目录，但会清理其他已导出文件后重新生成；因此首次创建公开仓库后，可以在同一目录持续复用该命令。

## 6. 校验清单

发布前必须确认：

- [ ] 公开仓库包含发布客户端对应的完整 AGPL 源码。
- [ ] 公开仓库可以按 README 完成安装依赖和构建。
- [ ] `LICENSE` 存在且与 `package.json` 许可一致。
- [ ] README、官网、客户端帮助菜单指向同一个源码地址或 tag。
- [ ] 公开仓库不含 `.env`、证书、私钥、token、真实数据库连接串。
- [ ] 公开仓库不含订单、付款凭证、用户数据、运营记录。
- [ ] 公开仓库不含商业化计划、利润测算、种子用户 SOP、商标申请材料。
- [ ] 公开仓库不含 `website/` 销售页、支付页、下载元数据和运营台源码。
- [ ] 公开仓库不含 `backend/`、`docker/`、`docker-compose.yml` 和生产/运营后端实现。
- [ ] 安装包版本能映射到公开仓库 tag。
- [ ] 核心仓库仍保留完整内部记录，便于后续排查和继续开发。

## 7. 长期规则

- 进入公开仓库的内容，默认未来长期可公开。
- 不确定是否可公开的内容，先留在核心仓库，不进入公开导出白名单。
- 新增目录或脚本时，必须判断它属于公开源码、私有服务、私有资产还是运营数据。
- 公开仓库只通过标准 API 调用私有服务，不引用私有仓库源码，不使用私有 submodule。
- 私有服务的 API 可以公开必要协议，但密钥、成本策略、风控规则、prompt 和运营逻辑不公开。
- 公开源码导出脚本应可重复执行，导出结果应稳定、可审计、可 diff。
