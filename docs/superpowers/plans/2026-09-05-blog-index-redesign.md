# Blog Index Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stock Docusaurus blog index at blog.starlake.ai with a branded page: dark gradient hero for the newest post, tag chip row, full-width teal-accented card grid, no sidebar.

**Architecture:** Swizzle (eject) `BlogListPage` into `src/theme/BlogListPage/` following the repo's existing swizzle pattern (`src/theme/Footer`, `src/theme/Root.js`). The component receives all post metadata as props; no new data source. Internal components (`BlogHero`, `TagChips`, `PostCard`) live in the same file. All styling in a scoped CSS module.

**Tech Stack:** Docusaurus 3.9.2, React, CSS modules. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-05-blog-index-redesign-design.md`

## Global Constraints

- Node 20+, Yarn. Dev server: `IS_BLOG=1 yarn start`. Builds: `yarn build` (docs mode) and `IS_BLOG=1 yarn build` (blog mode).
- Both build commands MUST pass after every task.
- No new npm dependencies. No changes to `src/css/custom.css` or `docusaurus.config.js`.
- Brand tokens: primary light `#2e8555`, primary dark-mode `#25c2a0`, navy `#1a1a2e`, hero gradient `linear-gradient(135deg, #1a1a2e 0%, #1e2a1a 55%, #1a1a2e 100%)`, light surface `#f8f9fa`.
- Dark mode via `[data-theme='dark']` overrides of CSS variables defined in the module.
- No em dash characters anywhere in code, copy, or commit messages.
- This repo has no JS unit-test framework. Verification is: build passes + grep assertions against the statically rendered HTML in `build/` + manual dev-server checks in Task 5. Do not add a test framework.

---

### Task 1: Swizzled BlogListPage, stock parity minus sidebar

**Files:**
- Create: `src/theme/BlogListPage/index.js`
- Create: `src/theme/BlogListPage/styles.module.css`

**Interfaces:**
- Consumes: Docusaurus theme aliases `@theme/BlogLayout`, `@theme/BlogListPaginator`, `@theme/SearchMetadata`, `@theme/BlogPostItems`, `@theme/BlogListPage/StructuredData`; `props.items` (array of `{content}` where `content.metadata` has `title`, `description`, `permalink`, `date` (ISO string), `readingTime` (float, may be undefined), `tags` (array of `{label, permalink}`), `authors` (array of `{name, url, imageURL}`)); `props.metadata` (has `page`, `permalink`, `blogTitle`, `blogDescription`).
- Produces: the swizzled page file that Tasks 2-4 edit. Helper functions `formatDate(date)` and `readingTimeLabel(readingTime)` defined here are used by Tasks 2 and 3 verbatim.

- [ ] **Step 1: Create `src/theme/BlogListPage/styles.module.css`** with only the theme tokens (components fill it in later tasks):

```css
.wrapper {
  --blog-card-bg: #ffffff;
  --blog-card-border: #e8e8e8;
  --blog-card-shadow: 0 1px 4px rgba(26, 26, 46, 0.08);
  --blog-card-shadow-hover: 0 6px 16px rgba(26, 26, 46, 0.14);
  --blog-chip-bg: #e6f7f2;
  --blog-chip-text: #1a8870;
  --blog-meta-text: var(--ifm-color-emphasis-600);
}

[data-theme='dark'] .wrapper {
  --blog-card-bg: #1e1e2e;
  --blog-card-border: #2e2e42;
  --blog-card-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
  --blog-card-shadow-hover: 0 6px 16px rgba(0, 0, 0, 0.5);
  --blog-chip-bg: rgba(37, 194, 160, 0.15);
  --blog-chip-text: #4fddbf;
  --blog-meta-text: var(--ifm-color-emphasis-500);
}
```

- [ ] **Step 2: Create `src/theme/BlogListPage/index.js`**, a copy of the stock component (from `node_modules/@docusaurus/theme-classic/lib/theme/BlogListPage/index.js`) with two changes: `BlogLayout` gets no `sidebar` prop, and children are wrapped in `styles.wrapper`:

