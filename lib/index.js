/**
 * dsh-sidebar-tidy —— 宿主半（host half）
 *
 * 本插件只改浏览器里的侧栏形态，宿主侧没有任何要做的事：
 * 这里保持一个最小、零依赖、绝不抛错的 cordis 插件，仅仅用于让
 * `dsh.profile.bundles` 里的一行挂载成立（该行的 name 会被 loader 当包导入）。
 *
 * 真正的工作在 lib/client.js（浏览器半）：
 *   - 用 CSS order 把「工作区 / 面板图标 / 底部区」重排成
 *     品牌 → 新会话 → 工作区 → [面板图标 + 「更多」入口] → 底部设置区
 *   - 折叠态下隐藏面板图标行，只留 own「更多」入口行
 *   - 状态存 localStorage，默认折叠
 */

export const name = 'dsh-sidebar-tidy'

/** 宿主侧不依赖任何服务。 */
export const inject = []

/** 空实现：客户端接管一切。 */
export function apply() {}