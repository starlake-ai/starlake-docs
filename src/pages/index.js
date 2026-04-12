import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';

function HeroSection() {
  return (
    <section className="hero--starlake">
      <div className="container">
        <h1 className="hero__title">Starlake Skills</h1>
        <p className="hero__subtitle">
          Open-source Claude Code plugin providing 48 specialized skills for
          building, configuring, and operating Starlake data pipelines.
        </p>

        <div className="hero__buttons">
          <Link
            className="button--starlake button--starlake-primary"
            to="/setup/starlake-core-setup">
            Get Started
          </Link>
          <Link
            className="button--starlake button--starlake-secondary"
            to="/skills/catalog">
            Browse Skills
          </Link>
          <Link
            className="button--starlake button--starlake-secondary"
            href="https://github.com/starlake-ai/starlake-skills">
            View on GitHub
          </Link>
        </div>

        <div className="install-command">
          <code>git clone https://github.com/starlake-ai/starlake-skills.git ~/.claude/skills/starlake-skills</code>
        </div>
      </div>
    </section>
  );
}

function StatsSection() {
  return (
    <section className="features-section">
      <div className="container">
        <div className="stats-bar">
          <div className="stat-item">
            <span className="stat-item__number">48</span>
            <span className="stat-item__label">Specialized Skills</span>
          </div>
          <div className="stat-item">
            <span className="stat-item__number">6+</span>
            <span className="stat-item__label">Data Warehouses</span>
          </div>
          <div className="stat-item">
            <span className="stat-item__number">10</span>
            <span className="stat-item__label">Skill Categories</span>
          </div>
          <div className="stat-item">
            <span className="stat-item__number">2</span>
            <span className="stat-item__label">Orchestrators</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function WhySection() {
  const features = [
    {
      icon: '🔓',
      title: 'Open source & auditable',
      description:
        'Every skill, every prompt, every configuration pattern is inspectable and extensible. Apache-2.0 licensed for full transparency.',
    },
    {
      icon: '🔌',
      title: 'Cross-platform, not single-vendor',
      description:
        'Covers BigQuery, Snowflake, DuckDB, PostgreSQL, Redshift, and Databricks. Write once, deploy anywhere.',
    },
    {
      icon: '🤖',
      title: 'AI-native workflow',
      description:
        'Purpose-built for Claude Code. Ask questions in natural language and get expert Starlake guidance with ready-to-use configurations.',
    },
    {
      icon: '📦',
      title: 'Complete coverage',
      description:
        '48 skills covering every CLI command, configuration pattern, write strategy, data quality expectation, and production best practice.',
    },
  ];

  return (
    <section className="features-section" style={{ background: 'var(--sl-color-surface)' }}>
      <div className="container">
        <h2 className="features-section__title">Why Starlake Skills?</h2>
        <p className="features-section__subtitle">
          Your AI-powered co-pilot for declarative data pipeline development.
        </p>
        <div className="feature-grid">
          {features.map((feature, idx) => (
            <div className="feature-card" key={idx}>
              <span className="feature-card__icon">{feature.icon}</span>
              <h3 className="feature-card__title">{feature.title}</h3>
              <p className="feature-card__description">{feature.description}</p>
            </div>
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
      count: 9,
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
      count: 5,
      skills: ['extract', 'extract-schema', 'extract-data', 'extract-bq-schema', 'extract-script'],
      link: '/skills/catalog/extraction',
    },
    {
      icon: '📋',
      title: 'Schema Management',
      count: 5,
      skills: ['bootstrap', 'infer-schema', 'xls2yml', 'yml2ddl', 'yml2xls'],
      link: '/skills/catalog/schema-management',
    },
    {
      icon: '🔗',
      title: 'Lineage & Dependencies',
      count: 4,
      skills: ['lineage', 'col-lineage', 'table-dependencies', 'acl-dependencies'],
      link: '/skills/catalog/lineage',
    },
    {
      icon: '⚙️',
      title: 'Operations & Orchestration',
      count: 10,
      skills: ['dag-generate', 'dag-deploy', 'validate', 'metrics', 'freshness', 'gizmosql'],
      link: '/skills/catalog/operations',
    },
  ];

  return (
    <section className="features-section">
      <div className="container">
        <h2 className="features-section__title">48 Specialized Skills</h2>
        <p className="features-section__subtitle">
          Covering the full Starlake lifecycle — from ingestion to orchestration.
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

function DemoSection() {
  return (
    <section className="demo-section">
      <div className="container">
        <h2 className="features-section__title">See It in Action</h2>
        <p className="features-section__subtitle">
          Natural language commands that generate production-ready configurations.
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
          <code>{`# Set up a new Starlake project with BigQuery
> /bootstrap a new project targeting BigQuery with Airflow orchestration

# Configure data ingestion for CSV files
> /load CSV files from GCS into the customers domain with OVERWRITE strategy

# Generate column-level lineage
> /col-lineage for the revenue_summary transform

# Create Airflow DAGs from your pipeline config
> /dag-generate for all domains using Airflow with daily schedule

# Validate your entire project configuration
> /validate the full project and fix any schema errors

# Extract schemas from an existing Snowflake database
> /extract-schema from Snowflake connection "prod" for the analytics schema`}</code>
        </pre>
      </div>
    </section>
  );
}

function PlatformsSection() {
  const platforms = [
    { name: 'BigQuery' },
    { name: 'Snowflake' },
    { name: 'DuckDB' },
    { name: 'PostgreSQL' },
    { name: 'Redshift' },
    { name: 'Databricks' },
    { name: 'Airflow' },
    { name: 'Dagster' },
  ];

  return (
    <section className="features-section" style={{ background: 'var(--sl-color-surface)' }}>
      <div className="container">
        <h2 className="features-section__title">Multi-Platform Support</h2>
        <p className="features-section__subtitle">
          One plugin, every warehouse and orchestrator.
        </p>
        <div className="platforms-grid">
          {platforms.map((p, idx) => (
            <div className="platform-badge" key={idx}>
              {p.name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title="Home"
      description="Open-source Claude Code plugin providing 48 specialized skills for Starlake data pipelines">
      <main>
        <HeroSection />
        <StatsSection />
        <WhySection />
        <SkillsOverviewSection />
        <DemoSection />
        <PlatformsSection />
      </main>
    </Layout>
  );
}
