import React from 'react';
import Head from '@docusaurus/Head';
import { useLocation } from '@docusaurus/router';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { useAllDocsData } from '@docusaurus/plugin-content-docs/client';

export default function StructuredData() {
  const location = useLocation();
  const {siteConfig} = useDocusaurusContext();
  const allDocsData = useAllDocsData();
  const currentPath = location.pathname.replace(/^\/|\/$/g, '');

  // Get docs from all versions and find current doc
  const currentDoc = React.useMemo(() => {
    const allDocs = Object.values(allDocsData).reduce((acc, pluginData) => {
      if (pluginData.versions?.[0]?.docs) {
        // Get docs from the latest version
        return {...acc, ...pluginData.versions[0].docs};
      }
      return acc;
    }, {});

    return Object.values(allDocs).find(doc => {
      if (doc.id === 'intro' && currentPath !== '') {
        return false;
      }
      const docPath = doc.path.replace(/^\/|\/$/g, '');
      const docId = doc.id.replace(/^\/|\/$/g, '');

      return currentPath === docPath ||
             currentPath === docId ||
             currentPath.includes(docId) ||
             (doc.slug && currentPath.includes(doc.slug));
    });
  }, [allDocsData, currentPath]);

  // For debugging
  console.log('Current path:', currentPath);
  console.log('Current doc:', currentDoc);

  const mainSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Starlake Documentation",
    "url": "https://docs.starlake.ai",
    "description": siteConfig.tagline,
    "publisher": {
      "@type": "Organization",
      "name": "Starlake",
      "logo": {
        "@type": "ImageObject",
        "url": "https://starlake.ai/starlake-social.png"
      }
    },
    "about": {
      "@type": "SoftwareApplication",
      "name": "Starlake",
      "applicationCategory": "Data Integration Platform",
      "operatingSystem": "Cross-platform",
      "description": "Open source declarative data pipeline platform for ETL and data transformation",
    },
    "audience": {
      "@type": "Audience",
      "audienceType": "Data Engineers, Data Scientists, Data Analytics, AI Engineers, Enterprise IT Teams"
    }
  };

  const docSchema = currentDoc ? {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "headline": currentDoc.title || '',
    "description": currentDoc.description || siteConfig.tagline,
    "keywords": Array.isArray(currentDoc.frontMatter?.keywords)
      ? currentDoc.frontMatter.keywords.join(", ")
      : "ETL, data pipeline, data transformation, data quality",
    "url": `https://docs.starlake.ai${location.pathname}`,
    "dateModified": currentDoc.lastUpdatedAt ? new Date(currentDoc.lastUpdatedAt * 1000).toISOString() : undefined,
    "author": {
      "@type": "Organization",
      "name": "Starlake"
    },
    "articleSection": currentDoc.frontMatter?.sidebar_label || currentDoc.title || '',
    "isPartOf": {
      "@type": "WebSite",
      "url": "https://docs.starlake.ai"
    }
  } : null;

  return (
    <Head>
      <script type="application/ld+json">
        {JSON.stringify(mainSchema)}
      </script>
      {currentDoc && currentDoc.id !== 'intro' && (
        <script type="application/ld+json">
          {JSON.stringify(docSchema)}
        </script>
      )}
    </Head>
  );
}




