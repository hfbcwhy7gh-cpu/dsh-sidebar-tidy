/**
 * dsh-sidebar-tidy —— 浏览器半（client half）
 *
 * 目标形态（用户定稿）：
 *   品牌行 → 新会话 → [移出折叠区的入口] → 工作区/会话列表
 *   → [折叠着的面板图标 + 「更多」入口] → 底部（用户/设置）
 *
 * 做法（方案 A：追加式 CSS + 唯一入口行）：
 *   1. 用 `order` 把 sidebar 根列的区重排：regionArea(工作区)=20 < panelList(面板图标)=30
 *      < footArea(底部)=40 —— shell 的兄弟顺序写死在 UI 侧栏包里，只有 CSS 能动它。
 *   2. 让 panelList 自己 `display: contents`：面板行便脱离 nav 盒子、直接成为侧栏列的 flex 项，
 *      于是每一行都能单独带 order ⇒ 既能把整组挪到工作区下方，也能让个别行回到原位（order 15）。
 *   3. 在既有座位 `sidebar.panellist` 里追加唯一一个条目（id=sidebar-tidy，order=100）：
 *      它排在面板图标之后，是收纳组的入口行。
 *   4. 交互有三种方案（0.2.0 起用户可在「设置 → 侧栏收纳」里自己选，默认悬停）：
 *      - hover：指针进入图标组（或入口行）即展开，移开 CLOSE_DELAY 毫秒后折叠；键盘 focus 进出同样生效。
 *        入口行点击不改变状态（只拦下，避免侧栏拿 id 去选不存在的面板）。
 *      - label（0.4.0）：指针落在「更多」文字/图标附近（外扩 LABEL_PAD 像素）才展开，
 *        但点这一行的任何位置也能展开；收起仍是指针离开整组后延时折叠。
 *      - click：点击入口行展开/收起；「记住展开状态」开关决定该状态是否落盘（下次打开仍保持）。
 *   5. 0.3.0：设置里可以逐个勾选「移出折叠区的入口」。勾上的条目打上 data-dsh-tidy-keep，
 *      折叠时不再隐藏，order 回到 15（新会话下方）；列表实时取自 sidebar.panellist 的条目。
 *   6. 折叠态 = html[data-dsh-sidebar-tidy="folded"] 下隐藏
 *      `panelList > panelRow:not(:has(.dsh-sidebar-tidy-toggle)):not([data-dsh-tidy-keep])`，只留入口行。
 *   7. 设置入口：往 `settings.section` 注册一个整页（id=sidebar-tidy），用官方 UI 原子
 *      （SegmentedControl / Switch）画偏好行；取不到该包时退回自绘控件。
 *
 * 安全设计：侧栏规则都以 html[data-dsh-sidebar-tidy] 打头，只有在选择器命中真实侧栏 DOM
 * （targetsReady 自检通过）后才写这个属性 ⇒ 类名漂移时是「不生效」而不是「页面坏掉」。
 */

