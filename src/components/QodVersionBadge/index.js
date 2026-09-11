import React from "react";
import Link from "@docusaurus/Link";
import { useLocation } from "@docusaurus/router";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import styles from "./styles.module.css";

// Navbar item (type: "custom-qodVersion") showing the QoD release version,
// only while browsing /qod pages. Renders nothing when the version is
// unknown so a missing openapi.yaml never breaks the navbar.
export default function QodVersionBadge() {
  const { pathname } = useLocation();
  const { siteConfig } = useDocusaurusContext();
  const version = siteConfig.customFields?.qodVersion;
  if (!version || !pathname.startsWith("/qod")) {
    return null;
  }
  return (
    <Link
      to="pathname:///api/"
      className={styles.badge}
      title="Quack on Demand REST API reference"
    >
      v{version}
    </Link>
  );
}
