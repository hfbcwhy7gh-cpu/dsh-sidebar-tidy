# Changelog

## 0.1.0 — 2026-10-10

首个版本。

- 侧栏重排：工作区上移、面板图标下移到工作区下方（纯 CSS `order`，不改 DOM 结构）。
- 底部「⋯ 更多 / 收起」可折叠入口，就地展开，默认折叠。
- 状态记忆：`localStorage["dsh-sidebar-tidy:folded"]`（`folded` / `expanded`）。
- 折叠时若被隐藏的面板正处于选中状态，入口图标右上角显示小圆点提示。
- 文案跟随 DSH 语言：中文「更多 / 收起」、英文 "More / Collapse"。
- 安全设计：所有 CSS 选择器以 `html[data-dsh-sidebar-tidy]` 打头，只有自检确认真实侧栏 DOM 就位后才写入该属性；DSH 内部类名漂移时插件只会「不生效」，不会改坏页面。