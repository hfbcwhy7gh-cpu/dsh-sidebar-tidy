# Changelog

## 0.2.0 — 2026-10-11

新增设置页，两种展开方式可选。

- **新增设置页「侧栏收纳」**（`settings.section` 槽）：用 DSH 官方 `SegmentedControl` 在「悬停展开 / 点击展开」之间切换，取不到该包时退回自绘控件。
- **新增「记住展开状态」开关**（官方 `Switch`）：只在「点击展开」模式下可用；打开后开合状态跨刷新保留，关掉即清除记录。
- **点击展开模式**：点击入口行展开 / 收起，文案在「更多 / 收起」间切换；此模式下不再有 220ms 延迟收起。
- 默认仍是 **悬停展开、不记忆**，与 0.1.1 行为一致；选择本身记在 `localStorage["dsh-sidebar-tidy:mode"]`（`hover` / `click`），开合状态记在 `dsh-sidebar-tidy:click-open`。
- 设置页文案跟随 DSH 语言（中文「展开方式」/「记住展开状态」，英文 "Expansion mode" / "Remember the expansion state"）。
- 折叠态提示点、失败安全（自检后才写 `html[data-dsh-sidebar-tidy]`）等既有设计不变。

## 0.1.1 — 2026-10-11

交互改为悬停，不再需要点击。

- **鼠标移到面板图标区**（折叠态下就是「⋯ 更多」那一条）即自动展开，移开自动折叠；移开后延迟 220ms 再收起，避免指针擦边时闪动。
- 键盘焦点进出入口行同样展开 / 收起。
- 入口行不再切换状态，也不再记忆开合：0.1.0 写入的 `localStorage["dsh-sidebar-tidy:folded"]` 会被清掉。
- 入口行文案固定为「更多 / More」（它现在是收纳组的名字），`title` 改为「悬停展开，移开收起」/ "Hover to expand · move away to fold"。
- 点击入口行仍然被拦截（避免侧栏去 `selectPanel` 一个不存在的 main 面板），只是不再触发任何状态变化。

## 0.1.0 — 2026-10-10

首个版本。

- 侧栏重排：工作区上移、面板图标下移到工作区下方（纯 CSS `order`，不改 DOM 结构）。
- 底部「⋯ 更多 / 收起」可折叠入口，就地展开，默认折叠。
- 状态记忆：`localStorage["dsh-sidebar-tidy:folded"]`（`folded` / `expanded`）。
- 折叠时若被隐藏的面板正处于选中状态，入口图标右上角显示小圆点提示。
- 文案跟随 DSH 语言：中文「更多 / 收起」、英文 "More / Collapse"。
- 安全设计：所有 CSS 选择器以 `html[data-dsh-sidebar-tidy]` 打头，只有自检确认真实侧栏 DOM 就位后才写入该属性；DSH 内部类名漂移时插件只会「不生效」，不会改坏页面。