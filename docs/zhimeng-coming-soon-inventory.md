# 知萌：Coming Soon / 未开放功能清单

## 目的

将当前仓库中“即将启用 / 未开放 / 依赖 host+token”的入口精确枚举，用于后续授权门禁改造。

## 清单


| 功能                  | 入口文件                                           | 控制方式                                                 | 开放条件                                  |
| ------------------- | ---------------------------------------------- | ---------------------------------------------------- | ------------------------------------- |
| Share（分享）按钮         | `src/components/menu-bar/menu-bar.jsx`         | `!canShare && showComingSoon` 时显示 Coming Soon        | `canShare=true` 且后端分享 API 可用          |
| See Community 按钮    | `src/components/menu-bar/menu-bar.jsx`         | `!enableCommunity && showComingSoon` 时显示 Coming Soon | `enableCommunity=true` 且社区服务可用        |
| My Stuff（我的作品）入口    | `src/components/menu-bar/menu-bar.jsx`         | `!sessionExists && showComingSoon` 时显示 Coming Soon   | `state.session.session.user` 可用       |
| Account Nav（账号菜单）入口 | `src/components/menu-bar/menu-bar.jsx`         | `!sessionExists && showComingSoon` 时显示 Coming Soon   | `state.session.session.user` 可用       |
| Backpack（背包）展开能力    | `src/components/backpack/backpack.jsx`         | `onToggle` 为空时显示 Coming Soon Tooltip                 | `backpackHost` + `token` + `username` |
| 扩展库 disabled 条目     | `src/components/library-item/library-item.jsx` | `disabled=true` 时展示 `Coming Soon`                    | 对应扩展项标记可用                             |
| Action Menu 未实现条目   | `src/components/action-menu/action-menu.jsx`   | `onClick` 缺失时作为 coming soon                          | 为条目提供 `onClick`                       |
| 云保存能力               | `src/components/gui/gui.jsx` 入口 prop           | `canSave=false` 时不可用                                 | `canSave=true` 且 project API 可用       |


## 现有控制面总结

- **顶层 prop 控制**：`showComingSoon`、`canSave`、`canShare`、`enableCommunity`、`backpackVisible`、`backpackHost`
- **会话来源**：`state.session.session.user.{token,username}`
- **host 配置**：`storage.setProjectHost` / `storage.setAssetHost` / `storage.setProjectToken`

## 建议

1. 将 `showComingSoon` 从“统一占位文案”改造为“按授权状态动态文案”（未登录 / 已过期 / 离线超宽限）。
2. 将 `canSave`、`canShare`、`enableCommunity` 改为由 entitlement feature map 派生。
3. 在 `Backpack` 前置校验 entitlement + token 可用性，避免点击后才报错。

