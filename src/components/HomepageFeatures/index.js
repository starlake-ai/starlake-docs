import React from 'react';
import clsx from 'clsx';
import styles from './HomepageFeatures.module.css';

import ReactPlayer from 'react-player/lazy';

const FeatureList = [
  {
    title: 'Just YAML and regular SQL',
    Svg: require('@site/static/img/lowcode.svg').default,
    description: (
        <>
            Run on your favorite orchestrator against your favorite warehouse <br/>
            BigQuery / Databricks / Redshift / Snowflake and many more.
        </>
    ),
  },
  {
    title: (
        <>
            Full & Incremental
        </>
    ),
    Svg: require('@site/static/img/cloudnative.svg').default,
    description: (
      <>
          Full & Incremental Parallel data extraction <br/>
          Full & Incremental Load with advanced validation<br/>
          Full & Incremental Transform with lineage handling
      </>
    ),
  },
  {
    title: 'Observability & Security',
    Svg: require('@site/static/img/devops.svg').default,
    description: (
      <>
        Validate input files, Test business logic <br/>Secure tables, rows and columns<br/>
          Generate documentation &
          metrics
      </>
    ),
  },
];

/* alignImg : left/right/center/full/big  */
const SplitSectionList = [
  {
      title: (
          <>
          From any source <br/>to any sink
          </>
      ),
      isBackgroundColored: 'yes',
      reverse: 'no',
      Img: require('@site/static/img/starlake_schema.svg').default,
      ImgMobile: require('@site/static/img/starlake_schema-mobile.svg').default,
      alignImg: 'right',
      description: (
       <p className='split-description'>
            Extract, Load and Transform your data
           with advanced  validation, anonymization and transformation capabilities.

       </p>
      ),
      linkText: 'Discover',
      linkURL: 'docs/next/intro',
      LinkSvg: require('@site/static/img/eye.svg').default,
  },
  {
    title: (
        <>
        Script Free <br/>Database <br/>Replication
        </>
    ),
    isBackgroundColored: 'no',
    reverse: 'yes',
    Img: require('@site/static/img/scriptfree.svg').default,
    ImgMobile: require('@site/static/img/scriptfree_mobile.svg').default,
    alignImg: 'full',
    BeforeTitle: require('@site/static/img/scriptfree_icon.svg').default,
    description:(
      <p className='split-description'>
        Automated full and incremental replication of your data from any relational database to your favorite datawarehouse without writing a single line of code.
      </p>
    ),
    linkText: 'Read more',
    linkURL: 'docs/category/extract',
    LinkSvg: require('@site/static/img/arrow_right.svg').default,
},
{
      title: (
          <>
          Keep your <br/>Lakehouse from <br/>becoming a <br/>Dataswamp
          </>
      ),
      isBackgroundColored: 'yes',
      reverse: 'no',
      Img: require('@site/static/img/lakehouse.svg').default,
      ImgMobile: require('@site/static/img/lakehouse_mobile.svg').default,
      alignImg: 'full',
      description:(
        <p className='split-description'>
          Load almost any file with thorough validation and free yourself of any database scripting.
        </p>
      ),
      linkText: 'Read more',
      linkURL: 'docs/intro',
      LinkSvg: require('@site/static/img/arrow_right.svg').default,
  },
  {
    title: (
        <>
            Run Task<br/>Dependency Graphs<br/>on your Orchestrator
        </>
    ),
    isBackgroundColored: 'no',
    reverse: 'yes',
    Img: require('@site/static/img/relationshipeditor_new.svg').default,
    ImgMobile: require('@site/static/img/relationshipeditor_new.svg').default,
    alignImg: 'left',
    description:(
      <p className='split-description'>
          Use out-of-the DAG templates to run you transformations instantly on your favorite orchestration engine.
      </p>
    ),
    linkText: 'Read more',
    linkURL: 'docs/guides/orchestrate/tutorial',
    LinkSvg: require('@site/static/img/arrow_right.svg').default,
},
{
      title: (
          <>
          Business & <br/>Developer Friendly
          </>
      ),
      isBackgroundColored: 'yes',
      reverse: 'no',
      Img: require('@site/static/img/devfriendly.svg').default,
      ImgMobile: require('@site/static/img/devfriendly.svg').default,
      alignImg: 'left',
      description:(
        <p className='split-description'>
            Using an Excel like interface, your business users are able to browse,
            update and validate [extract], [load] or [transform] metadata such as primary/ foreign keys, table/column descriptions and access rules
        </p>
      ),
      linkText: 'Read more',
      linkURL: 'docs/guides/load/autoload',
      LinkSvg: require('@site/static/img/arrow_right.svg').default,
  },
  {
      title: (
          <>
          Security matters
          </>
      ),
      isBackgroundColored: 'no',
      reverse: 'yes',
      Img: require('@site/static/img/security_new.svg').default,
      ImgMobile: require('@site/static/img/security_new.svg').default,
      alignImg: 'full',
      BeforeTitle: require('@site/static/img/security_icon.svg').default,
      description:(
        <p className='split-description'>
          Apply security at build time before any unauthorized access to your data.
          Visualize your access policies before applying them to your data.
        </p>
      ),
      linkText: 'Read more',
      linkURL: 'docs/guides/load/security',
      LinkSvg: require('@site/static/img/arrow_right.svg').default,
  },
  {
      title: (
          <>
          Data Observability <br/>through Metrics <br/>and Auditing
          </>
      ),
      isBackgroundColored: 'yes',
      reverse: 'no',
      Img: require('@site/static/img/observability.svg').default,
      ImgMobile: require('@site/static/img/observability.svg').default,
      alignImg: 'full',
      description:(
        <p className='split-description'>
          Keep an eye on your workloads and data quality with starlake built-in metrics and auditing capabilities.
        </p>
      ),
      linkText: 'Read more',
      linkURL: 'docs/next/user-guide/metrics',
      LinkSvg: require('@site/static/img/arrow_right.svg').default,
  },
  {
      title: (
          <>
          Best in-class<br/>VS Code extension
          </>
      ),
      isBackgroundColored: 'no',
      reverse: 'yes',
      video:'https://youtu.be/8EL9-UiW6zs',
      alignImg: 'left',
      description:(
        <p className='split-description'>
          Auto-complete, syntax highlighting, linting, lineage and more. All the features you expect from a modern SQL IDE.
          <br/>Work securely without the need to share your credentials with any remote party.
        </p>
      ),
      linkText: 'Read more',
      linkURL: 'https://marketplace.visualstudio.com/items?itemName=Starlake.starlake',
      LinkSvg: require('@site/static/img/arrow_right.svg').default,
  }
];

