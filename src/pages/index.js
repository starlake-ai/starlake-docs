import React from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';

function HeroSection() {
  return (
    <section className="hero--starlake">
      <div className="container">
        <h1 className="hero__title">Prompt in plain English. Starflow AI ships.</h1>
        <p className="hero__subtitle" style={{ fontSize: '1.4rem', marginBottom: '1rem' }}>
          The <strong>what</strong>, not the <strong>how</strong>.
        </p>
        <p className="hero__subtitle" style={{ maxWidth: '780px', margin: '0 auto 2rem', textAlign: 'center' }}>
          Pipelines as configuration, not code.
        </p>

        <div className="hero__buttons">
          <Link
            className="button--starlake button--starlake-primary"
            to="/skills/getting-started/quickstart">
            Quickstart
          </Link>
          <Link
            className="button--starlake button--starlake-secondary"
            to="/skills/starflow">
            Try Starflow
          </Link>
          <Link
            className="button--starlake button--starlake-secondary"
            to="/skills/catalog">
            Browse Skills
          </Link>
          <Link
            className="button--starlake button--starlake-secondary"
            href="https://github.com/starlake-ai/starlake-skills">
            GitHub
          </Link>
        </div>
      </div>
    </section>
  );
}

function StatsSection() {
  return (
    <section className="features-section" style={{ padding: '1.5rem 0' }}>
      <div className="container">
        <div className="stats-bar">
          <div className="stat-item">
            <span className="stat-item__number">49</span>
            <span className="stat-item__label">CLI Skills</span>
          </div>
          <div className="stat-item">
            <span className="stat-item__number">19</span>
            <span className="stat-item__label">Starflow Skills</span>
          </div>
          <div className="stat-item">
            <span className="stat-item__number">5</span>
            <span className="stat-item__label">Agent Personas</span>
          </div>
          <div className="stat-item">
            <span className="stat-item__number">11</span>
            <span className="stat-item__label">Skill Categories</span>
          </div>
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
      link: '/skills/starflow',
    },
    {
      icon: '⚡',
      title: 'Direct CLI Skills',
      description:
        'One skill per Starlake command: load, transform, extract, dag-generate, and 45 more. Ask in natural language; get production-ready YAML, SQL, or shell.',
      cta: 'Browse the catalog',
      link: '/skills/catalog',
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
      link: '/skills/catalog/ingestion',
    },
    {
      icon: '🔄',
      title: 'Transformation',
      count: 2,
      skills: ['transform', 'job'],
      link: '/skills/catalog/transformation',
    },
    {
      icon: '📤',
      title: 'Extraction',
      count: 7,
      skills: ['extract', 'extract-schema', 'extract-data', 'extract-bq-schema', 'extract-rest-schema', 'extract-rest-data', 'extract-script'],
      link: '/skills/catalog/extraction',
    },
    {
      icon: '📋',
      title: 'Schema Management',
      count: 6,
      skills: ['bootstrap', 'infer-schema', 'xls2yml', 'xls2ymljob', 'yml2ddl', 'yml2xls'],
      link: '/skills/catalog/schema-management',
    },
    {
      icon: '✅',
      title: 'Data Quality',
      count: 1,
      skills: ['expectations'],
      link: '/skills/catalog/data-quality',
    },
    {
      icon: '🔗',
      title: 'Lineage',
      count: 4,
      skills: ['lineage', 'col-lineage', 'table-dependencies', 'acl-dependencies'],
      link: '/skills/catalog/lineage',
    },
    {
      icon: '🛫',
      title: 'Orchestration',
      count: 2,
      skills: ['dag-generate', 'dag-deploy'],
      link: '/skills/catalog/orchestration',
    },
    {
      icon: '⚙️',
      title: 'Operations',
      count: 8,
      skills: ['validate', 'metrics', 'freshness', 'gizmosql', 'console', 'serve', 'settings', 'migrate'],
      link: '/skills/catalog/operations',
    },
    {
      icon: '🔒',
      title: 'Security',
      count: 2,
      skills: ['secure', 'iam-policies'],
      link: '/skills/catalog/security',
    },
    {
      icon: '🛠️',
      title: 'Configuration',
      count: 2,
      skills: ['config', 'connection'],
      link: '/skills/catalog/configuration',
    },
    {
      icon: '🧰',
      title: 'Utilities',
      count: 6,
      skills: ['bq-info', 'compare', 'parquet2csv', 'site', 'summarize', 'test'],
      link: '/skills/catalog/utilities',
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
        <h2 className="features-section__title">Starflow: Guided Methodology</h2>
        <p className="features-section__subtitle">
          Four phases, five expert personas, persistent step-file workflows that resume across sessions.
        </p>
        <div className="skills-grid">
          {phases.map((phase, idx) => (
            <Link to="/skills/starflow" key={idx} style={{ textDecoration: 'none', color: 'inherit' }}>
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
      description="Open-source AI skills for the Starlake CLI: 49 skills plus Starflow, a guided methodology with five expert personas.">
      <main>
        <HeroSection />
        <StatsSection />
        <TwoPathsSection />
        <StarflowSection />
        <SkillsOverviewSection />
        <DemoSection />
        <PlatformsSection />
      </main>
    </Layout>
  );
}
