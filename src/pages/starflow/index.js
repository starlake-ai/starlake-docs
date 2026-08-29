import React from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import CodeBlock from '@theme/CodeBlock';
import styles from './index.module.css';

const HAND_WRITTEN = `-- merge_orders.sql, one warehouse of three
CREATE TEMP TABLE orders_stage AS
SELECT * FROM read_json('incoming/orders_*.json');

-- reject rows with bad types, log them somewhere
-- handle the column that marketing renamed last week

MERGE INTO analytics.orders t
USING orders_stage s ON t.order_id = s.order_id
WHEN MATCHED AND s.order_date > t.order_date
  THEN UPDATE SET quantity = s.quantity, ...
WHEN NOT MATCHED THEN INSERT (order_id, ...)

-- plus dag.py: sensors, retries, alerting
-- plus the audit table nobody backfilled
-- now repeat for Snowflake and BigQuery`;

const STARFLOW_YAML = `# metadata/load/starbake/orders.sl.yml
table:
  name: orders
  pattern: "orders.*.json"
  metadata:
    format: JSON_FLAT
    schedule: "0 * * * *"
    writeStrategy:
      type: UPSERT_BY_KEY_AND_TIMESTAMP
      key: [order_id]
      timestamp: order_date
  attributes:
    - name: order_id
      type: long
    - name: customer_id
      type: long
      foreignKey: starbake.customers.id
    - name: order_date
      type: date`;

