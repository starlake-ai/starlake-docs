import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {useWindowSize} from '@docusaurus/theme-common';
import {useDoc, useDocsVersion} from '@docusaurus/plugin-content-docs/client';

// Absolute URL of the page's Markdown copy, or null when none is generated:
// docusaurus-plugin-llms only covers the latest version of each docs
// instance, and never runs on the blog site.
export function useMarkdownUrl() {
  const {siteConfig} = useDocusaurusContext();
  const {metadata} = useDoc();
  const version = useDocsVersion();
  if (!siteConfig.customFields.llmsMarkdown || !version.isLast) {
    return null;
  }
  return `${siteConfig.url}${metadata.permalink.replace(/\/$/, '')}.md`;
}

// Mirrors the theme's DocItem/Layout rule for rendering the desktop TOC, so
// the page actions show in exactly one place: atop the TOC, or above the
// content when there is no TOC column.
export function useDesktopTOCShown() {
  const {frontMatter, toc} = useDoc();
  const windowSize = useWindowSize();
  return (
    !frontMatter.hide_table_of_contents &&
    toc.length > 0 &&
    (windowSize === 'desktop' || windowSize === 'ssr')
  );
}
