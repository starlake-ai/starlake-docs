import React from 'react';
import Content from '@theme-original/DocItem/Content';
import Head from '@docusaurus/Head';
import PageActions from '@site/src/components/PageActions';
import {useDesktopTOCShown, useMarkdownUrl} from '@site/src/components/PageActions/hooks';

export default function ContentWrapper(props) {
  const markdownUrl = useMarkdownUrl();
  const tocShown = useDesktopTOCShown();
  return (
    <>
      {markdownUrl && (
        <Head>
          <link rel="alternate" type="text/markdown" href={markdownUrl} />
        </Head>
      )}
      {markdownUrl && !tocShown && <PageActions markdownUrl={markdownUrl} />}
      <Content {...props} />
    </>
  );
}
