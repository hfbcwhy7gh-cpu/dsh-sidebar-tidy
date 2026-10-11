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
 *   3. 交互（0.1.1 起）：鼠标移到面板图标区（折叠态下就是入口行那一条）上 ⇒ 自动展开，
 *      移开 ⇒ 自动折叠（延迟 CLOSE_DELAY 毫秒，避免指针擦边闪动）；键盘 focus 进出同样生效。
 *      入口行**不需要点击**，也不再记忆「上次展开/折叠」。
 *   4. 折叠态 = html[data-dsh-sidebar-tidy="folded"] 下隐藏
 *      `panelList > panelRow:not(:has(.dsh-sidebar-tidy-toggle))`，只留入口行。
 *
 * 安全设计：所有规则都以 html[data-dsh-sidebar-tidy] 打头，只有在选择器命中
 * 真实侧栏 DOM（targetsReady 自检通过）后才写这个属性 ⇒ 类名漂移时是「不生效」而不是「页面坏掉」。
 */

window.__ModuleLoader__.load({
  id: 'dsh-sidebar-tidy',
  factory: (require) => {
    const React = require('react')

    /** 槽位 label 的命名空间（仅作元信息，文案由本插件自己解析）。 */
    const NS = 'sidebar-tidy'
    /** 作用域属性：没有它，本插件一条 CSS 都不生效。 */
    const ATTR = 'data-dsh-sidebar-tidy'
    /** 属性取值（CSS 选择器用）。 */
    const FOLDED = 'folded'
    const EXPANDED = 'expanded'
    /** 指针移开后延迟这么久再折叠（毫秒）。 */
    const CLOSE_DELAY = 220
    /** 0.1.0 用这个键记忆点击状态；0.1.1 改为纯悬停后顺手清掉，免得留下过期值。 */
    const LEGACY_STORE_KEY = 'dsh-sidebar-tidy:folded'
    /** 在 sidebar.panellist 里的条目身份：排最后（既有条目 order 为 0/10/20/30）。 */
    const ENTRY_ID = 'sidebar-tidy'
    const ENTRY_ORDER = 100
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
      '.' + TOGGLE_CLASS + ' { display: block; }'
    ].join('\n')

    // ------------------------------------------------------------------ 状态
    let clientCtx = null
    /** 展开的两个来源：指针在图标区里 / 焦点在图标区里；满足任一即展开。 */
    let hovered = false
    let focused = false
    /** 折叠态下是否有被隐藏的面板正开着（入口行右上角提示点）。 */
    let hiddenActive = false
    /** 移开后的延迟折叠计时器。 */
    let closeTimer = null
    const listeners = new Set()

    function isFolded() {
      return !(hovered || focused)
    }

    function onChange(fn) {
      listeners.add(fn)
      return () => { listeners.delete(fn) }
    }

    function notify() {
      listeners.forEach((fn) => { try { fn(isFolded()) } catch (err) {} })
    }

    function isZh() {
      try {
        const snap = clientCtx && clientCtx.locale && clientCtx.locale.getSnapshot ? clientCtx.locale.getSnapshot() : null
        const active = snap && snap.active
        if (typeof active === 'string' && active) return active.toLowerCase().indexOf('zh') === 0
      } catch (err) {}
      return (window.navigator.language || '').toLowerCase().indexOf('zh') === 0
    }

    /** 入口行文案（也是它自己的 aria-label / 行文本）：悬停交互下它是「收纳组」的名字，不再随开合变化。 */
    function labelText() {
      return isZh() ? '更多' : 'More'
    }

    /** 悬停说明（title）：入口行不再是点击开关，得告诉用户怎么用它。 */
    function hintText() {
      return isZh() ? '悬停展开，移开收起' : 'Hover to expand · move away to fold'
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

    // -------------------------------------------------- 悬停展开 / 移开折叠
    const hoverBound = new WeakSet()
    const hoverDisposers = []

    /** 给面板图标区绑上悬停/焦点监听（侧栏重挂载后由 syncAttr 重新补齐）。 */
    function attachHover() {
      const list = document.querySelector(SEL_PANEL_LIST)
      if (!list || hoverBound.has(list)) return
      hoverBound.add(list)

      const open = () => {
        if (closeTimer) { window.clearTimeout(closeTimer); closeTimer = null }
        setExpandedFrom('hover', true)
      }
      const close = () => {
        if (closeTimer) window.clearTimeout(closeTimer)
        closeTimer = window.setTimeout(() => {
          closeTimer = null
          setExpandedFrom('hover', false)
        }, CLOSE_DELAY)
      }
      // 键盘用户：焦点进到入口行也展开，离开就收回
      const focusIn = () => setExpandedFrom('focus', true)
      const focusOut = () => setExpandedFrom('focus', false)

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
      React.useEffect(() => onChange(() => { setLocal(isFolded()); setHasHiddenActive(hiddenActive) }), [])
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

    // --------------------------------------- 点击入口行：只拦不做事
    // 入口行是 UI 侧栏渲染出来的 button，点它会走 selectPanel('sidebar-tidy') 去找不存在的 main
    // 面板，所以必须拦下来；交互已改为悬停，点击本身不再切换状态（避免出现「没悬停却锁死展开」）。
    function onDocumentClickCapture(ev) {
      const node = ev.target
      if (!node || typeof node.closest !== 'function') return
      const row = node.closest(SEL_PANEL_ROW)
      if (!row || !row.querySelector('.' + TOGGLE_CLASS)) return
      ev.preventDefault()
      ev.stopPropagation()
      if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation()
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

      try { window.localStorage.removeItem(LEGACY_STORE_KEY) } catch (err) {}

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

    return { apply: apply, inject: inject }
  }
})