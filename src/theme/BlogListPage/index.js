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
