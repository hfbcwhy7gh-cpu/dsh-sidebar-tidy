# dsh-sidebar-tidy

> A DSH (DeepSeek Harness) sidebar tidy-up plugin: it tucks the panel icons («Plugins / Schedules / Context Insights / Skills» or their localized names) into a collapsible entry at the bottom of the sidebar, so **New session** stays on top, **Workspaces** takes the middle, and every other entry lives at the bottom.

[简体中文](README.md) | **English**

| Before | After (default: collapsed) | After (expanded) |
| :-: | :-: | :-: |
| ![Before](docs/before.jpg) | ![Collapsed](docs/folded.jpg) | ![Expanded](docs/expanded.jpg) |

*Session list and account row are blurred in the screenshots.*

---

## What it does

| State | Sidebar, top to bottom |
| --- | --- |
| Collapsed (default) | Brand row → New session → **Workspaces (session list, fills the remaining space)** → "⋯ More" → footer user/settings row |
| Expanded | Brand row → New session → **Workspaces (session list)** → Plugins / Schedules / Context Insights / Skills + "Collapse" → footer user/settings row |

- Clicking "⋯ More" expands **in place** (no popover); clicking "Collapse" folds it back.
- The state is stored in `localStorage["dsh-sidebar-tidy:folded"]` (`folded` / `expanded`) and survives reloads.
- While collapsed, if a hidden panel is the currently selected one (`aria-current="page"`), a small dot appears on the entry icon.
- Labels follow the DSH locale: "更多 / 收起" in Chinese, "More / Collapse" in English.

## Install

1. Clone this repository anywhere, e.g. `~/dsh-plugins/dsh-sidebar-tidy`.
2. Link it into your profile's `node_modules`:
   - Windows: `mklink /J "%USERPROFILE%\.dsh\profiles\desktop\node_modules\dsh-sidebar-tidy" "C:\path\to\dsh-sidebar-tidy"`
   - macOS / Linux: `ln -s ~/dsh-plugins/dsh-sidebar-tidy ~/.dsh/profiles/desktop/node_modules/dsh-sidebar-tidy`
3. Register it in `~/.dsh/profiles/<profile>/package.json`:
   - add `"dsh-sidebar-tidy": "link:<path-to-source>"` to `dependencies`
   - add `"dsh-sidebar-tidy"` to `dsh.profile.bundles`
4. Reload the page — that is enough on the desktop profile (no restart needed; if your setup does not pick it up, restart DeepSeek Harness once).

## Uninstall

Remove the line from `dsh.profile.bundles` and restart DeepSeek Harness; optionally delete `localStorage["dsh-sidebar-tidy:folded"]`.

## How it works (and why it is this small)

The DSH sidebar has no "ordering slot" — sibling order is hard-coded by the shell, and a third-party plugin cannot unregister other plugins' entries. So this plugin never touches the DOM structure; it only uses two tricks:

1. **Reordering with CSS `order`** — the sidebar root is a flex column: `regionArea` (workspaces) gets `order:20`, `panelList` (panel icons) `order:30`, `footArea` (footer) `order:40`, which moves the icon row below the workspaces.
2. **Collapsing with `display:none`** — under `html[data-dsh-sidebar-tidy="folded"]`, every row of `panelList` except the plugin's own entry row is hidden.

The entry button itself is registered through the normal client slot API (`ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({...}))`), so theming, hover and active highlighting all come from the native styles; the entry row also intercepts the sidebar's default `selectPanel(id)` behaviour, because that id has no matching main panel.

**Fail-safe by design**: every CSS selector is prefixed with `html[data-dsh-sidebar-tidy]`, and that attribute is written only after a self-check confirms the real sidebar DOM is present (`nav[class*="_panelList"]`, `div[class*="_regionArea"]`, `div[class*="_footArea"]`). If DSH renames its internal classes, the plugin simply does nothing instead of breaking the UI. Selectors match class *substrings*, so small renames do not matter.

## Files

| File | Purpose |
| --- | --- |
| `lib/index.js` | Host half: empty implementation, only so the profile bundle line can be imported. |
| `lib/client.js` | Browser half: style injection, slot registration, state and interaction. |
| `cordis.patch.yml` | Bundle patch layer that inserts `dsh-sidebar-tidy` into the plugin tree. |

## Verified environment

- Verified on a live **DSH 0.2.0-rc.2 (Windows, desktop profile)**: collapse / expand, remembered state across reloads, the collapsed-state dot, localized labels, and a clean rollback after uninstall.
- Coexists with the `dsh-claude-style` skin (it neither touches the sidebar layout classes nor sets `order` on them). Note that the skin collapses `sidebar.footer.action` / the settings row to 0×0, which is why this plugin's entry lives in the last row of `panelList` instead of a footer slot.
- If another plugin replaces the whole `sidebar` slot (`replaceRisk: shadows-shipped-ui`), the sidebar looks completely different and this plugin silently disables itself via the self-check.

## Compatibility notes

- The `_XXXXXX_*` classes inside the sidebar are DSH internals; if upstream renames the layout classes, update the `SEL_*` constants at the top of `lib/client.js` (one place).
- Only the panel icons in `sidebar.panellist` are touched; `sidebar.footer.action`, the settings row and other entries stay where they are.

## License

[MIT](LICENSE)