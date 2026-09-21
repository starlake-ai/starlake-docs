import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import QodCapabilityMatrix from '../../components/QodCapabilityMatrix';
import styles from './choose.module.css';

export default function Choose(): JSX.Element {
  return (
    <Layout
      title="Which setup do you need?"
      description="What each Quack on Demand setup includes: plain DuckDB, qod serve on files, qod serve with an Iceberg catalog, and qod serve on DuckLake."
    >
      <main className={styles.page}>
        <header className={styles.head}>
          <span className={styles.kicker}>Quack on Demand</span>
          <h1 className={styles.title}>Which setup do you need?</h1>
          <p className={styles.lead}>
            Four ways to run it, from lightest to heaviest: plain DuckDB on your
            machine, <code>qod serve</code> over files you already have, the same
            gateway with your Iceberg catalog attached, and the full DuckLake
            warehouse with history. Read down the table for the first column that
            covers what you need. If that is plain DuckDB, use DuckDB.
          </p>
        </header>
        <QodCapabilityMatrix />
        <p className={styles.next}>
          Ready to start? <Link to="/qod/getting-started/quickstart">Read the quickstart</Link>,
          or try it with no install: <code>uvx qod serve --demo</code>.
        </p>
      </main>
    </Layout>
  );
}
