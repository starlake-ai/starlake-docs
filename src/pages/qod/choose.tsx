import React from 'react';
import Layout from '@theme/Layout';
import QodDecisionTable from '../../components/QodDecisionTable';
import styles from './choose.module.css';

export default function Choose(): JSX.Element {
  return (
    <Layout
      title="Which setup do you need?"
      description="Five questions about your situation, one recommended Quack on Demand setup and the command to run. Plain DuckDB included, when that is all you need."
    >
      <main className={styles.page}>
        <header className={styles.head}>
          <span className={styles.kicker}>Quack on Demand</span>
          <h1 className={styles.title}>Which setup do you need?</h1>
          <p className={styles.lead}>
            Five questions about your situation. The answer is one setup and the
            command to run. If plain DuckDB is enough, this page says so.
          </p>
        </header>
        <QodDecisionTable />
      </main>
    </Layout>
  );
}