window.__ModuleLoader__.load({
  id: 'dsh-sidebar-tidy',
  factory: (require) => {
    const React = require('react')

    /** 槽位 label 的命名空间（仅作元信息，文案由本插件自己解析）。 */
    const NS = 'sidebar-tidy'
    /** 作用域属性：没有它，本插件一条侧栏 CSS 都不生效。 */
    const ATTR = 'data-dsh-sidebar-tidy'
    /** 属性取值（CSS 选择器用）。 */
    const FOLDED = 'folded'
    const EXPANDED = 'expanded'
    /** 指针移开后延迟这么久再折叠（毫秒）。 */
    const CLOSE_DELAY = 220
    /** 0.1.0 用这个键记忆点击状态；改为悬停后顺手清掉，免得留下过期值。 */
    const LEGACY_STORE_KEY = 'dsh-sidebar-tidy:folded'
    /** 交互方案：'hover' | 'click'。 */
    const MODE_KEY = 'dsh-sidebar-tidy:mode'
    /** 「记住展开状态」开关（仅 click 模式有效）：'1' | '0'。 */
    const MEMO_KEY = 'dsh-sidebar-tidy:remember'
    /** click 模式 + 记住开关打开时，落盘的开合状态：'1' | '0'。 */
    const CODE_KEY = 'dsh-sidebar-tidy:click-open'
    /** 0.3.0：被移出折叠区的条目 id 列表（JSON 数组）。 */
    const KEEP_KEY = 'dsh-sidebar-tidy:keep'
    /** 在 sidebar.panellist 里的条目身份：排最后（既有条目 order 为 0/10/20/30）。 */
    const ENTRY_ID = 'sidebar-tidy'
    const ENTRY_ORDER = 100
    /** 设置里那个整页的身份。 */
    const SECTION_ID = 'sidebar-tidy'
    const SECTION_ORDER = 100
    /** 设置页里分段控件的 id 基名：段 id = `<id>-<value>`，面板 id = `<id>-<value>-panel`。 */
    const MODE_ID = 'dsh-sidebar-tidy-mode'
    /** 入口行的标记类：既给 CSS 用（:not(:has(...)) 排除自己），也给点击识别用。 */
    const TOGGLE_CLASS = 'dsh-sidebar-tidy-toggle'
    /** 本插件写在每个面板行上的标记：条目 id（面板行自己没有 id 属性，只能由我们写）。 */
    const ROW_ID_ATTR = 'data-dsh-tidy-id'
    /** 该行是否被移出折叠区（CSS 据此让它保持显示、order 回到新会话下方）。 */
    const KEEP_ATTR = 'data-dsh-tidy-keep'

    // UI 侧栏包里的类名形如 _2H3hWW_panelList（hash 会随版本变），用子串匹配抗漂移。
    const SEL_PANEL_LIST = 'nav[class*="_panelList"]'
    const SEL_PANEL_ROW = 'button[class*="_panelRow"]'
    const SEL_REGION = 'div[class*="_regionArea"]'
    const SEL_FOOT = 'div[class*="_footArea"]'
    const SEL_TITLE = 'span[class*="_panelTitle"]'
    /** 图标块（窄侧栏轨道里「更多」那一行只剩它）。 */
    const SEL_GLYPH = 'span[class*="_panelGlyph"]'
    /** 'label' 方案：悬停命中区（「更多」文字 + 图标）向外扩的像素 —— 唯一的手感常量。 */
    const LABEL_PAD = 6

    const CSS = [
      // 三个区的视觉顺序：工作区 → 面板图标区 → 底部区
      'html[' + ATTR + '] ' + SEL_REGION + ' { order: 20 !important; }',
      // panelList 自己 display:contents ⇒ 面板行脱离 nav 盒子、直接成为侧栏列的子项，每行各带 order。
      // 注意：display:contents **不能**加 !important —— shipped 的轨道折叠规则
      // ([data-windows-titlebar] .collapsed .panelList{display:none}) 特异性更高，靠它才能在收成图标轨道时藏住面板行。
      'html[' + ATTR + '] ' + SEL_PANEL_LIST + ' { display: contents; order: 30 !important; }',
      'html[' + ATTR + '] ' + SEL_FOOT + ' { order: 40 !important; }',
      // 默认：所有面板行排在「工作区下方、入口行上方」
      'html[' + ATTR + '] ' + SEL_PANEL_LIST + ' > ' + SEL_PANEL_ROW + ' { order: 30 !important; }',
      // 被移出折叠区的行：回到新会话下方（工作区上方），折叠态下也必须继续显示
      'html[' + ATTR + '] ' + SEL_PANEL_LIST + ' > ' + SEL_PANEL_ROW + '[' + KEEP_ATTR + '] { order: 15 !important; display: flex !important; }',
      // 折叠态：隐藏除入口行与豁免行以外的所有面板图标行
      'html[' + ATTR + '="' + FOLDED + '"] ' + SEL_PANEL_LIST + ' > ' + SEL_PANEL_ROW + ':not(:has(.' + TOGGLE_CLASS + ')):not([' + KEEP_ATTR + ']) { display: none !important; }',
      // 入口行与上方图标组之间留一点呼吸
      'html[' + ATTR + '] ' + SEL_PANEL_LIST + ' > ' + SEL_PANEL_ROW + ':has(.' + TOGGLE_CLASS + ') { margin-top: 4px; }',
      '.' + TOGGLE_CLASS + ' { display: block; }',
      // ---------------- 设置页（不依赖侧栏 DOM 自检，故不带 html[...] 前缀）----------------
      // 行距/分隔线照抄 ui-settings-general 的约定：16px 0 内边距 + .5px L2 分隔线
      '.dsh-sidebar-tidy-section { display: flex; flex-direction: column; width: 100%; }',
      '.dsh-sidebar-tidy-row { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 16px 0; border-bottom: .5px solid var(--dsw-alias-border-l2); }',
      '.dsh-sidebar-tidy-rowlast { border-bottom: none; }',
      '.dsh-sidebar-tidy-title { font-size: 14px; line-height: 20px; color: var(--dsw-alias-label-primary); }',
      '.dsh-sidebar-tidy-desc { margin-top: 4px; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }',
      '.dsh-sidebar-tidy-panel { padding: 0 0 16px; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); border-bottom: .5px solid var(--dsw-alias-border-l2); }',
      '.dsh-sidebar-tidy-panel[hidden] { display: none; }',
      // 取不到官方原子时的自绘控件（同色系、同尺寸层级）
      '.dsh-sidebar-tidy-fbseg { display: flex; border: 1px solid var(--dsw-alias-border-l2); border-radius: 6px; overflow: hidden; }',
      '.dsh-sidebar-tidy-fbbtn { padding: 4px 10px; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); background: transparent; border: none; cursor: pointer; }',
      '.dsh-sidebar-tidy-fbbtn.is-on { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }',
      '.dsh-sidebar-tidy-fbswitch { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }'
    ].join('\n')

    // -------------------------------------------------------------- 官方 UI 原子
    // 拿不到包（或包没导出这两个组件）时退回自绘控件，设置页照常可用。
    let primitives = null
    try { primitives = require('@deepseek-ai/dsh-client-ui-primitives') } catch (err) { primitives = null }

    function FallbackSegmented(props) {
      const list = props.options || []
      return React.createElement('div', { className: 'dsh-sidebar-tidy-fbseg', role: 'group', 'aria-label': props.label },
        list.map((option) => React.createElement('button', {
          key: option.value,
          type: 'button',
          className: 'dsh-sidebar-tidy-fbbtn' + (option.value === props.value ? ' is-on' : ''),
          'aria-pressed': option.value === props.value,
          disabled: option.disabled === true,
          onClick: () => { if (option.value !== props.value) props.onChange(option.value) }
        }, option.label)))
    }

    function FallbackSwitch(props) {
      return React.createElement('label', { className: 'dsh-sidebar-tidy-fbswitch', title: props.title },
        React.createElement('input', {
          type: 'checkbox',
          checked: props.checked === true,
          disabled: props.disabled === true,
          onChange: (event) => props.onChange(event.target.checked)
        }),
        React.createElement('span', null, props.label))
    }

    const SegmentedControl = primitives && typeof primitives.SegmentedControl === 'function'
      ? primitives.SegmentedControl
      : FallbackSegmented
    const SwitchControl = primitives && typeof primitives.Switch === 'function'
      ? primitives.Switch
      : FallbackSwitch
    /** 供排障：'official' | 'fallback'。 */
    const primitivesSource = SegmentedControl === FallbackSegmented ? 'fallback' : 'official'

    // ------------------------------------------------------------------ 状态
    let clientCtx = null
    /** 交互方案：'hover'（默认）| 'click'。 */
    let mode = 'hover'
    /** 「记住展开状态」：仅 click 模式有效。 */
    let remember = false
    /** click 模式下的开合状态（remember 打开时落盘）。 */
    let clickOpen = false
    /** hover 模式的展开来源：指针在图标区里 / 焦点在图标区里；满足任一即展开。 */
    let hovered = false
    let focused = false
    /** 折叠态下是否有被隐藏的面板正开着（入口行右上角提示点）。 */
    let hiddenActive = false
    /** 移开后的延迟折叠计时器。 */
    let closeTimer = null
    /** 被移出折叠区的条目 id 集合（勾上后回到新会话下方，折叠时不再被隐藏）。 */
    let keepIds = new Set()
    const listeners = new Set()

    function isFolded() {
      if (mode === 'click') return !clickOpen
      return !(hovered || focused)
    }

    function onChange(fn) {
      listeners.add(fn)
      return () => { listeners.delete(fn) }
    }

    function notify() {
      listeners.forEach((fn) => {
        try { fn({ mode: mode, remember: remember, folded: isFolded(), hiddenActive: hiddenActive }) } catch (err) {}
      })
    }

    function readStore(key) {
      try { return window.localStorage.getItem(key) } catch (err) { return null }
    }

    function writeStore(key, value) {
      try {
        if (value === null) window.localStorage.removeItem(key)
        else window.localStorage.setItem(key, value)
      } catch (err) {}
    }

    // ------------------------------------------------ 「移出折叠区的入口」读写
    /** 读豁免集合（落盘的是 id 数组）。 */
    function readKeep() {
      const raw = readStore(KEEP_KEY)
      if (!raw) return new Set()
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) return new Set(parsed.filter((id) => typeof id === 'string' && id))
      } catch (err) {}
      return new Set()
    }

    /** 勾选/取消一个条目「移出折叠区」。 */
    function setKeep(id, next) {
      if (!id) return
      if (next === true) keepIds.add(id)
      else keepIds.delete(id)
      writeStore(KEEP_KEY, keepIds.size > 0 ? JSON.stringify([...keepIds]) : null)
      syncAttr()
      notify()
    }

    /** 槽位 label 可能是字符串或函数（dsh-context 就是这么注册的），取不到就退回 id。 */
    function resolveEntryLabel(label, fallback) {
      try {
        const value = typeof label === 'function' ? label() : label
        if (typeof value === 'string' && value) return value
      } catch (err) {}
      return fallback || ''
    }

    /** 实时读 sidebar.panellist 的条目（排除自己），按 order 排序；取不到槽位目录时返回 null（区别于空列表）。 */
    function panelEntries() {
      try {
        const slots = clientCtx && clientCtx.slots
        if (!slots || typeof slots.entriesOfSlot !== 'function') return null
        const list = slots.entriesOfSlot('sidebar.panellist') || []
        const out = []
        for (let i = 0; i < list.length; i += 1) {
          const entry = list[i] || {}
          // StoredEntry 是 { component, options, registrant }；也容忍直接把 options 摊平的形状。
          const options = entry.options || entry
          const id = options.id
          if (!id || id === ENTRY_ID) continue
          out.push({
            id: id,
            order: typeof options.order === 'number' ? options.order : 0,
            label: resolveEntryLabel(options.label, id)
          })
        }
        out.sort((a, b) => a.order - b.order)
        return out
      } catch (err) { return null }
    }

    function isZh() {
      try {
        const snap = clientCtx && clientCtx.locale && clientCtx.locale.getSnapshot ? clientCtx.locale.getSnapshot() : null
        const active = snap && snap.active
        if (typeof active === 'string' && active) return active.toLowerCase().indexOf('zh') === 0
      } catch (err) {}
      return (window.navigator.language || '').toLowerCase().indexOf('zh') === 0
    }

    // ------------------------------------------------------------ 偏好读写
    /** 切换交互方案（写盘 + 立刻反映到侧栏与设置页）。 */
    function setMode(next) {
      if (next !== 'hover' && next !== 'label' && next !== 'click') return
      if (mode === next) return
      mode = next
      if (mode === 'click') {
        clickOpen = remember ? readStore(CODE_KEY) === '1' : false
      } else {
        // 离开 click 模式：开合重新交给指针/焦点状态，顺手清掉待折叠的计时器
        clickOpen = false
        if (closeTimer) {
          window.clearTimeout(closeTimer)
          closeTimer = null
        }
      }
      writeStore(MODE_KEY, mode)
      syncAttr()
      notify()
    }

    /** 「记住展开状态」开关。关掉时清掉落盘的开合值。 */
    function setRemember(next) {
      remember = next === true
      writeStore(MEMO_KEY, remember ? '1' : '0')
      if (!remember) writeStore(CODE_KEY, null)
      else if (mode === 'click') writeStore(CODE_KEY, clickOpen ? '1' : '0')
      syncAttr()
      notify()
    }

    /** click 模式下的开合（remember 打开时落盘）。 */
    function setClickOpen(next) {
      clickOpen = next === true
      if (remember) writeStore(CODE_KEY, clickOpen ? '1' : '0')
      syncAttr()
      notify()
    }

    /** 入口行文案：hover / label 模式固定「更多」；click 模式随开合变「更多/收起」。 */
    function labelText() {
      const zh = isZh()
      if (mode === 'click') {
        const open = !isFolded()
        if (zh) return open ? '收起' : '更多'
        return open ? 'Collapse' : 'More'
      }
      return zh ? '更多' : 'More'
    }

    /** 入口行 title：告诉用户这行现在怎么用。 */
    function hintText() {
      const zh = isZh()
      if (mode === 'click') return zh ? '点击展开或收起' : 'Click to expand or collapse'
      if (mode === 'label') return zh ? '悬停「更多」展开，点这一行也可以' : 'Hover the “More” label to expand · clicking the row works too'
      return zh ? '悬停展开，移开收起' : 'Hover to expand · move away to fold'
    }

    /** 设置页在设置导航里的名字。 */
    function sectionLabel() {
      return isZh() ? '侧栏收纳' : 'Sidebar tidy'
    }

    /** 更新展开来源，并只在视觉状态真的变化时通知订阅者。 */
    function setExpandedFrom(source, next) {
      const before = isFolded()
      if (source === 'hover') hovered = next
      else focused = next
      syncAttr()
      if (isFolded() !== before) notify()
    }

    // ------------------------------------------------------------ DOM 同步
    function targetsReady() {
      return !!(
        document.querySelector(SEL_PANEL_LIST) &&
        document.querySelector(SEL_REGION) &&
        document.querySelector(SEL_FOOT) &&
        document.querySelector(SEL_PANEL_ROW)
      )
    }

    function toggleRow() {
      const glyph = document.querySelector(SEL_PANEL_LIST + ' ' + SEL_PANEL_ROW + ' .' + TOGGLE_CLASS)
      return glyph ? glyph.closest('button') : null
    }

    /** 折叠态下有被隐藏的面板处于 active？给入口行加个小圆点免于「面板消失得无影无踪」。 */
    function scanHiddenActive() {
      const list = document.querySelector(SEL_PANEL_LIST)
      if (!list) return false
      const rows = list.querySelectorAll(SEL_PANEL_ROW)
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i]
        if (row.querySelector('.' + TOGGLE_CLASS)) continue
        if (row.hasAttribute(KEEP_ATTR)) continue
        if (row.getAttribute('aria-current') === 'page') return true
      }
      return false
    }

    /**
     * 把「条目 id → 面板行」的对应写到行上。
     * 面板行没有任何 id 属性（只有 aria-label 与本插件能加的标记），所以：
     *   第一轮按 aria-label 文本对号，第二轮按 order 顺序补齐位置；两级都猜不到就不标（宁可不生效）。
     */
    function markRows() {
      const list = document.querySelector(SEL_PANEL_LIST)
      if (!list) return
      const all = list.querySelectorAll(SEL_PANEL_ROW)
      const rows = []
      for (let i = 0; i < all.length; i += 1) {
        if (!all[i].querySelector('.' + TOGGLE_CLASS)) rows.push(all[i])
      }
      const entries = panelEntries()
      if (entries === null) return // 槽位目录暂时读不到：保留上一次的标记，避免刷新瞬间抖一下
      const assigned = new Array(rows.length).fill(null)
      const taken = new Set()
      if (entries.length > 0) {
        for (let i = 0; i < rows.length; i += 1) {
          const label = rows[i].getAttribute('aria-label') || ''
          if (!label) continue
          for (let j = 0; j < entries.length; j += 1) {
            const entry = entries[j]
            if (taken.has(entry.id) || !entry.label) continue
            if (entry.label === label || label.indexOf(entry.label) >= 0 || entry.label.indexOf(label) >= 0) {
              assigned[i] = entry.id
              taken.add(entry.id)
              break
            }
          }
        }
      }
      let cursor = 0
      for (let i = 0; i < rows.length; i += 1) {
        if (assigned[i]) continue
        while (cursor < entries.length && taken.has(entries[cursor].id)) cursor += 1
        if (cursor >= entries.length) break
        assigned[i] = entries[cursor].id
        taken.add(entries[cursor].id)
      }
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i]
        const id = assigned[i]
        if (id) row.setAttribute(ROW_ID_ATTR, id)
        else row.removeAttribute(ROW_ID_ATTR)
        if (id && keepIds.has(id)) row.setAttribute(KEEP_ATTR, '')
        else row.removeAttribute(KEEP_ATTR)
      }
    }

    function syncRow() {
      const row = toggleRow()
      if (!row) return
      const text = labelText()
      row.setAttribute('aria-expanded', isFolded() ? 'false' : 'true')
      row.setAttribute('aria-label', text)
      row.setAttribute('title', hintText())
      const title = row.querySelector(SEL_TITLE)
      if (title && title.textContent !== text) title.textContent = text
    }

    function syncAttr() {
      if (!targetsReady()) return false
      document.documentElement.setAttribute(ATTR, isFolded() ? FOLDED : EXPANDED)
      syncRow()
      markRows()
      const next = scanHiddenActive()
      if (next !== hiddenActive) { hiddenActive = next; notify() }
      return true
    }

    // -------------------------- 悬停展开 / 移开折叠（hover 方案，0.3.0 起按「组」判定）
    const clusterDisposers = []
    let clusterBound = false

    /** 命中折叠组里的面板行就返回该行；豁免行（已移出折叠区）不算组内。 */
    function clusterHit(node) {
      if (!node || typeof node.closest !== 'function') return null
      let row = null
      try { row = node.closest(SEL_PANEL_ROW) } catch (err) { return null }
      if (!row || !row.closest(SEL_PANEL_LIST)) return null
      if (row.hasAttribute(KEEP_ATTR)) return null
      return row
    }

    /**
     * 'label' 方案的悬停命中区：「更多」文字（宽侧栏才有）与图标块的并集，各向外扩 LABEL_PAD 像素。
     * 窄侧栏（55px 轨道）里侧栏不渲染文字 ⇒ 并集自动退化成图标，轨道态照样能悬停展开。
     */
    function hitBoxOf(row) {
      const nodes = [row.querySelector(SEL_TITLE), row.querySelector(SEL_GLYPH) || row.querySelector('.' + TOGGLE_CLASS)]
      let left = Infinity
      let top = Infinity
      let right = -Infinity
      let bottom = -Infinity
      for (let i = 0; i < nodes.length; i += 1) {
        if (!nodes[i]) continue
        const box = nodes[i].getBoundingClientRect()
        if (!box.width && !box.height) continue
        left = Math.min(left, box.left)
        top = Math.min(top, box.top)
        right = Math.max(right, box.right)
        bottom = Math.max(bottom, box.bottom)
      }
      if (right < left) return null
      return { left: left, top: top, right: right, bottom: bottom }
    }

    /** 'label' 方案：指针落在「更多」文字/图标附近才返回该行，否则 null（扫过行内其余位置不展开）。 */
    function labelHit(ev) {
      const row = clusterHit(ev.target)
      if (!row) return null
      if (typeof ev.clientX !== 'number' || typeof ev.clientY !== 'number') return row
      const box = hitBoxOf(row)
      if (!box) return row
      const pad = LABEL_PAD
      if (ev.clientX < box.left - pad || ev.clientX > box.right + pad) return null
      if (ev.clientY < box.top - pad || ev.clientY > box.bottom + pad) return null
      return row
    }

    /**
     * 绑在 document 上的鼠标/键盘判定：进组展开、出组延时折叠。
     * 之所以不用 nav 的 mouseenter/mouseleave —— nav 现在 display:contents（没有盒子），
     * 而且豁免行与图标组是兄弟关系，用委托判定「组内/组外」才准确；绑 document 也免去侧栏重挂载后重绑。
     *
     * 命中判定一律用**指针当前所在的位置**：真实鼠标进入一行时落点几乎总在行的边沿
     * （mouseover 那一下的坐标不在「更多」文字上），之后滑到文字上只产生 mousemove。
     * 早期版本只认 mouseover，结果是「移过去不展开、点一下才展开」（focus 分支在兜底）——
     * 所以 mouseover 与 mousemove 都要判定（mousemove 只在折叠态跑，展开后立刻短路）。
     */
    function attachCluster() {
      if (clusterBound) return
      clusterBound = true

      const usesPointer = () => mode === 'hover' || mode === 'label'

      const open = () => {
        if (!usesPointer()) return
        if (closeTimer) { window.clearTimeout(closeTimer); closeTimer = null }
        setExpandedFrom('hover', true)
      }
      const close = () => {
        if (!usesPointer()) return
        if (closeTimer) window.clearTimeout(closeTimer)
        closeTimer = window.setTimeout(() => {
          closeTimer = null
          if (!usesPointer()) return
          setExpandedFrom('hover', false)
        }, CLOSE_DELAY)
      }

      /** 展开的命中判定：hover = 整行；label = 「更多」文字/图标附近。 */
      const hitForOpen = (ev) => (mode === 'label' ? labelHit(ev) : clusterHit(ev.target))

      const onOver = (ev) => { if (hitForOpen(ev)) open() }
      const onMove = (ev) => { if (isFolded() && hitForOpen(ev)) open() }
      const onOut = (ev) => { if (clusterHit(ev.target) && !clusterHit(ev.relatedTarget)) close() }

      // 焦点只对键盘用户算展开理由：鼠标点一下按钮也会让它获得焦点，若把这种焦点也当展开理由，
      // 指针移开后组会一直开着（表现为「还要再点别处才收起」）。
      let keyboardNav = false
      const onKeydown = (ev) => {
        const k = ev.key
        keyboardNav = k === 'Tab' || k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight'
      }
      const onMouseDown = () => { keyboardNav = false }
      const focusIn = (ev) => {
        if (!usesPointer() || !keyboardNav || !clusterHit(ev.target)) return
        setExpandedFrom('focus', true)
      }
      const focusOut = (ev) => {
        if (usesPointer() && clusterHit(ev.target) && !clusterHit(ev.relatedTarget)) setExpandedFrom('focus', false)
      }

      document.addEventListener('mouseover', onOver, true)
      document.addEventListener('mousemove', onMove, true)
      document.addEventListener('mouseout', onOut, true)
      document.addEventListener('keydown', onKeydown, true)
      document.addEventListener('mousedown', onMouseDown, true)
      document.addEventListener('focusin', focusIn, true)
      document.addEventListener('focusout', focusOut, true)
      clusterDisposers.push(() => {
        document.removeEventListener('mouseover', onOver, true)
        document.removeEventListener('mousemove', onMove, true)
        document.removeEventListener('mouseout', onOut, true)
        document.removeEventListener('keydown', onKeydown, true)
        document.removeEventListener('mousedown', onMouseDown, true)
        document.removeEventListener('focusin', focusIn, true)
        document.removeEventListener('focusout', focusOut, true)
        clusterBound = false
        if (closeTimer) { window.clearTimeout(closeTimer); closeTimer = null }
      })
    }

    // ------------------------------------------------------------- 图标
    function TidyGlyph(props) {
      const [isFoldedNow, setLocal] = React.useState(isFolded())
      const [hasHiddenActive, setHasHiddenActive] = React.useState(hiddenActive)
      React.useEffect(() => onChange((snap) => { setLocal(snap.folded); setHasHiddenActive(snap.hiddenActive) }), [])
      // 首次挂载（或任何一次重渲染）都顺手对齐一次属性与行文本
      React.useEffect(() => { syncAttr() })

      const size = props && typeof props.size === 'number' ? props.size : 18
      const children = []
      if (isFoldedNow) {
        // 「⋯ 更多」：三点
        children.push(React.createElement('circle', { key: 'a', cx: 3.6, cy: 9, r: 1.7, fill: 'currentColor' }))
        children.push(React.createElement('circle', { key: 'b', cx: 9, cy: 9, r: 1.7, fill: 'currentColor' }))
        children.push(React.createElement('circle', { key: 'c', cx: 14.4, cy: 9, r: 1.7, fill: 'currentColor' }))
        if (hasHiddenActive) {
          // 被折叠的面板里有一个正开着：右上角一个小点提示
          children.push(React.createElement('circle', {
            key: 'dot', cx: 14.6, cy: 3.8, r: 2,
            fill: 'var(--dsw-alias-state-business-primary, currentColor)'
          }))
        }
      } else {
        // 展开态：上折线
        children.push(React.createElement('path', {
          key: 'p', d: 'M4.6 11.2 9 6.8l4.4 4.4',
          stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none'
        }))
      }

      return React.createElement('svg', {
        className: TOGGLE_CLASS,
        width: size,
        height: size,
        viewBox: '0 0 18 18',
        fill: 'none',
        xmlns: 'http://www.w3.org/2000/svg',
        'aria-hidden': 'true',
        focusable: 'false'
      }, children)
    }

    // --------------------------------------- 点击入口行：拦下 + 按方案处理
    // 入口行是 UI 侧栏渲染出来的 button，点它会走 selectPanel('sidebar-tidy') 去找不存在的 main
    // 面板，所以必须拦下来。hover 方案下点击不改变任何状态；label 方案下点整行也能展开；
    // click 方案下它才是开关。
    function onDocumentClickCapture(ev) {
      const node = ev.target
      if (!node || typeof node.closest !== 'function') return
      const row = node.closest(SEL_PANEL_ROW)
      if (!row || !row.querySelector('.' + TOGGLE_CLASS)) return
      ev.preventDefault()
      ev.stopPropagation()
      if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation()
      if (mode === 'click') {
        setClickOpen(isFolded())
        return
      }
      if (mode === 'label' && isFolded()) {
        if (closeTimer) { window.clearTimeout(closeTimer); closeTimer = null }
        setExpandedFrom('hover', true)
      }
    }

    // ------------------------------------------------------------ 设置页
    function sectionText() {
      return isZh()
        ? {
            mode: '展开方式',
            modeDesc: '「更多」那一行怎么展开',
            hover: '悬停展开',
            label: '悬停「更多」',
            click: '点击展开',
            hoverPanel: '鼠标移入即展开，移开约 0.2 秒后自动收起；点击该行不会改变状态。',
            labelPanel: '指针移到「更多」这两个字附近（连同它旁边的图标）才展开，扫过这一行的其他位置不会展开；点这一行的任何位置也可以展开。',
            clickPanel: '点击该行展开或收起；下面的开关决定是否记住这个状态。',
            remember: '记住展开状态',
            rememberDesc: '开启后，开合状态会被保留，下次打开仍是该状态',
            rememberDescOff: '仅在「点击展开」模式下可用',
            rememberTitle: '记住展开状态',
            keepTitle: '移出折叠区的入口',
            keepDesc: '打开某个入口后，它不再收进「更多」，而是回到新会话下方；其余入口照旧折叠。',
            keepOnDesc: '已在折叠区外（新会话下方）',
            keepOffDesc: '收进折叠区（图标组里）',
            keepEmpty: '暂时没有可移动的入口',
            keepEmptyDesc: '面板图标出现后会列在这里'
          }
        : {
            mode: 'Expansion',
            modeDesc: 'How the “More” row expands',
            hover: 'Hover',
            label: 'Hover “More”',
            click: 'Click',
            hoverPanel: 'Move the pointer onto the row to expand; it folds about 0.2s after the pointer leaves. Clicking the row changes nothing.',
            labelPanel: 'Expands only when the pointer comes near the “More” label (and the icon beside it); sweeping the rest of the row does nothing. Clicking anywhere on the row expands it too.',
            clickPanel: 'Click the row to expand or collapse; the switch below decides whether the state is remembered.',
            remember: 'Remember the state',
            rememberDesc: 'When on, the open/closed state is kept and restored next time',
            rememberDescOff: 'Available in click mode only',
            rememberTitle: 'Remember the state',
            keepTitle: 'Entries kept out of the group',
            keepDesc: 'Turn one on and that entry stops folding into “More” — it goes back right below New session. The others stay folded.',
            keepOnDesc: 'Outside the group (below New session)',
            keepOffDesc: 'Folded into the icon group',
            keepEmpty: 'No movable entries right now',
            keepEmptyDesc: 'Panel icons will show up here once they load'
          }
    }

    /** 「设置 → 侧栏收纳」整页：两行偏好 + 按模式给一句说明。 */
    function SectionPage() {
      const [, force] = React.useState(0)
      React.useEffect(() => {
        const redraw = () => force((count) => count + 1)
        const off = onChange(redraw)
        let offLocale = null
        try {
          if (clientCtx && clientCtx.locale && typeof clientCtx.locale.subscribe === 'function') {
            const ret = clientCtx.locale.subscribe(redraw)
            if (typeof ret === 'function') offLocale = ret
          }
        } catch (err) {}
        // 面板图标是新装插件时才会出现的，所以条目列表要跟着 sidebar.panellist 的变动重画
        let offSlot = null
        try {
          if (clientCtx && clientCtx.slots && typeof clientCtx.slots.subscribe === 'function') {
            const ret = clientCtx.slots.subscribe('sidebar.panellist', redraw)
            if (typeof ret === 'function') offSlot = ret
          }
        } catch (err) {}
        return () => {
          off()
          if (offLocale) { try { offLocale() } catch (err) {} }
          if (offSlot) { try { offSlot() } catch (err) {} }
        }
      }, [])

      const t = sectionText()
      const options = [
        { value: 'hover', label: t.hover },
        { value: 'label', label: t.label },
        { value: 'click', label: t.click }
      ]
      const panels = [
        { value: 'hover', text: t.hoverPanel },
        { value: 'label', text: t.labelPanel },
        { value: 'click', text: t.clickPanel }
      ]
      // 实时条目（新装插件会多出图标，槽位订阅会触发重画）
      const entries = panelEntries() || []

      return React.createElement('div', { className: 'dsh-sidebar-tidy-section' }, [
        React.createElement('div', { key: 'mode', className: 'dsh-sidebar-tidy-row' }, [
          React.createElement('div', { key: 'text' }, [
            React.createElement('div', { key: 'title', className: 'dsh-sidebar-tidy-title' }, t.mode),
            React.createElement('div', { key: 'desc', className: 'dsh-sidebar-tidy-desc' }, t.modeDesc)
          ]),
          React.createElement(SegmentedControl, {
            key: 'ctl',
            id: MODE_ID,
            label: t.mode,
            value: mode,
            options: options,
            onChange: (next) => setMode(next)
          })
        ]),
        React.createElement('div', { key: 'panels' }, panels.map((panel) => React.createElement('div', {
          key: panel.value,
          role: 'tabpanel',
          id: MODE_ID + '-' + panel.value + '-panel',
          'aria-labelledby': MODE_ID + '-' + panel.value,
          hidden: mode !== panel.value,
          className: 'dsh-sidebar-tidy-panel'
        }, panel.text))),
        React.createElement('div', { key: 'remember', className: 'dsh-sidebar-tidy-row' }, [
          React.createElement('div', { key: 'text' }, [
            React.createElement('div', { key: 'title', className: 'dsh-sidebar-tidy-title' }, t.remember),
            React.createElement('div', { key: 'desc', className: 'dsh-sidebar-tidy-desc' }, mode === 'click' ? t.rememberDesc : t.rememberDescOff)
          ]),
          React.createElement(SwitchControl, {
            key: 'ctl',
            checked: remember,
            disabled: mode !== 'click',
            label: t.rememberTitle,
            title: t.rememberDesc,
            onChange: (next) => setRemember(next)
          })
        ]),
        // ---------------- 「移出折叠区的入口」：一行说明 + 每个条目一个开关 ----------------
        React.createElement('div', { key: 'keepHead', className: 'dsh-sidebar-tidy-row' }, [
          React.createElement('div', { key: 'text' }, [
            React.createElement('div', { key: 'title', className: 'dsh-sidebar-tidy-title' }, t.keepTitle),
            React.createElement('div', { key: 'desc', className: 'dsh-sidebar-tidy-desc' }, t.keepDesc)
          ])
        ]),
        entries.length === 0
          ? React.createElement('div', { key: 'keepEmpty', className: 'dsh-sidebar-tidy-row dsh-sidebar-tidy-rowlast' }, [
              React.createElement('div', { key: 'text' }, [
                React.createElement('div', { key: 'title', className: 'dsh-sidebar-tidy-title' }, t.keepEmpty),
                React.createElement('div', { key: 'desc', className: 'dsh-sidebar-tidy-desc' }, t.keepEmptyDesc)
              ])
            ])
          : React.createElement('div', { key: 'keepList' }, entries.map((entry, index) => React.createElement('div', {
              key: entry.id,
              className: 'dsh-sidebar-tidy-row' + (index === entries.length - 1 ? ' dsh-sidebar-tidy-rowlast' : '')
            }, [
              React.createElement('div', { key: 'text' }, [
                React.createElement('div', { key: 'title', className: 'dsh-sidebar-tidy-title' }, entry.label || entry.id),
                React.createElement('div', { key: 'desc', className: 'dsh-sidebar-tidy-desc' }, keepIds.has(entry.id) ? t.keepOnDesc : t.keepOffDesc)
              ]),
              React.createElement(SwitchControl, {
                key: 'ctl',
                checked: keepIds.has(entry.id),
                label: entry.label || entry.id,
                title: t.keepDesc,
                onChange: (next) => setKeep(entry.id, next)
              })
            ])))
      ])
    }

    // ------------------------------------------------------------ 样式注入
    /** 自己插一张样式表（不去猜宿主 API，按 data-plugin-css 去重，并可随卸载移除）。 */
    const STYLE_MARK = 'dsh-sidebar-tidy/SidebarTidy.css'

    function insertStyle() {
      const existing = document.querySelector('style[data-plugin-css="' + STYLE_MARK + '"]')
      const tag = existing || document.createElement('style')
      tag.dataset.plugin = 'dsh-sidebar-tidy'
      tag.dataset.pluginCss = STYLE_MARK
      tag.textContent = CSS
      if (!existing) document.head.appendChild(tag)
      return () => { if (tag.parentNode) tag.parentNode.removeChild(tag) }
    }

    // -------------------------------------------------------------- 装配
    const inject = ['slots']

    function apply(ctx) {
      clientCtx = ctx
      const disposers = []

      try {
        disposers.push(insertStyle())
      } catch (err) { console.warn('[sidebar-tidy] 样式注入失败', err) }

      // 读偏好：方案（默认悬停）、记忆开关、落盘的开合状态
      const storedMode = readStore(MODE_KEY)
      mode = storedMode === 'label' || storedMode === 'click' ? storedMode : 'hover'
      remember = readStore(MEMO_KEY) === '1'
      clickOpen = remember && readStore(CODE_KEY) === '1'
      keepIds = readKeep()
      writeStore(LEGACY_STORE_KEY, null)

      try {
        if (ctx.slots && typeof ctx.slots.inject === 'function') {
          // 声明感知：UI 侧栏声明 sidebar.panellist 座位后自动补注册
          const off = ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
            name: 'sidebar.panellist',
            id: ENTRY_ID,
            order: ENTRY_ORDER,
            label: () => labelText(),
            locale: NS
          }, TidyGlyph))
          if (typeof off === 'function') disposers.push(off)
        }
      } catch (err) { console.warn('[sidebar-tidy] 槽位注册失败', err) }

      try {
        if (ctx.slots && typeof ctx.slots.inject === 'function') {
          // 设置里单开一页：两行偏好（方案 + 记忆开关）
          const offSection = ctx.slots.inject('settings.section', () => ctx.slots.register({
            name: 'settings.section',
            id: SECTION_ID,
            order: SECTION_ORDER,
            label: () => sectionLabel(),
            locale: NS
          }, SectionPage))
          if (typeof offSection === 'function') disposers.push(offSection)
        }
      } catch (err) { console.warn('[sidebar-tidy] 设置页注册失败', err) }

      document.addEventListener('click', onDocumentClickCapture, true)
      attachCluster()

      // 侧栏是异步挂载的：属性要等 DOM 就位后再写（否则一条 CSS 都不生效，也就不会误伤页面）
      let tries = 0
      const timer = window.setInterval(() => {
        tries += 1
        if (syncAttr() || tries > 75) window.clearInterval(timer)
      }, 200)
      syncAttr()

      // 观察面板行的 aria-current 与子节点增减（新装插件的图标行是新增节点，要补打标记）
      let observer = null
      try {
        if (window.MutationObserver) {
          observer = new window.MutationObserver(() => { syncAttr() })
          const attach = window.setInterval(() => {
            const list = document.querySelector(SEL_PANEL_LIST)
            if (!list) return
            window.clearInterval(attach)
            observer.observe(list, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-current', 'class'] })
          }, 400)
          disposers.push(() => { window.clearInterval(attach); if (observer) observer.disconnect() })
        }
      } catch (err) {}

      disposers.push(() => {
        window.clearInterval(timer)
        document.removeEventListener('click', onDocumentClickCapture, true)
        document.documentElement.removeAttribute(ATTR)
        while (clusterDisposers.length > 0) {
          const fn = clusterDisposers.pop()
          try { fn() } catch (err) {}
        }
        hovered = false
        focused = false
      })

      const teardown = () => {
        while (disposers.length > 0) {
          const fn = disposers.pop()
          try { fn() } catch (err) {}
        }
      }
      try { if (typeof ctx.effect === 'function') ctx.effect(() => teardown, 'sidebar-tidy: teardown') } catch (err) {}
      return teardown
    }

    return { apply: apply, inject: inject, primitivesSource: primitivesSource }
  }
})