# Blog index redesign

**Date:** 2026-09-05
**Status:** Approved
**Scope:** The blog list page served at blog.starlake.ai (Docusaurus blog index). Post pages, tag pages, and the docs site are out of scope.

## Problem

The blog index is the stock Docusaurus blog list: a flat chronological stack with no visual identity. It does not look like a real product blog. 17 of the 20 posts share the same default cover image (`/img/blog/starlake-blog-default.png`), so any image-led design would show near-identical thumbnails.

## Decisions made during brainstorming

1. **Layout:** Featured hero + card grid. The newest post renders as a large hero band; all other posts render in a responsive card grid below.
2. **Visual treatment:** Dark branded hero, light cards. No cover images anywhere on the index; identity comes from the brand gradient, typography, and teal accents.
3. **Function:** Add a tag chip row linking to existing tag pages, and drop the blog sidebar on the index (full-width page).
4. **Mechanism:** Swizzle `BlogListPage`. No custom standalone page, no CSS-only hack.

## Architecture

New files:

- `src/theme/BlogListPage/index.js` — swizzled blog list page (ejected, not wrapped)
- `src/theme/BlogListPage/styles.module.css` — all styles for the page, scoped

No other files change. The component follows the repo's existing swizzle pattern (`src/theme/Footer`, `src/theme/Root.js`).

### Internal components (same folder, not exported)

- **`BlogHero`** — renders the newest post as a hero band. Rendered only when `metadata.page === 1`.
- **`TagChips`** — chip row of tags collected from the current page's post metadata, deduplicated by permalink, capped at 10 (most frequent first). Each chip links to the tag's existing `/tags/<slug>` page. Rendered only on page 1.
- **`PostCard`** — one grid card.

### Data flow

`BlogListPage` receives `props.items` (array of `{content}` with `content.metadata`: title, description, permalink, date, formattedDate, readingTime, tags, authors) and `props.metadata` (page, permalink, blog title/description). No extra data source is needed:

- Page 1: `items[0]` feeds `BlogHero`; `items.slice(1)` feeds the grid; all items' tags feed `TagChips`.
- Page 2+: all items feed the grid; no hero, no chips.

### Layout

Render `BlogLayout` **without** the `sidebar` prop so the index is full width. Post pages (`BlogPostPage`) are untouched and keep their sidebar.

Keep from the stock component, unchanged: `PageMetadata` (title, description), `SearchMetadata`, HTML class names (`ThemeClassNames.wrapper.blogPages`, `ThemeClassNames.page.blogListPage`), and `BlogListPaginator` below the grid.

## Visual design

Brand tokens (from `src/css/custom.css`): primary light `#2e8555`, primary dark-mode `#25c2a0`, navy `#1a1a2e`, surface `#f8f9fa`.

### Hero (page 1 only)

- Full-width band, navy-to-green gradient: `linear-gradient(135deg, #1a1a2e 0%, #1e2a1a 55%, #1a1a2e 100%)`.
- Contents: teal "Latest" pill, tag pills (translucent white), title (large, clamped to 2 lines), description (clamped to 2 lines), meta line with formatted date, reading time, and author names with avatars.
- The whole hero is one link to the post (single `<Link>` wrapper; tag pills inside are not separate links to avoid nested anchors).
- Text is white/light regardless of theme (the hero is always dark).

### Tag chips (page 1 only)

- Horizontal wrap row between hero and grid.
- Light mode: `#e6f7f2` background, `#1a8870` text. Dark mode: translucent teal background, `#4fddbf` text.

### Cards

- White tiles, 3px solid teal top border (`--ifm-color-primary`), border radius 8px, subtle shadow, lift + stronger shadow on hover.
- Contents: up to 2 tag pills, title (clamped 2 lines), description (clamped 2 lines), meta line (formatted date, reading time).
- Card title is the link; the whole card is clickable via a stretched-link pattern or wrapping link, tags inside link to tag pages only if this does not nest anchors, otherwise tags render as non-link pills.
- Grid: `display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))` with a 1-column fallback naturally at mobile widths.

### Dark mode

All colors go through CSS variables defined in the module, overridden under `[data-theme='dark']`:

- Page background: follows `--ifm-background-color`.
- Cards: dark surface (about `#1e1e2e`), lighter text, same teal top border using the dark-mode primary.
- Chips: translucent teal as above.
- Hero: unchanged (already dark).

## Behavior

- **Pagination:** stock `BlogListPaginator` below the grid on every page. Pages 2+ render only the grid and paginator.
- **Reading time:** shown (already enabled via `showReadingTime: true`).
- **Sidebar:** none on the index. The `blogSidebarTitle`/`blogSidebarCount` config stays, so post pages keep the "All posts" sidebar.
- **Dual-site safety:** in docs mode (`IS_BLOG` unset) the blog plugin excludes all content, so this component never renders there, but it must not break the docs build (no imports that only exist in blog mode; all imports are standard `@theme`/`@docusaurus` modules available in both builds).

## Error handling / edge cases

- **Empty items:** if `items` is empty (cannot happen today, but cheap to guard), render the layout with no hero, chips, or grid.
- **Missing description:** render the card/hero without the description paragraph.
- **Missing reading time or authors:** omit that meta segment.
- **Posts with no tags** (two posts have empty `tags:`): card renders without pills; they contribute nothing to `TagChips`.
- **Long titles:** CSS line clamp keeps hero and cards from overflowing.

## Testing

1. `yarn build` (docs mode) passes.
2. `IS_BLOG=1 yarn build` passes.
3. Manual check with `IS_BLOG=1 yarn start`:
   - Page 1: hero shows the newest post, chips row present, grid shows remaining posts, no sidebar.
   - Page 2 (if pagination applies): grid + paginator only.
   - Dark mode toggle: hero, cards, chips all legible.
   - Narrow viewport: single-column grid, hero text wraps.
   - Tag chip click navigates to the tag page.
   - Hero and card clicks navigate to the posts.
