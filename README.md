# dsh-sidebar-tidy

> DSH（DeepSeek Harness）侧栏收纳插件：把「插件 / 自动化任务 / 上下文洞察 / 技能中心」这排面板图标收进侧栏底部的可折叠入口，让 **新会话** 在最上、**工作区** 居中、其余入口在最下；想让某个入口留在外面，可以在设置里逐个勾选。

**简体中文** | [English](README.en.md)

| 改造前 | 改造后（默认：折叠） | 改造后（展开） |
| :-: | :-: | :-: |
| ![改造前](docs/before.jpg) | ![折叠态](docs/folded.jpg) | ![展开态](docs/expanded.jpg) |

*截图中的会话列表与账号行已打码。*

---

## 效果

| 状态 | 侧栏从上到下 |
| --- | --- |
| 折叠（默认） | 品牌行 → 新会话 → **工作区（会话列表，占满剩余空间）** → 「⋯ 更多」 → 底部用户/设置行 |
| 悬停展开（默认方案） | 品牌行 → 新会话 → **工作区（会话列表）** → 插件 / 自动化任务 / 上下文洞察 / 使用统计 / 技能中心 + 「更多」 → 底部用户/设置行 |
| 悬停「更多」（可选方案） | 同上；只有指针靠近「更多」这两个字（或它左边的图标）才展开，扫过这一行的其他位置不展开；点这一行任何位置也能展开 |
| 点击展开（可选方案） | 同上；入口行文案在展开时变为「收起」 |
| 移出折叠区的入口（可选） | 被勾选的入口回到**新会话下方、工作区上方**，其余仍在「更多」图标组里 |

- **鼠标移到「⋯ 更多」那一条上就自动展开，移开就自动折叠**，就地展开、不弹浮层；移开后延迟 220ms 再收起，避免指针擦边时闪动。
- 想换触发方式？设置 → 侧栏收纳 → 展开方式，**三种方案**随时切换（见下一节）：整行悬停、只认「更多」两个字（也可以点整行）、点击开关。
- 想让某个入口**不参与折叠**、回到原来的位置？设置 → 侧栏收纳 → 移出折叠区的入口，逐行开关（见再下一节）。
- 键盘用户：Tab 焦点进到入口行同样展开，焦点离开即收起。
- 折叠时若某个被隐藏的面板正处于选中状态（`aria-current="page"`），入口图标右上角会出现一个小圆点提示。
- 文案跟随 DSH 语言：中文「更多」，英文 "More"；`title` 提示随方案变化（整行悬停 =「悬停展开，移开收起」，悬停「更多」=「悬停「更多」展开，点这一行也可以」，点击 =「点击展开或收起」）。

## 三种展开方式（设置 → 侧栏收纳）

![设置页：侧栏收纳](docs/settings.jpg)

| 方案 | 交互 | 状态记忆 |
| --- | --- | --- |
| **悬停展开**（默认） | 鼠标移入即展开，移开约 0.2 秒后自动收起；点击该行不改变状态 | 不记忆，刷新即回到折叠 |
| **悬停「更多」** | 只有指针靠近「更多」这两个字（连同旁边的图标，各向外扩 6px）才展开，扫过这一行的其他位置不会展开；**点这一行的任何位置也能展开** | 不记忆，刷新即回到折叠 |
| **点击展开** | 点击「更多」行展开 / 收起，文案随之在「更多 / 收起」间切换 | 可选：打开「记住展开状态」后，刷新仍保持上次状态 |

- 切换在 **设置 → 侧栏收纳** 页面里完成（分段控件），改完立刻生效，不需要重启。
- 选择本身存在 `localStorage["dsh-sidebar-tidy:mode"]`（`hover` / `label` / `click`）；「记住展开状态」打开时，开合状态存在 `dsh-sidebar-tidy:click-open`。
- 页面用 DSH 官方 UI 原子（`SegmentedControl` / `Switch`）绘制；万一取不到该包，会退回自绘控件，功能不受影响。
- 默认状态（不写任何 `localStorage` 时）就是 0.1.1 的行为：悬停展开、不记忆。

## 把某个入口移出折叠区（设置 → 侧栏收纳）

![设置页：移出折叠区的入口](docs/keep.jpg)

- 同一页下方是「**移出折叠区的入口**」：侧栏现有的面板图标会逐个列出来，打开某个开关，那一行就**退出折叠组**，回到**新会话下方、工作区上方**的原本位置；关掉又收进「更多」。
- 被移出的行在折叠态、展开态下都直接可见，而且**不参与悬停展开** —— 指针扫过它不会把图标组弹开（它已经不属于那一组了）。
- 每行下面写着当前状态：「已在折叠区外（新会话下方）」/「收进折叠区（图标组里）」。
- 列表跟着侧栏槽位走：运行时新装了带面板图标的插件，它会自动出现在列表里（设置页重画时刷新，无需重装本插件）。
- 选择存在 `localStorage["dsh-sidebar-tidy:keep"]`，是槽位条目 id 的 JSON 数组，例如 `["plugins"]`。

## 安装

1. 把本仓库放到任意目录，例如 `~/dsh-plugins/dsh-sidebar-tidy`。
2. 链进 profile 的 `node_modules`：
   - Windows：`mklink /J "%USERPROFILE%\.dsh\profiles\desktop\node_modules\dsh-sidebar-tidy" "C:\path\to\dsh-sidebar-tidy"`
   - macOS / Linux：`ln -s ~/dsh-plugins/dsh-sidebar-tidy ~/.dsh/profiles/desktop/node_modules/dsh-sidebar-tidy`
