import React from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import styles from './index.module.css';

const PRODUCTS = [
  {
    name: 'Starflow',
    tagline: 'Declarative data pipelines',
    description:
      'Extract, load, transform, and orchestrate with one YAML file per table. ' +
      'You declare what, Starflow generates the how for DuckDB, BigQuery, ' +
      'Snowflake, Redshift, PostgreSQL, or Spark, with DAGs for Airflow, ' +
      'Dagster, and Snowflake Tasks.',
    home: '/starflow',
    homeLabel: 'Starflow documentation',
    quickstart: '/starflow/setup/starlake-core-setup',
    accentClass: styles.cardStarflow,
  },
  {
    name: 'Quack on Demand',
    tagline: 'Autoscaling DuckDB fleets',
    description:
      'A multi-tenant Arrow Flight SQL gateway for DuckDB and DuckLake: one ' +
      'governed, horizontally-scaled endpoint with per-tenant isolation, ' +
      'fine-grained ACLs, federated queries, and ODBC/JDBC/ADBC access.',
    home: '/qod',
    homeLabel: 'QoD documentation',
    quickstart: '/qod/getting-started/quickstart',
    accentClass: styles.cardQod,
  },
];

function ProductCard({ product }) {
  return (
    <div className={`${styles.card} ${product.accentClass}`}>
      <span className={styles.cardTagline}>{product.tagline}</span>
      <h2 className={styles.cardName}>{product.name}</h2>
      <p className={styles.cardDescription}>{product.description}</p>
      <div className={styles.cardActions}>
        <Link className="button--starlake button--starlake-primary" to={product.home}>
          {product.homeLabel}
        </Link>
        <Link className="button--starlake button--starlake-secondary" to={product.quickstart}>
          Quickstart
        </Link>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Layout
      title="Documentation"
      description="Documentation for the Starlake open-source data platform: Starflow, declarative YAML data pipelines, and Quack on Demand, autoscaling DuckDB fleets.">
      <main>
        <section className={styles.hero}>
          <div className="container">
            <span className={styles.eyebrow}>Starlake documentation</span>
            <h1 className={styles.title}>Declarative pipelines. DuckDB at scale.</h1>
            <p className={styles.lede}>
              Each is Apache-2.0 with a standing commitment never to relicense,
              ships no telemetry, and runs entirely on your own infrastructure.
            </p>
            <div className={styles.cardGrid}>
              {PRODUCTS.map((p) => (
                <ProductCard product={p} key={p.name} />
              ))}
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