```js
import React from 'react';
import clsx from 'clsx';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {
  PageMetadata,
  HtmlClassNameProvider,
  ThemeClassNames,
} from '@docusaurus/theme-common';
import BlogLayout from '@theme/BlogLayout';
import BlogListPaginator from '@theme/BlogListPaginator';
import SearchMetadata from '@theme/SearchMetadata';
import BlogPostItems from '@theme/BlogPostItems';
import BlogListPageStructuredData from '@theme/BlogListPage/StructuredData';
import styles from './styles.module.css';

const formatDate = (date) =>
  new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(date));

const readingTimeLabel = (readingTime) =>
  `${Math.ceil(readingTime)} min read`;

function BlogListPageMetadata(props) {
  const {metadata} = props;
  const {
    siteConfig: {title: siteTitle},
  } = useDocusaurusContext();
  const {blogDescription, blogTitle, permalink} = metadata;
  const isBlogOnlyMode = permalink === '/';
  const title = isBlogOnlyMode ? siteTitle : blogTitle;
  return (
    <>
      <PageMetadata title={title} description={blogDescription} />
      <SearchMetadata tag="blog_posts_list" />
    </>
  );
}

function BlogListPageContent(props) {
  const {metadata, items} = props;
  return (
    <BlogLayout>
      <div className={styles.wrapper}>
        <BlogPostItems items={items} />
        <BlogListPaginator metadata={metadata} />
      </div>
    </BlogLayout>
  );
}

export default function BlogListPage(props) {
  return (
    <HtmlClassNameProvider
      className={clsx(
        ThemeClassNames.wrapper.blogPages,
        ThemeClassNames.page.blogListPage,
      )}>
      <BlogListPageMetadata {...props} />
      <BlogListPageStructuredData {...props} />
      <BlogListPageContent {...props} />
    </HtmlClassNameProvider>
  );
}
```

Note: `formatDate` and `readingTimeLabel` are unused in this task (added here so later tasks only add components); if the build's lint complains about unused vars, keep them anyway since warnings do not fail the build.

- [ ] **Step 3: Build in blog mode and verify the sidebar is gone**

Run: `IS_BLOG=1 yarn build`
Expected: exits 0.

Run: `grep -c "All posts" build/index.html`
Expected: `0` (grep exits 1). The stock sidebar heading "All posts" must be absent from the index page.

Run: `grep -c "All posts" build/duckdb-flight-sql-client-families/index.html`
Expected: a number >= 1 (post pages keep their sidebar).

- [ ] **Step 4: Build in docs mode**

Run: `yarn build`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/theme/BlogListPage/
git commit -m "feat(blog): swizzle BlogListPage, drop sidebar on index"
```

---

### Task 2: Card grid

**Files:**
- Modify: `src/theme/BlogListPage/index.js`
- Modify: `src/theme/BlogListPage/styles.module.css`

**Interfaces:**
- Consumes: `formatDate`, `readingTimeLabel`, `styles.wrapper` from Task 1; `content.metadata` fields listed in Task 1.
- Produces: `PostCard({metadata})` component and `styles.grid`; Task 3 changes which items feed the grid.

- [ ] **Step 1: Add `PostCard` and the grid to `src/theme/BlogListPage/index.js`.** Add `import Link from '@docusaurus/Link';` under the React import. Remove the `import BlogPostItems from '@theme/BlogPostItems';` line. Add above `BlogListPageContent`:

```js
function PostCard({metadata}) {
  const {permalink, title, description, date, readingTime, tags} = metadata;
  return (
    <article className={styles.card}>
      {tags.length > 0 && (
        <div className={styles.cardTags}>
          {tags.slice(0, 2).map((tag) => (
            <span key={tag.permalink} className={styles.pill}>
              {tag.label}
            </span>
          ))}
        </div>
      )}
      <h2 className={styles.cardTitle}>
        <Link to={permalink} className={styles.cardLink}>
          {title}
        </Link>
      </h2>
      {description && <p className={styles.cardDescription}>{description}</p>}
      <div className={styles.cardMeta}>
        <time dateTime={date}>{formatDate(date)}</time>
        {typeof readingTime !== 'undefined' && (
          <> · {readingTimeLabel(readingTime)}</>
        )}
      </div>
    </article>
  );
}
```

Replace `BlogListPageContent` with:

```js
function BlogListPageContent(props) {
  const {metadata, items} = props;
  return (
    <BlogLayout>
      <div className={styles.wrapper}>
        <div className={styles.grid}>
          {items.map(({content}) => (
            <PostCard
              key={content.metadata.permalink}
              metadata={content.metadata}
            />
          ))}
        </div>
        <BlogListPaginator metadata={metadata} />
      </div>
    </BlogLayout>
  );
}
```

- [ ] **Step 2: Append grid and card styles to `styles.module.css`:**

```css
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.25rem;
  margin-bottom: 2rem;
}

