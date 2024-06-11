import React, { useState } from 'react';
import clsx from 'clsx';
import styles from './HomepageFeatures.module.css';
import BaseCodeMirror from '@uiw/react-codemirror';
import { sql, SQLDialect, StandardSQL } from '@codemirror/lang-sql';
import ReactPlayer from 'react-player/lazy';
import { transpileQuery } from "./fetches";

const CopyIcon = require('@site/static/img/copy-icon.svg').default
const SuccessIcon = require('@site/static/img/success-icon.svg').default

const WAREHOUSE_OPTIONS = [
  { id: 1, label: "GOOGLE_BIG_QUERY", text: "BigQuery" },
  { id: 2, label: "DATABRICKS", text: 'Databricks' },
  { id: 3, label: "AMAZON_REDSHIFT", text: 'Redshift' },
  { id: 4, label: "SNOWFLAKE", text: 'Snowflake' },
]
const FeatureList = [
  {
    title: 'Just YAML and regular SQL',
    Svg: require('@site/static/img/lowcode.svg').default,
    description: (
      <>
        Run on your favorite orchestrator against your favorite warehouse <br />
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
        Full & Incremental Parallel data extraction <br />
        Full & Incremental Load with advanced validation<br />
        Full & Incremental Transform with lineage handling
      </>
    ),
  },
  {
    title: 'Observability & Security',
    Svg: require('@site/static/img/devops.svg').default,
    description: (
      <>
        Validate input files, Test business logic <br />Secure tables, rows and columns<br />
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
        Effortlessly test <br />your data pipelines
      </>
    ),
    isBackgroundColored: 'yes',
    reverse: 'no',
    alignImg: 'right',
    description: (
      <p className='split-description'>
        How about executing all your SQL queries on DuckDB using your native Data Warehouse SQL dialect ? <br />This is a must have for testing your queries locally or migrate your existing ones

      </p>
    ),
    linkText: 'Discover',
    linkURL: 'docs/next/guides/unit-tests/concepts/index.html',
    LinkSvg: require('@site/static/img/eye.svg').default,
    Component: <CodeEditor EyeIcon={require('@site/static/img/eye.svg').default} />,
    paddingTop: 100,
    sectionHref: 'sql-transpiler'
  },
  {
    title: (
      <>
        From any source <br />to any sink
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
    linkURL: 'docs/next/intro/index.html',
    LinkSvg: require('@site/static/img/eye.svg').default,
  },
  {
    title: (
      <>
        Script Free <br />Database <br />Replication
      </>
    ),
    isBackgroundColored: 'no',
    reverse: 'yes',
    Img: require('@site/static/img/scriptfree.svg').default,
    ImgMobile: require('@site/static/img/scriptfree_mobile.svg').default,
    alignImg: 'full',
    BeforeTitle: require('@site/static/img/scriptfree_icon.svg').default,
    description: (
      <p className='split-description'>
        Automated full and incremental replication of your data from any relational database to your favorite datawarehouse without writing a single line of code.
      </p>
    ),
    linkText: 'Read more',
    linkURL: 'docs/category/extract/index.html',
    LinkSvg: require('@site/static/img/arrow_right.svg').default,
  },
  {
    title: (
      <>
        Keep your <br />Lakehouse from <br />becoming a <br />Dataswamp
      </>
    ),
    isBackgroundColored: 'yes',
    reverse: 'no',
    Img: require('@site/static/img/lakehouse.svg').default,
    ImgMobile: require('@site/static/img/lakehouse_mobile.svg').default,
    alignImg: 'full',
    description: (
      <p className='split-description'>
        Load almost any file with thorough validation and free yourself of any database scripting.
      </p>
    ),
    linkText: 'Read more',
    linkURL: 'docs/intro/index.html',
    LinkSvg: require('@site/static/img/arrow_right.svg').default,
  },
  {
    title: (
      <>
        Run Task<br />Dependency Graphs<br />on your Orchestrator
      </>
    ),
    isBackgroundColored: 'no',
    reverse: 'yes',
    Img: require('@site/static/img/relationshipeditor_new.svg').default,
    ImgMobile: require('@site/static/img/relationshipeditor_new.svg').default,
    alignImg: 'left',
    description: (
      <p className='split-description'>
        Use out-of-the DAG templates to run you transformations instantly on your favorite orchestration engine.
      </p>
    ),
    linkText: 'Read more',
    linkURL: 'docs/guides/orchestrate/tutorial/index.html',
    LinkSvg: require('@site/static/img/arrow_right.svg').default,
  },
  {
    title: (
      <>
        Business & <br />Developer Friendly
      </>
    ),
    isBackgroundColored: 'yes',
    reverse: 'no',
    Img: require('@site/static/img/devfriendly.svg').default,
    ImgMobile: require('@site/static/img/devfriendly.svg').default,
    alignImg: 'left',
    description: (
      <p className='split-description'>
        Using an Excel like interface, your business users are able to browse,
        update and validate [extract], [load] or [transform] metadata such as primary/ foreign keys, table/column descriptions and access rules
      </p>
    ),
    linkText: 'Read more',
    linkURL: 'docs/guides/load/autoload/index.html',
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
    description: (
      <p className='split-description'>
        Apply security at build time before any unauthorized access to your data.
        Visualize your access policies before applying them to your data.
      </p>
    ),
    linkText: 'Read more',
    linkURL: 'docs/guides/load/security/index.html',
    LinkSvg: require('@site/static/img/arrow_right.svg').default,
  },
  {
    title: (
      <>
        Data Observability <br />through Metrics <br />and Auditing
      </>
    ),
    isBackgroundColored: 'yes',
    reverse: 'no',
    Img: require('@site/static/img/observability.svg').default,
    ImgMobile: require('@site/static/img/observability.svg').default,
    alignImg: 'full',
    description: (
      <p className='split-description'>
        Keep an eye on your workloads and data quality with starlake built-in metrics and auditing capabilities.
      </p>
    ),
    linkText: 'Read more',
    linkURL: 'docs/next/user-guide/metrics/index.html',
    LinkSvg: require('@site/static/img/arrow_right.svg').default,
  },
  {
    title: (
      <>
        Best in-class<br />VS Code extension
      </>
    ),
    isBackgroundColored: 'no',
    reverse: 'yes',
    video: 'https://youtu.be/8EL9-UiW6zs',
    alignImg: 'left',
    description: (
      <p className='split-description'>
        Auto-complete, syntax highlighting, linting, lineage and more. All the features you expect from a modern SQL IDE.
        <br />Work securely without the need to share your credentials with any remote party.
      </p>
    ),
    linkText: 'Read more',
    linkURL: 'https://marketplace.visualstudio.com/items?itemName=Starlake.starlake',
    LinkSvg: require('@site/static/img/arrow_right.svg').default,
  }
];

function Feature({ Svg, title, description }) {
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

function CodeEditor() {
  const [isCopied, setIsCopied] = useState(false);
  const QUERY_PREFIX = '-- Paste your statement below\n'
  const customSpec = StandardSQL.dialect;
  customSpec.hashComments = true;
  const customDialect = SQLDialect.define(customSpec);
  const config = {
    dialect: customDialect,
    upperCaseKeywords: true,
  };

  const [data, setData] = useState({
    from_warehouse: "DATABRICKS",
    to_warehouse: "DUCKDB",
    query: `${QUERY_PREFIX}WITH orders AS (SELECT 5 as order_id,\n  'sprocket' as item_name,\n  200 as quantity)\nSELECT * EXCEPT (order_id) FROM orders`,
    transpiledQuery: "",
    isLoading: false,
    showSecondEditor: false
  })
  const [tabIndex, setTabIndex] = useState(0)
  const [error, setError] = useState("")


  const handleTranspileFetch = async () => {
    setError("")
    setData(prev => ({ ...prev, isLoading: true, showSecondEditor: true }))
    const props = {
      dialect: data.from_warehouse,
      format: 'true',
      query: data.query,
    };
    setData(prev => ({ ...prev, isLoading: true, transpiledQuery: "" }))
    setTimeout(() => {
      transpileQuery(props)
        .then(response => {
          setData(prev => ({ ...prev, transpiledQuery: response, isLoading: false }))

        })
        .catch(error => {
          setError(error?.response?.data?.msg || error?.response?.data);
          setData(prev => ({ ...prev, isLoading: false }))

        });
    }, 500)
  }
  const handleCopy = () => {
    try {
      navigator.clipboard.writeText(data.transpiledQuery).then(() => {
        setIsCopied(true);
        setTimeout(() => {
          setIsCopied(false);
        }, 2000);
      });
    }
    catch (e) {
      console.log(e)
    }
  };

  return (
    <div style={{ display: 'block', marginTop: 50 }} className="codeEditor-container">
      <div className='codemirror-tabs-2'>
        {WAREHOUSE_OPTIONS.map((item, index) => (
          <div
            onClick={() => {
              setTabIndex(index);
              console.log(item.label);
              setData(prev => ({ ...prev, from_warehouse: item.label }))
            }}
            className={`codemirror-tabs-2-tab ${tabIndex == index ? "active" : ""}`}
            key={item.id}>{item.text}</div>
        ))}
      </div>
      <div className='codemirror-wrapper'>
        <BaseCodeMirror
          value={data.query}
          extensions={[sql(config)]}
          width='100%'
          height='200px'
          theme={'dark'}
          className='codemirror-x'
          prefix='test'
          onChange={(val) => setData(prev => ({ ...prev, query: val }))}
        />
        <button

          disabled={data.isLoading}
          style={{
            opacity: data.isLoading ? 0.5 : 1,
            position: "absolute"

          }}
          onClick={() => {
            setData(prev => ({ ...prev, isLoading: !prev.isLoading }))
            handleTranspileFetch()
          }}
          className='codemirror-btn'>
            
          {"Transpile"}
          
        </button>
      </div>
      {data.showSecondEditor && (
        <div style={{ position: 'relative' }}>
          <div className={`codemirror-wrapper-loading ${data.isLoading ? "active" : ""}`}>
            <span class="codemirror-wrapper-loading-loader"></span>
          </div>

          <BaseCodeMirror
            style={{
              marginTop: 15
            }}
            value={`-- DuckDB\n${data.transpiledQuery}`}
            extensions={[sql(config)]}
            width='100%'
            height='300px'
            theme={'dark'}
            className='codemirror-x'
            prefix='test'
            readOnly

          />
          {!isCopied && (
            <div className='codemirror-wrapper-copy' onClick={handleCopy}>
              <CopyIcon fill='white' width={25} height={25} />
            </div>
          )}
          {isCopied && (
            <div className="codemirror-wrapper-copy success">
              <SuccessIcon fill='white' width={20} height={20} />
            </div>
          )}

        </div>
      )}
      {error ? <p
        style={{
          color: "crimson",
          fontSize: "12px",
          margin: 0,
        }}
      >{JSON.stringify(error)}</p> : <></>}
    </div>
  );
}




function SplitSection({ isBackgroundColored, reverse, Img, ImgMobile, alignImg, video, BeforeTitle, title, description, linkText, linkURL, LinkSvg, Component,
  paddingTop,
  sectionHref

}) {
  return (
    <section
      style={paddingTop ? {
        paddingTop
      } : {}}
      className={`${clsx('split_section')} ${isBackgroundColored == 'yes' ? "coloredBckg" : ''}`}
      id={!!sectionHref ? sectionHref : ""}
    >
      <div className="container">
        <div className={`${clsx('row align-items-center')} ${reverse == 'yes' ? styles.reverse : ''}`}>
          <div className={`${alignImg == 'big' ? clsx('col col--4') : clsx('col col--6')}`}>
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
          {Component ?
            Component : (
              <div className={`${alignImg == 'big' ? clsx('col col--8') : clsx('col col--6')}`}>
                <div className={`${styles.split_img} align_${alignImg} ${video ? clsx('is_video') : ''}`}>
                  {Img ? <Img className="img-fluid hide_mobile" role="img" /> : ''}
                  {ImgMobile ? <ImgMobile className="img-fluid hide_desktop" role="img" /> : ""}
                  {video ? <ReactPlayer url={video} /> : ""}
                </div>
              </div>
            )}
        </div>
      </div>
    </section>
  );
}

export default function HomepageFeatures() {
  return (
    <main>
      <section
        className={styles.features}>
        <div className="container">
          <div className="row">
            {FeatureList.map((props, idx) => (
              <Feature key={idx} {...props} />
            ))}
          </div>
          <div >
          </div>
        </div>
      </section>
      {SplitSectionList.map((props, idx) => (
        <SplitSection key={idx} {...props} />
      ))}
    </main>
  );
}