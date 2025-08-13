// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require("prism-react-renderer").themes.github;
const darkCodeTheme = require("prism-react-renderer").themes.dracula;
const isBlog = process.env.IS_BLOG === 'true';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "Starlake",
  tagline: "Load and Transform your data declaratively",
  favicon: "img/favicon_starlake.ico",

  // Set the production url of your site here
  url: isBlog ? "https://blog.starlake.ai" : "https://docs.starlake.ai",
  baseUrl: "/",

  organizationName: "starlake-ai", // Usually your GitHub org/user name.
  projectName: "starlake", // Usually your repo name.

  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",
  trailingSlash: false,
  // Even if you don't use internalization, you can use this field to set useful
  // metadata like html lang. For example, if your site is Chinese, you may want
  // to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },
  presets: [
    [
      "classic",
      {
        docs: isBlog ? {
          path: 'blog-docs',  // Point to a different directory when in blog mode
          sidebarPath: require.resolve("./sidebars.js"),
          routeBasePath: '/docs',
        } : {
          path: 'docs',  // Regular docs directory
          sidebarPath: require.resolve("./sidebars.js"),
          routeBasePath: '/',
        },
        blog: isBlog ? {
          blogSidebarTitle: 'All posts',
          blogSidebarCount: 'ALL',
          showReadingTime: true,
          routeBasePath: '/',
        } : {
          showReadingTime: true,
          routeBasePath: '/blog',
          exclude: ['**/*'],
        },
        theme: {
          customCss: require.resolve("./src/css/custom.css"),
        },
        gtag: {
          trackingID: "G-FYS72XYD48",
          anonymizeIP: true,
        },
      },
    ],
  ],
  themeConfig: {
    docs: {
      sidebar: {
        autoCollapseCategories: true,
        hideable: false,
      },
    },
    prism: {
      additionalLanguages: ["java", "scala", "sql", "powershell", "python"],
      theme: lightCodeTheme,
    },
    // Replace with your project's social card
    colorMode: {
      defaultMode: "light",
      disableSwitch: true,
      respectPrefersColorScheme: false,
    },
    navbar: {
      title: "Starlake",
      logo: {
        alt: "Starlake",
        src: "img/starlake-logo.png",
        srcDark: "img/starlake-logo.png",
        href: "https://starlake.ai",
      },
      items: [
        isBlog ? {
          href: "https://docs.starlake.ai",
          label: "Documentation",
          position: "left",
        } : {
          type: "docSidebar",
          sidebarId: "starlakeSidebar",
          label: "Documentation",
          position: "left",
          to: "/",
        },
        !isBlog ? {
          href: "https://blog.starlake.ai",
          label: "Blog",
          position: "left",
        } : {
          to: "/",
          label: "Blog",
          position: "left",
        },
        /*
        {
          type: 'docsVersionDropdown',
          position: 'right',
        },
                {
                    href: 'https://search.maven.org/search?q=ai.starlake',
                    position: 'right',
                    className: 'header-download-link header-icon-link',
                    'aria-label': 'Download',
                },
                */
        {
          href: "https://github.com/starlake-ai/starlake",
          position: "right",
          className: "header-github-link header-icon-link",
          "aria-label": "GitHub repository",
        },
        {
          href: "https://join.slack.com/t/starlakeai/shared_invite/zt-28vf5d49s-rnyuh70OrJjcX_2Vz2mafw",
          position: "right",
          className: "header-slack-link header-icon-link",
          "aria-label": "Community",
        },
      ].filter(Boolean),
    },
    //     footer: {
    //       style: "dark",
    //       links: [
    //         {
    //           items: [
    //             {
    //               label: "Documentation",
    //               to: "/docs/intro",
    //             },
    //             {
    //               label: "Blog",
    //               href: "/blog",
    //             },
    //           ],
    //         },

    //         {
    //           items: [
    //             {
    //               html: `
    // <ul class="footer_right"><li><a href="https://github.com/starlake-ai/starlake" target="_blank" rel="noopener noreferrer" class="navbar__item navbar__link header-github-link header-icon-link" aria-label="GitHub repository"></a></li><li><a href="https://join.slack.com/t/starlakeai/shared_invite/zt-28vf5d49s-rnyuh70OrJjcX_2Vz2mafw" target="_blank" rel="noopener noreferrer" class="navbar__item navbar__link header-slack-link header-icon-link" aria-label="Community"></a></li></ul>
    // `,
    //             },
    //           ],
    //         },
    //       ],
    //     },
    zoom: {
      selector: ".markdown :not(em) > img, .split_section .img-fluid",
      config: {
        // options you can specify via https://github.com/francoischalifour/medium-zoom#usage
        background: {
          light: "rgba(2, 0, 19, 0.5)",
          dark: "rgba(2, 0, 19, 0.5)",
        },
      },
    },
    metadata: [
      {name: 'keywords', content: 'starlake, etl, data pipeline, data transformation'},
      {name: 'description', content: 'Official documentation for Starlake data pipeline platform'},
    ],
    structuredData: {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "Starlake Documentation",
      "url": "https://docs.starlake.ai",
      "description": "Official documentation for Starlake - the open source declarative data pipeline platform",
      "publisher": {
        "@type": "Organization",
        "name": "Starlake",
        "logo": {
          "@type": "ImageObject",
          "url": "https://docs.starlake.ai/img/starlake-logo.png"
        }
      },
      "about": {
        "@type": "SoftwareApplication",
        "name": "Starlake",
        "applicationCategory": "Data Loading & Transformation Platform",
        "operatingSystem": "Cross-platform",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD"
        }
      },
      "audience": {
        "@type": "Audience",
        "audienceType": "Data Engineers, Data Scientists, Enterprise IT Teams"
      },
      "mainEntity": {
        "@type": "TechArticle",
        "headline": "Starlake Documentation",
        "description": "Complete documentation for installing, configuring and using Starlake data pipeline platform",
        "articleSection": ["Installation", "Configuration", "Tutorials", "API Reference"],
        "keywords": "ETL, data pipeline, data transformation, data quality, data governance"
      }
    }
  },

  plugins: [
    [
      require.resolve("@easyops-cn/docusaurus-search-local"),
      {
        hashed: true,
        docsRouteBasePath: isBlog ? '/docs/' : '/',
        blogRouteBasePath: isBlog ? '/blog/' : '/',
      },
    ],
    [
      require.resolve("docusaurus-plugin-image-zoom"),
      {
        hashed: true,
      },
    ],
    [
      '@docusaurus/plugin-sitemap',
      {
        id: 'sitemap1',
        changefreq: 'weekly',
        priority: 0.5,
        ignorePatterns: ['/tags/**'],
        filename: 'sitemap.xml',
      },
    ],
    [
      '@docusaurus/plugin-client-redirects',
      {
        redirects: [
          {
            from: '/quick-start/:id',
            to: '/quick-start/:id',
          },
        ],
      },
    ],
  ].filter(Boolean),
  markdown: {
    mermaid: true,
  },
  themes: ["@docusaurus/theme-mermaid"],
};

module.exports = config;