.card {
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--blog-card-bg);
  border: 1px solid var(--blog-card-border);
  border-top: 3px solid var(--ifm-color-primary);
  border-radius: 8px;
  padding: 1.25rem;
  box-shadow: var(--blog-card-shadow);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.card:hover {
  transform: translateY(-3px);
  box-shadow: var(--blog-card-shadow-hover);
}

.cardTags {
  margin-bottom: 0.5rem;
}

.pill {
  display: inline-block;
  background: var(--blog-chip-bg);
  color: var(--blog-chip-text);
  border-radius: 999px;
  padding: 0.1rem 0.6rem;
  font-size: 0.75rem;
  font-weight: 600;
  margin-right: 0.35rem;
}

.cardTitle {
  font-size: 1.1rem;
  line-height: 1.35;
  margin-bottom: 0.5rem;
}

.cardTitle a {
  color: var(--ifm-heading-color);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.cardTitle a:hover {
  text-decoration: none;
  color: var(--ifm-color-primary);
}

/* Stretched link: makes the whole card clickable without nesting anchors */
.cardLink::after {
  content: '';
  position: absolute;
  inset: 0;
}

.cardDescription {
  font-size: 0.85rem;
  color: var(--ifm-color-emphasis-700);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 0.75rem;
}

.cardMeta {
  margin-top: auto;
  font-size: 0.8rem;
  color: var(--blog-meta-text);
}
```

- [ ] **Step 3: Build and verify the grid rendered**

Run: `IS_BLOG=1 yarn build`
Expected: exits 0.

Run: `grep -c "min read" build/index.html`
Expected: >= 10 (each card shows reading time; default pagination puts 10 posts on page 1).

Run: `grep -c "<article" build/index.html`
Expected: >= 10.

- [ ] **Step 4: Build docs mode**

Run: `yarn build`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/theme/BlogListPage/
git commit -m "feat(blog): card grid on blog index"
```

---

### Task 3: Hero for the newest post (page 1 only)

**Files:**
- Modify: `src/theme/BlogListPage/index.js`
- Modify: `src/theme/BlogListPage/styles.module.css`

**Interfaces:**
- Consumes: `formatDate`, `readingTimeLabel`, `PostCard`, `styles.grid` from earlier tasks; `metadata.page` from `props.metadata`; `authors` array on post metadata.
- Produces: `BlogHero({metadata})`; the `isFirstPage` / `gridItems` split that Task 4 extends.

- [ ] **Step 1: Add `BlogHero` to `index.js`** (above `PostCard`). The whole hero is one `Link`; tags inside are plain spans so no anchors nest:

```js
function BlogHero({metadata}) {
  const {permalink, title, description, date, readingTime, tags, authors} =
    metadata;
  return (
    <Link to={permalink} className={styles.hero}>
      <div className={styles.heroPills}>
        <span className={styles.latestPill}>Latest</span>
        {tags.slice(0, 3).map((tag) => (
          <span key={tag.permalink} className={styles.heroTag}>
            {tag.label}
          </span>
        ))}
      </div>
      <h1 className={styles.heroTitle}>{title}</h1>
      {description && <p className={styles.heroDescription}>{description}</p>}
      <div className={styles.heroMeta}>
        {authors.length > 0 && (
          <span className={styles.heroAuthors}>
            {authors
              .filter((author) => author.imageURL)
              .map((author) => (
                <img
                  key={author.imageURL}
                  src={author.imageURL}
                  alt={author.name}
                  className={styles.heroAvatar}
                />
              ))}
            {authors.map((author) => author.name).join(', ')}
          </span>
        )}
        <time dateTime={date}>{formatDate(date)}</time>
        {typeof readingTime !== 'undefined' && (
          <span>{readingTimeLabel(readingTime)}</span>
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Replace `BlogListPageContent`** so page 1 splits off the hero item:

```js
function BlogListPageContent(props) {
  const {metadata, items} = props;
  const isFirstPage = metadata.page === 1;
  const heroItem = isFirstPage ? items[0] : undefined;
  const gridItems = isFirstPage ? items.slice(1) : items;
  return (
    <BlogLayout>
      <div className={styles.wrapper}>
        {heroItem && <BlogHero metadata={heroItem.content.metadata} />}
        <div className={styles.grid}>
          {gridItems.map(({content}) => (
            <PostCard
              key={content.metadata.permalink}
              metadata={content.metadata}
            />
          ))}
        </div>
        <BlogListPaginator metadata={metadata} />
      </div>
    </BlogLayout>
  );
}
```

- [ ] **Step 3: Append hero styles to `styles.module.css`:**

```css
.hero {
  display: block;
  background: linear-gradient(135deg, #1a1a2e 0%, #1e2a1a 55%, #1a1a2e 100%);
  border-radius: 12px;
  padding: 2.5rem;
  margin-bottom: 1.5rem;
  color: #ffffff;
}

.hero:hover {
  text-decoration: none;
  color: #ffffff;
}

.heroPills {
  margin-bottom: 0.75rem;
}

.latestPill {
  display: inline-block;
  background: #25c2a0;
  color: #ffffff;
  border-radius: 999px;
  padding: 0.15rem 0.7rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-right: 0.5rem;
}

.heroTag {
  display: inline-block;
  background: rgba(255, 255, 255, 0.12);
  color: #cdd6e0;
  border-radius: 999px;
  padding: 0.15rem 0.7rem;
  font-size: 0.75rem;
  font-weight: 600;
  margin-right: 0.35rem;
}

.heroTitle {
  color: #ffffff;
  font-size: 2rem;
  line-height: 1.25;
  margin-bottom: 0.5rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.heroDescription {
  color: rgba(255, 255, 255, 0.75);
  font-size: 1rem;
  max-width: 48rem;
  margin-bottom: 1rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.heroMeta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.85rem;
}

.heroAuthors {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.heroAvatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
}

@media (max-width: 768px) {
  .hero {
    padding: 1.5rem;
  }

  .heroTitle {
    font-size: 1.4rem;
  }
}
```

- [ ] **Step 4: Build and verify hero on page 1 only**

Run: `IS_BLOG=1 yarn build`
Expected: exits 0.

Run: `grep -c "Latest" build/index.html`
Expected: >= 1.

Run: `grep -c "Latest" build/page/2/index.html`
Expected: `0` (grep exits 1). Pages after the first get no hero.

- [ ] **Step 5: Build docs mode**

Run: `yarn build`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/theme/BlogListPage/
git commit -m "feat(blog): gradient hero for newest post on blog index"
```

---

### Task 4: Tag chip row (page 1 only)

**Files:**
- Modify: `src/theme/BlogListPage/index.js`
- Modify: `src/theme/BlogListPage/styles.module.css`

**Interfaces:**
- Consumes: `isFirstPage` split from Task 3; `Link`; `tags` (`{label, permalink}`) on post metadata; `styles.pill` tokens from Task 2.
- Produces: `TagChips({items})`; nothing downstream depends on it.

- [ ] **Step 1: Add `TagChips` to `index.js`** (above `BlogListPageContent`). Chips are real links to tag pages, deduplicated by tag permalink, most frequent first, capped at 10:

```js
function TagChips({items}) {
  const counts = new Map();
  items.forEach(({content}) => {
    content.metadata.tags.forEach((tag) => {
      const entry = counts.get(tag.permalink) ?? {tag, count: 0};
      entry.count += 1;
      counts.set(tag.permalink, entry);
    });
  });
  const topTags = [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  if (topTags.length === 0) {
    return null;
  }
  return (
    <nav className={styles.tagChips} aria-label="Browse by tag">
      {topTags.map(({tag}) => (
        <Link key={tag.permalink} to={tag.permalink} className={styles.chip}>
          {tag.label}
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Render it in `BlogListPageContent`**, between hero and grid. Change:

```js
        {heroItem && <BlogHero metadata={heroItem.content.metadata} />}
        <div className={styles.grid}>
```

to:

```js
        {heroItem && <BlogHero metadata={heroItem.content.metadata} />}
        {isFirstPage && <TagChips items={items} />}
        <div className={styles.grid}>
```

- [ ] **Step 3: Append chip styles to `styles.module.css`:**

```css
.tagChips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.chip {
  background: var(--blog-chip-bg);
  color: var(--blog-chip-text);
  border-radius: 999px;
  padding: 0.25rem 0.85rem;
  font-size: 0.8rem;
  font-weight: 600;
}

.chip:hover {
  text-decoration: none;
  background: var(--ifm-color-primary);
  color: #ffffff;
}
```

- [ ] **Step 4: Build and verify chips on page 1 only**

Run: `IS_BLOG=1 yarn build`
Expected: exits 0.

Run: `grep -c "Browse by tag" build/index.html`
Expected: `1`.

Run: `grep -c "Browse by tag" build/page/2/index.html`
Expected: `0` (grep exits 1).

- [ ] **Step 5: Build docs mode**

Run: `yarn build`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/theme/BlogListPage/
git commit -m "feat(blog): tag chip row on blog index"
```

---

### Task 5: Manual QA in the dev server

**Files:**
- Modify (only if fixes needed): `src/theme/BlogListPage/index.js`, `src/theme/BlogListPage/styles.module.css`

**Interfaces:**
- Consumes: everything from Tasks 1-4.
- Produces: the verified final page.

- [ ] **Step 1: Start the blog dev server**

Run: `IS_BLOG=1 yarn start` (leave it running; it serves http://localhost:3000/).

- [ ] **Step 2: Walk this checklist in a browser (or ask the user to):**

1. Page 1: hero shows the newest post ("The wire to DuckDB..."), chip row present, grid below with the remaining posts, no "All posts" sidebar.
2. Click the hero: lands on the post. Go back.
3. Click a card body and a card title: both land on the post. Go back.
4. Click a tag chip: lands on the tag page.
5. Navigate to page 2 via the paginator: grid and paginator only, no hero, no chips.
6. Toggle dark mode: hero unchanged, cards on dark surfaces, chips translucent teal, all text legible.
7. Narrow the window to phone width: single-column grid, hero padding shrinks, title wraps without overflow.
8. Open a post page: its "All posts" sidebar is still there.

- [ ] **Step 3: Fix anything that fails the checklist,** re-verify, then run both builds one last time:

Run: `IS_BLOG=1 yarn build && yarn build`
Expected: both exit 0.

- [ ] **Step 4: Commit (only if fixes were made)**

```bash
git add src/theme/BlogListPage/
git commit -m "fix(blog): polish blog index after manual QA"
```