3. 在 `~/.dsh/profiles/<profile>/package.json` 里登记两处：
   - `dependencies` 增加 `"dsh-sidebar-tidy": "link:<源码目录>"`
   - `dsh.profile.bundles` 增加 `"dsh-sidebar-tidy"`
4. 刷新页面即可生效（实测 desktop profile 无需重启；若个别环境未收录，重启一次 DeepSeek Harness）。

## 卸载

从 `dsh.profile.bundles` 移除该行，重启 DeepSeek Harness 即可。插件卸载时会移除自己插入的样式表、侧栏属性、事件监听与设置页；`dsh-sidebar-tidy:*` 这几个 `localStorage` 键可以手动清掉，留着也不影响其它功能。

## 实现方式（为什么这么轻）

DSH 侧栏没有「排序槽」——兄弟元素的先后由 shell 写死，第三方也不能注销别人的注册项。所以本插件不改 DOM 结构，只用三招：

1. **CSS `order` 挪位**：侧栏根节点是 flex column，`regionArea`（工作区）设 `order:20`、`panelList`（面板图标）`order:30`、`footArea`（底部）`order:40`，图标就排到了工作区下方。
2. **`display: contents` 拆掉图标组的外壳**：`nav[class*="_panelList"]` 设成 `display:contents` 后，它里面的每一行都变成侧栏 flex 容器的直接子元素，于是可以**逐行**给 `order` —— 被移出的行 `order:15`（回到新会话下方），组里其余行仍是 `order:30`。
3. **`display:none` 折叠**：`html[data-dsh-sidebar-tidy="folded"]` 时，隐藏图标组里除本插件入口行、以及被移出的行以外的所有行。

「哪个开关对应哪一行」得由插件自己认：侧栏的行没有任何 id 属性，所以它读 `ctx.slots.entriesOfSlot('sidebar.panellist')` 拿到 `{id, order, label}`，先按行的 `aria-label` 文本对号、再按 `order` 顺序补齐，然后把 `data-dsh-tidy-id` / `data-dsh-tidy-keep` 写到行上；行被重建（切换 `wide`、重挂载）后会在下一次 `syncAttr` 里重新标记。

入口按钮本身走客户端槽位 API 正常注册（`ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({...}))`），因此主题、hover、选中高亮全部跟随原生样式；入口行还必须拦掉侧栏默认的 `selectPanel(id)` 行为（该 id 没有对应的 main 面板）。

设置页走 `settings.section` 槽另注册一个整页（`id: sidebar-tidy`），因此它和 DSH 自带的设置页并列显示，不需要改任何 shell 代码。

**失败安全**：所有侧栏 CSS 选择器都以 `html[data-dsh-sidebar-tidy]` 打头，而这个属性只有在**自检确认真实侧栏 DOM 就位**（`nav[class*="_panelList"]`、`div[class*="_regionArea"]`、`div[class*="_footArea"]` 同时存在）之后才会写入。DSH 内部类名漂移时，插件只会「不生效」，不会把界面改坏；选择器本身用 `[class*="_panelList"]` 这类子串匹配，抗小版本改名。

## 文件

| 文件 | 作用 |
| --- | --- |
| `lib/index.js` | 宿主半：空实现，只为让 profile 的 bundle 行能被 import。 |
| `lib/client.js` | 浏览器半：样式注入、槽位注册（侧栏入口 + 设置页）、状态与交互逻辑。 |
| `cordis.patch.yml` | bundle 补丁层，把 `dsh-sidebar-tidy` 插进插件树。 |

## 环境与验证

- 已在 **DSH 0.2.0-rc.2（Windows，desktop profile）** 实机验证：悬停展开 / 移开折叠（含 220ms 延迟）、键盘焦点开合、折叠态提示点、中英文文案与 `title` 提示、设置页里的**三方案切换**、**「悬停『更多』」的命中区**（指针扫过行内其余位置不展开、移到「更多」文字上才展开、点整行也能展开、窄轨道只剩图标时照样可展开）、「记住展开状态」跨刷新保持、**逐个入口移出折叠区**（移出的行回到新会话下方、悬停时不再触发展开、选择跨刷新保持）、卸载后页面完全复原。
- 与 `dsh-claude-style` 皮肤共存正常（该皮肤不触碰侧栏 `_*` 布局类，也不对这些元素设 `order`）。注意它会把 `sidebar.footer.action` / 设置行压成 0×0，所以本插件的入口刻意放在 `panelList` 末行，而不是侧栏底部槽位；设置页仍可正常打开（皮肤只是把入口挪进了自己的账号浮层）。
- 若另有插件替换了整个 `sidebar` 槽（`replaceRisk: shadows-shipped-ui`），侧栏结构会完全不同，本插件会因自检不通过而静默不生效。

## 兼容性注意

- 侧栏内部的 `_XXXXXX_*` 类名属于 DSH 内部实现；上游若改布局类名，需要更新 `lib/client.js` 顶部的 `SEL_*` 常量（改一处即可）。
- 「移出折叠区」依赖 `display: contents`：如果上游给图标组加了会新建包含块或裁剪的样式（`transform` / `filter` / `overflow` / `contain`），逐行挪位可能失效；此时插件仍会正常折叠，只是移出不起作用。
- 只处理 `sidebar.panellist` 里的面板图标；`sidebar.footer.action`、设置行等其它入口保持原位。
- 设置页只占 `settings.section` 槽里的一个条目（`id: sidebar-tidy`，`order: 100`），插件被禁用时该页一起消失，不会影响其它设置页。

## 许可

[MIT](LICENSE)