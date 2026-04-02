# BMAD skills 与 IDE 同步

BMAD 技能的**唯一维护位置**是仓库中的 [`_bmad/`](../_bmad/)，清单见 [`_bmad/_config/skill-manifest.csv`](../_bmad/_config/skill-manifest.csv)。Cursor、OpenCode、Trae 等工具需要在各自目录下发现 `SKILL.md`，因此本仓库用脚本把 canonical 目录**复制**到多个 IDE 技能根目录，避免在 `.cursor/`、`.opencode/`、`.trae/` 里手改重复副本。

## 何时执行

- 克隆仓库之后
- 从 `_bmad/` 拉取或修改了 BMAD 技能内容之后
- 发现 Agent 找不到某个 `bmad-*` 技能时

## 命令

在项目根目录：

```bash
npm run bmad:sync
```

脚本会读取 `skill-manifest.csv`，将每个技能所在目录同步到：

- `.cursor/skills/<name>/`
- `.opencode/skills/<name>/`
- `.trae/skills/<name>/`

这些路径已列入 `.gitignore`，**不要**把同步结果提交进 Git；合并请求里只应出现对 `_bmad/` 的修改。

## 修改流程约定

1. 只编辑 `_bmad/` 下对应技能文件（或将来通过 BMAD 官方安装器升级 `_bmad/`）。
2. 运行 `npm run bmad:sync`。
3. 本地 IDE 即可加载最新技能；`bmad-init` 等脚本路径以 `_bmad/core/bmad-init/scripts/` 为准，与清单一致。
