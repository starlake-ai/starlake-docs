import React from 'react';
import Content from '@theme-original/DocItem/Content';
import Head from '@docusaurus/Head';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {useDoc, useDocsVersion} from '@docusaurus/plugin-content-docs/client';
import PageActions from '@site/src/components/PageActions';

// Absolute URL of the page's Markdown copy, or null when none is generated:
// docusaurus-plugin-llms only covers the latest version of each docs
// instance, and never runs on the blog site.
function useMarkdownUrl() {
  const {siteConfig} = useDocusaurusContext();
  const {metadata} = useDoc();
  const version = useDocsVersion();
  if (!siteConfig.customFields.llmsMarkdown || !version.isLast) {
    return null;
  }
  return `${siteConfig.url}${metadata.permalink.replace(/\/$/, '')}.md`;
}

export default function ContentWrapper(props) {
  const markdownUrl = useMarkdownUrl();
  return (
    <>
      {markdownUrl && (
        <>
          <Head>
            <link rel="alternate" type="text/markdown" href={markdownUrl} />
          </Head>
          <PageActions markdownUrl={markdownUrl} />
        </>
      )}
      <Content {...props} />
    </>
  );
}
