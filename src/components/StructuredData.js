import React from 'react';
import Head from '@docusaurus/Head';

export default function StructuredData() {
  const structuredData = {
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
        "url": "https://starlake.ai/starlake-social.png"
      }
    },
    "about": {
      "@type": "SoftwareApplication",
      "name": "Starlake.ai",
      "applicationCategory": "Data Integration Platform",
      "operatingSystem": "Any",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      },
      "description": "Open source declarative data pipeline solution for ETL, data transformation and orchestration",
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.8",
        "ratingCount": "150"
      }
    },
    "audience": {
      "@type": "Audience",
      "audienceType": "Data Engineers, Data Scientists, Data Analytics, Ai Engineers, Enterprise IT Teams"
    },
    "mainEntity": {
      "@type": "TechArticle",
      "headline": "Starlake Documentation",
      "description": "Complete documentation for installing, configuring and using Starlake data pipeline platform",
      "articleSection": ["Installation", "Configuration", "Tutorials", "API Reference"],
      "keywords": "ETL, data pipeline, data transformation, data quality, data governance"
    }
  };

  return (
    <Head>
      <script type="application/ld+json">
        {JSON.stringify(structuredData)}
      </script>
    </Head>
  );
}
