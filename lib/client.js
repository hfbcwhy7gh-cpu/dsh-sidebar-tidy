/**
 * dsh-sidebar-tidy —— 浏览器半（client half）
 *
 * 目标形态（用户定稿）：
 *   品牌行 → 新会话 → 工作区/会话列表 → [面板图标 + 「更多」入口] → 底部（用户/设置）
 *
 * 做法（方案 A：追加式 CSS + 唯一入口行）：
 *   1. 用 `order` 把 sidebar 根列的三个区重排：regionArea(工作区)=20 < panelList(面板图标)=30
 *      < footArea(底部)=40 —— shell 的兄弟顺序写死在 UI 侧栏包里，只有 CSS 能动它。
 *   2. 在既有座位 `sidebar.panellist` 里追加唯一一个条目（id=sidebar-tidy，order=100）：
 *      它排在 4 个面板图标之后，是收纳组的入口行。
 *   3. 交互有两种方案（0.2.0 起用户可在「设置 → 侧栏收纳」里自己选，默认悬停）：
 *      - hover：鼠标移入图标区（折叠态下就是入口行那一条）即展开，移开 CLOSE_DELAY 毫秒后折叠；
 *        键盘 focus 进出同样生效。入口行点击不改变状态（只拦下，避免侧栏拿 id 去选不存在的面板）。
 *      - click：点击入口行展开/收起；「记住展开状态」开关决定该状态是否落盘（下次打开仍保持）。
 *   4. 折叠态 = html[data-dsh-sidebar-tidy="folded"] 下隐藏
 *      `panelList > panelRow:not(:has(.dsh-sidebar-tidy-toggle))`，只留入口行。
 *   5. 设置入口：往 `settings.section` 注册一个整页（id=sidebar-tidy），用官方 UI 原子
 *      （SegmentedControl / Switch）画两行偏好；取不到该包时退回自绘控件。
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

    // UI 侧栏包里的类名形如 _2H3hWW_panelList（hash 会随版本变），用子串匹配抗漂移。
    const SEL_PANEL_LIST = 'nav[class*="_panelList"]'
    const SEL_PANEL_ROW = 'button[class*="_panelRow"]'
    const SEL_REGION = 'div[class*="_regionArea"]'
    const SEL_FOOT = 'div[class*="_footArea"]'
    const SEL_TITLE = 'span[class*="_panelTitle"]'

    const CSS = [
      // 三个区的视觉顺序：工作区 → 面板图标区 → 底部区
      'html[' + ATTR + '] ' + SEL_REGION + ' { order: 20 !important; }',
      'html[' + ATTR + '] ' + SEL_PANEL_LIST + ' { order: 30 !important; }',
      'html[' + ATTR + '] ' + SEL_FOOT + ' { order: 40 !important; }',
      // 折叠态：隐藏除入口行以外的所有面板图标行
      'html[' + ATTR + '="' + FOLDED + '"] ' + SEL_PANEL_LIST + ' > ' + SEL_PANEL_ROW + ':not(:has(.' + TOGGLE_CLASS + ')) { display: none !important; }',
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
      if (next !== 'hover' && next !== 'click') return
      if (mode === next) return
      mode = next
      if (mode === 'click') {
        clickOpen = remember ? readStore(CODE_KEY) === '1' : false
      } else if (closeTimer) {
        window.clearTimeout(closeTimer)
        closeTimer = null
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

    /** 入口行文案：hover 模式固定「更多」；click 模式随开合变「更多/收起」。 */
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
        if (row.getAttribute('aria-current') === 'page') return true
      }
      return false
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
      attachHover()
      const next = scanHiddenActive()
      if (next !== hiddenActive) { hiddenActive = next; notify() }
      return true
    }

    // ---------------------------------------- 悬停展开 / 移开折叠（hover 方案）
    const hoverBound = new WeakSet()
    const hoverDisposers = []

    /** 给面板图标区绑上悬停/焦点监听（侧栏重挂载后由 syncAttr 重新补齐）。 */
    function attachHover() {
      const list = document.querySelector(SEL_PANEL_LIST)
      if (!list || hoverBound.has(list)) return
      hoverBound.add(list)

      const open = () => {
        if (mode !== 'hover') return
        if (closeTimer) { window.clearTimeout(closeTimer); closeTimer = null }
        setExpandedFrom('hover', true)
      }
      const close = () => {
        if (mode !== 'hover') return
        if (closeTimer) window.clearTimeout(closeTimer)
        closeTimer = window.setTimeout(() => {
          closeTimer = null
          if (mode !== 'hover') return
          setExpandedFrom('hover', false)
        }, CLOSE_DELAY)
      }
      // 键盘用户：焦点进到入口行也展开，离开就收回
      const focusIn = () => { if (mode === 'hover') setExpandedFrom('focus', true) }
      const focusOut = () => { if (mode === 'hover') setExpandedFrom('focus', false) }

      list.addEventListener('mouseenter', open)
      list.addEventListener('mouseleave', close)
      list.addEventListener('focusin', focusIn)
      list.addEventListener('focusout', focusOut)
      hoverDisposers.push(() => {
        list.removeEventListener('mouseenter', open)
        list.removeEventListener('mouseleave', close)
        list.removeEventListener('focusin', focusIn)
        list.removeEventListener('focusout', focusOut)
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
    // 面板，所以必须拦下来。hover 方案下点击不改变任何状态；click 方案下它才是开关。
    function onDocumentClickCapture(ev) {
      const node = ev.target
      if (!node || typeof node.closest !== 'function') return
      const row = node.closest(SEL_PANEL_ROW)
      if (!row || !row.querySelector('.' + TOGGLE_CLASS)) return
      ev.preventDefault()
      ev.stopPropagation()
      if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation()
      if (mode === 'click') setClickOpen(isFolded())
    }

    // ------------------------------------------------------------ 设置页
    function sectionText() {
      return isZh()
        ? {
            mode: '展开方式',
            modeDesc: '「更多」那一行怎么展开',
            hover: '悬停展开',
            click: '点击展开',
            hoverPanel: '鼠标移入即展开，移开约 0.2 秒后自动收起；点击该行不会改变状态。',
            clickPanel: '点击该行展开或收起；下面的开关决定是否记住这个状态。',
            remember: '记住展开状态',
            rememberDesc: '开启后，开合状态会被保留，下次打开仍是该状态',
            rememberDescOff: '仅在「点击展开」模式下可用',
            rememberTitle: '记住展开状态'
          }
        : {
            mode: 'Expansion',
            modeDesc: 'How the “More” row expands',
            hover: 'Hover',
            click: 'Click',
            hoverPanel: 'Move the pointer onto the row to expand; it folds about 0.2s after the pointer leaves. Clicking the row changes nothing.',
            clickPanel: 'Click the row to expand or collapse; the switch below decides whether the state is remembered.',
            remember: 'Remember the state',
            rememberDesc: 'When on, the open/closed state is kept and restored next time',
            rememberDescOff: 'Available in click mode only',
            rememberTitle: 'Remember the state'
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
        return () => {
          off()
          if (offLocale) { try { offLocale() } catch (err) {} }
        }
      }, [])

      const t = sectionText()
      const options = [
        { value: 'hover', label: t.hover },
        { value: 'click', label: t.click }
      ]
      const panels = [
        { value: 'hover', text: t.hoverPanel },
        { value: 'click', text: t.clickPanel }
      ]

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
        React.createElement('div', { key: 'remember', className: 'dsh-sidebar-tidy-row dsh-sidebar-tidy-rowlast' }, [
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
        ])
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
      mode = readStore(MODE_KEY) === 'click' ? 'click' : 'hover'
      remember = readStore(MEMO_KEY) === '1'
      clickOpen = remember && readStore(CODE_KEY) === '1'
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

      // 侧栏是异步挂载的：属性要等 DOM 就位后再写（否则一条 CSS 都不生效，也就不会误伤页面）
      let tries = 0
      const timer = window.setInterval(() => {
        tries += 1
        if (syncAttr() || tries > 75) window.clearInterval(timer)
      }, 200)
      syncAttr()

      // 观察面板行的 aria-current，维护「折叠里有个开着的面板」提示
      let observer = null
      try {
        if (window.MutationObserver) {
          observer = new window.MutationObserver(() => { syncAttr() })
          const attach = window.setInterval(() => {
            const list = document.querySelector(SEL_PANEL_LIST)
            if (!list) return
            window.clearInterval(attach)
            observer.observe(list, { subtree: true, attributes: true, attributeFilter: ['aria-current', 'class'] })
          }, 400)
          disposers.push(() => { window.clearInterval(attach); if (observer) observer.disconnect() })
        }
      } catch (err) {}

      disposers.push(() => {
        window.clearInterval(timer)
        document.removeEventListener('click', onDocumentClickCapture, true)
        document.documentElement.removeAttribute(ATTR)
        while (hoverDisposers.length > 0) {
          const fn = hoverDisposers.pop()
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