function HeroSection() {
  return (
    <section className={styles.hero}>
      <div className={`container ${styles.heroGrid}`}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>Starlake Starflow</span>
          <h1 className={styles.heroTitle}>
            Declare the pipeline.
            <br />
            Skip the plumbing.
          </h1>
          <p className={styles.heroLede}>
            Starflow turns the extract, load, transform, and orchestration
            boilerplate every data team rewrites into one YAML file per table:
            you declare <em>what</em>, it generates the <em>how</em> for your
            warehouse.
          </p>
          <div className={styles.ctaRow}>
            <Link className="button--starlake button--starlake-primary" to="/starflow/setup/starlake-core-setup">
              Quickstart
            </Link>
            <Link className="button--starlake button--starlake-secondary" to="/starflow/guides">
              Browse the guides
            </Link>
          </div>
          <p className={styles.proofLine}>
            Apache-2.0 · In production at BPCE Payment Services, Estreem, Axereal, Z Energy, and Ascendia
          </p>
        </div>
        <div className={styles.compare}>
          <div className={`${styles.pane} ${styles.paneBefore}`}>
            <div className={styles.paneTab}>by hand</div>
            <div className={styles.paneCode}>
              <CodeBlock language="sql">{HAND_WRITTEN}</CodeBlock>
            </div>
            <div className={styles.paneCaption}>per table, per warehouse, forever</div>
          </div>
          <div className={`${styles.pane} ${styles.paneAfter}`}>
            <div className={styles.paneTab}>with Starflow</div>
            <div className={styles.paneCode}>
              <CodeBlock language="yaml">{STARFLOW_YAML}</CodeBlock>
            </div>
            <div className={styles.paneCaption}>
              parse, validate, merge, schedule: the whole pipeline
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustStrip() {
  const facts = [
    { title: 'Apache-2.0, for good', detail: 'A standing public commitment: no BSL, no SSPL, ever.' },
    { title: 'No telemetry', detail: 'Nothing phones home. Verify it in the source.' },
    { title: 'Your infrastructure', detail: 'Runs entirely where your data lives. EU-sovereignty friendly.' },
    { title: 'Open standards', detail: 'Arrow Flight SQL and DuckLake, not proprietary protocols.' },
  ];
  return (
    <section className={styles.trust}>
      <div className={`container ${styles.trustGrid}`}>
        {facts.map((f) => (
          <div className={styles.trustItem} key={f.title}>
            <span className={styles.trustTitle}>{f.title}</span>
            <span className={styles.trustDetail}>{f.detail}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function PipelineSection() {
  const stages = [
    {
      title: 'Extract',
      description: 'Pull schemas and data from JDBC databases, REST APIs, and OpenAPI specs into versioned YAML.',
      link: '/starflow/guides/extract/tutorial',
    },
    {
      title: 'Load',
      description: 'Ingest CSV, JSON, XML, and Parquet with type validation, rejection reports, and merge strategies.',
      link: '/starflow/guides/load/tutorial',
    },
    {
      title: 'Transform',
      description: 'Write plain SQL; Starflow resolves dependencies and generates the right MERGE for each engine.',
      link: '/starflow/guides/transform/tutorial',
    },
    {
      title: 'Orchestrate',
      description: 'Dependency-ordered DAGs generated for Airflow, Dagster, or Snowflake Tasks. No hand-written graphs.',
      link: '/starflow/guides/orchestrate/tutorial',
    },
  ];
  return (
    <section className="features-section">
      <div className="container">
        <h2 className="features-section__title">One declaration, four stages</h2>
        <p className="features-section__subtitle">
          The same YAML drives every step, on DuckDB, BigQuery, Snowflake, Redshift,
          PostgreSQL, or Spark.
        </p>
        <div className={styles.stageGrid}>
          {stages.map((s) => (
            <Link to={s.link} key={s.title} className={styles.stageCard}>
              <h3 className={styles.stageTitle}>{s.title}</h3>
              <p className={styles.stageDescription}>{s.description}</p>
              <span className={styles.stageCta}>Tutorial →</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function TwoPathsSection() {
  const paths = [
    {
      icon: '🧭',
      title: 'Starflow',
      description:
        'Guided methodology layer. Five expert personas (Lea, Winston, Amelia, Quinn, Max) walk you through Discovery → Architecture → Pipeline Design → Implementation, with adversarial code review and end-of-epic retrospectives.',
      cta: 'Open the Starflow guide',
      link: '/starflow/skills/starflow',
    },
    {
      icon: '⚡',
      title: 'Direct CLI Skills',
      description:
        'One skill per Starlake command: load, transform, extract, dag-generate, and 45 more. Ask in natural language; get production-ready YAML, SQL, or shell.',
      cta: 'Browse the catalog',
      link: '/starflow/skills/catalog',
    },
  ];

  return (
    <section className="features-section" style={{ background: 'var(--sl-color-surface)' }}>
      <div className="container">
        <h2 className="features-section__title">Two Ways to Use the Skills</h2>
        <p className="features-section__subtitle">
          Greenfield project or migration? Start with Starflow for the full lifecycle. Quick targeted task? Use a CLI skill directly.
        </p>
        <div className="feature-grid">
          {paths.map((p, idx) => (
            <Link to={p.link} key={idx} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="feature-card">
                <span className="feature-card__icon">{p.icon}</span>
                <h3 className="feature-card__title">{p.title}</h3>
                <p className="feature-card__description">{p.description}</p>
                <p className="feature-card__description" style={{ marginTop: '1rem', fontWeight: 600 }}>
                  {p.cta} →
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function SkillsOverviewSection() {
  const categories = [
    {
      icon: '📥',
      title: 'Ingestion & Loading',
      count: 8,
      skills: ['autoload', 'load', 'cnxload', 'esload', 'kafkaload', 'ingest', 'preload', 'stage'],
      link: '/starflow/skills/catalog/ingestion',
    },
    {
      icon: '🔄',
      title: 'Transformation',
      count: 2,
      skills: ['transform', 'job'],
      link: '/starflow/skills/catalog/transformation',
    },
    {
      icon: '📤',
      title: 'Extraction',
      count: 7,
      skills: ['extract', 'extract-schema', 'extract-data', 'extract-bq-schema', 'extract-rest-schema', 'extract-rest-data', 'extract-script'],
      link: '/starflow/skills/catalog/extraction',
    },
    {
      icon: '📋',
      title: 'Schema Management',
      count: 6,
      skills: ['bootstrap', 'infer-schema', 'xls2yml', 'xls2ymljob', 'yml2ddl', 'yml2xls'],
      link: '/starflow/skills/catalog/schema-management',
    },
    {
      icon: '✅',
      title: 'Data Quality',
      count: 1,
      skills: ['expectations'],
      link: '/starflow/skills/catalog/data-quality',
    },
    {
      icon: '🔗',
      title: 'Lineage',
      count: 4,
      skills: ['lineage', 'col-lineage', 'table-dependencies', 'acl-dependencies'],
      link: '/starflow/skills/catalog/lineage',
    },
    {
      icon: '🛫',
      title: 'Orchestration',
      count: 2,
      skills: ['dag-generate', 'dag-deploy'],
      link: '/starflow/skills/catalog/orchestration',
    },
    {
      icon: '⚙️',
      title: 'Operations',
      count: 7,
      skills: ['validate', 'metrics', 'freshness', 'console', 'serve', 'settings', 'migrate'],
      link: '/starflow/skills/catalog/operations',
    },
    {
      icon: '🔒',
      title: 'Security',
      count: 2,
      skills: ['secure', 'iam-policies'],
      link: '/starflow/skills/catalog/security',
    },
    {
      icon: '🛠️',
      title: 'Configuration',
      count: 2,
      skills: ['config', 'connection'],
      link: '/starflow/skills/catalog/configuration',
    },
    {
      icon: '🧰',
      title: 'Utilities',
      count: 6,
      skills: ['bq-info', 'compare', 'parquet2csv', 'site', 'summarize', 'test'],
      link: '/starflow/skills/catalog/utilities',
    },
  ];

  return (
    <section className="features-section">
      <div className="container">
        <h2 className="features-section__title">Skill Catalog</h2>
        <p className="features-section__subtitle">
          49 skills across 11 categories, one per Starlake CLI command, with the configuration patterns to match.
        </p>
        <div className="skills-grid">
          {categories.map((cat, idx) => (
            <Link to={cat.link} key={idx} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="skill-category-card">
                <div className="skill-category-card__header">
                  <span className="skill-category-card__icon">{cat.icon}</span>
                  <h3 className="skill-category-card__title">{cat.title}</h3>
                  <span className="skill-category-card__count">{cat.count} skills</span>
                </div>
                <ul className="skill-category-card__list">
                  {cat.skills.map((skill, i) => (
                    <li key={i}>{skill}</li>
                  ))}
                </ul>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function StarflowSection() {
  const phases = [
    {
      icon: '🔍',
      title: '1. Discovery',
      description: 'Map data domains, sources, and ownership before writing any configuration.',
      skills: ['domain-discovery', 'source-analysis'],
    },
    {
      icon: '🏗️',
      title: '2. Architecture',
      description: 'Design the platform, layers, engines, and table schemas that will support your pipelines.',
      skills: ['create-data-architecture', 'schema-design'],
    },
    {
      icon: '📐',
      title: '3. Pipeline Design',
      description: 'Specify pipelines end-to-end (extract, load, transform, orchestrate) before implementation.',
      skills: ['create-pipeline-spec', 'transform-design', 'orchestration-design'],
    },
    {
      icon: '🚀',
      title: '4. Implementation',
      description: 'Build, review, deploy, and reflect. Adversarial parallel code review and end-of-epic retros.',
      skills: ['sprint-planning', 'dev-pipeline', 'code-review', 'retrospective'],
    },
  ];

  return (
    <section className="features-section" style={{ background: 'var(--sl-color-surface)' }}>
      <div className="container">
        <h2 className="features-section__title">Guided methodology, five expert personas</h2>
        <p className="features-section__subtitle">
          Four phases, five expert personas, persistent step-file workflows that resume across sessions.
        </p>
        <div className="skills-grid">
          {phases.map((phase, idx) => (
            <Link to="/starflow/skills/starflow" key={idx} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="skill-category-card">
                <div className="skill-category-card__header">
                  <span className="skill-category-card__icon">{phase.icon}</span>
                  <h3 className="skill-category-card__title">{phase.title}</h3>
                </div>
                <p className="feature-card__description" style={{ margin: '0.5rem 0 1rem' }}>
                  {phase.description}
                </p>
                <ul className="skill-category-card__list">
                  {phase.skills.map((s, i) => (
                    <li key={i}>starflow-{s}</li>
                  ))}
                </ul>
              </div>
            </Link>
          ))}
        </div>
        <p className="features-section__subtitle" style={{ marginTop: '2rem' }}>
          Plus five agent personas (<strong>Lea</strong>, <strong>Winston</strong>,{' '}
          <strong>Amelia</strong>, <strong>Quinn</strong>, <strong>Max</strong>) covering data analysis,
          architecture, engineering, quality, and platform; and the cross-cutting{' '}
          <code>data-quality-review</code>, <code>lineage-review</code>, and adaptive{' '}
          <code>starflow-help</code> skills.
        </p>
      </div>
    </section>
  );
}

function DemoSection() {
  return (
    <section className="demo-section">
      <div className="container">
        <h2 className="features-section__title">See It in Action</h2>
        <p className="features-section__subtitle">
          Natural-language commands that produce production-ready configurations.
        </p>
        <pre style={{
          background: '#1e1e2e',
          color: '#cdd6f4',
          borderRadius: '12px',
          padding: '2rem',
          maxWidth: '800px',
          margin: '0 auto',
          fontSize: '0.9rem',
          lineHeight: '1.8',
          overflow: 'auto',
        }}>
          <code>{`# Bootstrap a new project targeting BigQuery with Airflow
> /bootstrap a new project targeting BigQuery with Airflow orchestration

# Configure ingestion for CSV files
> /load CSV files from GCS into the customers domain with OVERWRITE strategy

# Generate column-level lineage
> /col-lineage for the revenue_summary transform

# Generate Airflow DAGs from your pipeline config
> /dag-generate for all domains using Airflow with daily schedule

# Or use Starflow for a guided lifecycle

# Talk to the data architect persona
> /starflow-data-architect Design a data platform for our e-commerce analytics

# Ask Starflow what to do next based on your project state
> /starflow-help What should I work on next?`}</code>
        </pre>
      </div>
    </section>
  );
}

function PlatformsSection() {
  const layers = [
    {
      title: 'AI Assistants',
      sub: 'where you talk to Starlake',
      items: ['Claude Code', 'GitHub Copilot', 'Gemini CLI'],
    },
    {
      title: 'Starlake Skills',
      sub: 'this bundle',
      items: ['49 CLI skills', 'Starflow methodology', '5 expert personas'],
      highlight: true,
    },
    {
      title: 'Orchestration',
      sub: 'scheduling and DAGs',
      items: ['Airflow', 'Dagster'],
    },
    {
      title: 'Data Warehouses & Compute',
      sub: 'where your data lives',
      items: ['BigQuery', 'Snowflake', 'DuckDB', 'PostgreSQL', 'Redshift', 'Databricks'],
    },
  ];

  return (
    <section className="features-section">
      <div className="container">
        <h2 className="features-section__title">The Starlake Stack</h2>
        <p className="features-section__subtitle">
          One bundle, every layer.
        </p>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          {layers.map((layer, idx) => (
            <React.Fragment key={idx}>
              <div style={{
                background: layer.highlight
                  ? 'linear-gradient(135deg, var(--sl-color-primary, #4f46e5), #7c3aed)'
                  : 'var(--sl-color-surface)',
                color: layer.highlight ? '#fff' : 'inherit',
                border: layer.highlight ? 'none' : '1px solid var(--ifm-color-emphasis-200)',
                borderRadius: '14px',
                padding: '1.25rem 1.5rem',
                boxShadow: layer.highlight
                  ? '0 6px 20px rgba(79, 70, 229, 0.25)'
                  : '0 1px 2px rgba(0,0,0,0.04)',
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: '0.75rem',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>{layer.title}</h3>
                  <span style={{ fontSize: '0.85rem', opacity: 0.75 }}>{layer.sub}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {layer.items.map((item, i) => (
                    <span key={i} style={{
                      background: layer.highlight
                        ? 'rgba(255,255,255,0.2)'
                        : 'var(--ifm-background-color)',
                      border: layer.highlight
                        ? '1px solid rgba(255,255,255,0.25)'
                        : '1px solid var(--ifm-color-emphasis-200)',
                      padding: '0.35rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.9rem',
                      fontWeight: 500,
                    }}>
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              {idx < layers.length - 1 && (
                <div style={{
                  textAlign: 'center',
                  color: 'var(--ifm-color-emphasis-500)',
                  fontSize: '1.4rem',
                  lineHeight: 1,
                  margin: '0.4rem 0',
                }}>
                  ↓
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <Layout
      title="Home"
      description="Starlake Starflow: declarative, YAML-driven extract, load, transform, and orchestration for DuckDB, BigQuery, Snowflake, Redshift, and PostgreSQL.">
      <main>
        <HeroSection />
        <TrustStrip />
        <PipelineSection />
        <TwoPathsSection />
        <StarflowSection />
        <SkillsOverviewSection />
        <DemoSection />
        <PlatformsSection />
      </main>
    </Layout>
  );
}
