import React from 'react';
import TOCDesktop from '@theme-original/DocItem/TOC/Desktop';
import PageActions from '@site/src/components/PageActions';
import {useMarkdownUrl} from '@site/src/components/PageActions/hooks';
import styles from './styles.module.css';

// Page actions sit atop the right-hand TOC and stay sticky with it.
export default function TOCDesktopWrapper(props) {
  const markdownUrl = useMarkdownUrl();
  return (
    <div className={styles.aside}>
      {markdownUrl && <PageActions markdownUrl={markdownUrl} placement="toc" />}
      <TOCDesktop {...props} />
    </div>
  );
}