function Feature({Svg, title, description}) {
  return (
    <div className={clsx('col col--4 feature')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <h3 className='feature-title'>{title}</h3>
        <p className='feature-description'>{description}</p>
      </div>
    </div>
  );
}

function SplitSection({isBackgroundColored, reverse, Img, ImgMobile, alignImg, video, BeforeTitle, title, description, linkText, linkURL, LinkSvg}) {
    return(
        <section className={`${clsx('split_section')} ${isBackgroundColored=='yes' ? "coloredBckg" : ''}`}>
          <div className="container">
            <div className={`${clsx('row align-items-center')} ${reverse=='yes' ? styles.reverse : ''}`}>
                <div className={`${alignImg=='big' ? clsx('col col--4') : clsx('col col--6')}`}>
                    <div className={styles.split_content}>
                        {BeforeTitle ? <BeforeTitle className={styles.beforeTitle} role="img" /> : ""}
                        <h2 className="title_gradient">{title}</h2>
                        {description}
                        <a title={linkText} href={linkURL} className="violet_btn">
                            <span>{linkText}</span>
                            <i>
                                <LinkSvg className={styles.link_icon} role="img" />
                            </i>
                        </a>
                    </div>
                </div>
                <div className={`${alignImg=='big' ? clsx('col col--8') : clsx('col col--6')}`}>
                    <div className={`${styles.split_img} align_${alignImg} ${video ? clsx('is_video') : ''}`}>
                        {Img ? <Img className="img-fluid hide_mobile" role="img" /> : '' }
                        {ImgMobile ? <ImgMobile className="img-fluid hide_desktop" role="img" /> : ""}                     
                        {video ? <ReactPlayer url={video} /> : ""}                        
                    </div>
                </div>
            </div>
           </div>
        </section>
    );
}

export default function HomepageFeatures() {
  return (
      <main>
        <section className={styles.features}>
          <div className="container">
            <div className="row">
              {FeatureList.map((props, idx) => (
                <Feature key={idx} {...props} />
              ))}
            </div>
          </div>
        </section>
        {SplitSectionList.map((props, idx) => (
            <SplitSection key={idx} {...props} />
        ))}
      </main>
  );
}
