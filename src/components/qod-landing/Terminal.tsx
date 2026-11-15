import React from 'react';
import styles from './landing.module.css';

export default function Terminal({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className={styles.terminal}>
      <div className={styles.termBar}>
        <span className={styles.termTitle}>{title}</span>
      </div>
      <pre className={styles.termBody}>{children}</pre>
    </div>
  );
}
