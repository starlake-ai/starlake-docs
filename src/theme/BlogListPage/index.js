import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {
  PageMetadata,
  HtmlClassNameProvider,
  ThemeClassNames,
} from '@docusaurus/theme-common';
import BlogLayout from '@theme/BlogLayout';
import BlogListPaginator from '@theme/BlogListPaginator';
import SearchMetadata from '@theme/SearchMetadata';
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

function BlogHero({metadata}) {
  const {permalink, title, description, date, readingTime, tags, authors} =
    metadata;
  return (
    <Link to={permalink} className={styles.hero} aria-label={title}>
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
                  key={author.key ?? author.name}
                  src={author.imageURL}
                  alt=""
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
  const isFirstPage = metadata.page === 1;
  const heroItem = isFirstPage ? items[0] : undefined;
  const gridItems = isFirstPage ? items.slice(1) : items;
  return (
    <BlogLayout>
      <div className={styles.wrapper}>
        {heroItem && <BlogHero metadata={heroItem.content.metadata} />}
        {isFirstPage && <TagChips items={items} />}
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
