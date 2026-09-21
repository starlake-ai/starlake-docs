import React from "react";
import clsx from "clsx";
import Link from "@docusaurus/Link";
import { useLocation } from "@docusaurus/router";
import { FaGithub, FaDiscord } from "react-icons/fa";
import styles from "./styles.module.css";

// Navbar item (type: "custom-iconLink") for the GitHub and Discord links at
// the top right. Without an explicit href, a GitHub link follows the section
// being browsed, so /qod points at quack-on-demand and everything else at the
// main starlake repository.
const ICONS = { github: FaGithub, discord: FaDiscord };

const SECTION_REPOS = [
  {
    prefix: "/qod",
    name: "Quack on Demand",
    href: "https://github.com/starlake-ai/quack-on-demand",
  },
  {
    prefix: "/starflow",
    name: "Starflow",
    href: "https://github.com/starlake-ai/starlake",
  },
];
const DEFAULT_REPO = {
  name: "Starlake",
  href: "https://github.com/starlake-ai/starlake",
};

function repoFor(pathname) {
  return (
    SECTION_REPOS.find(
      (repo) =>
        pathname === repo.prefix || pathname.startsWith(repo.prefix + "/"),
    ) ?? DEFAULT_REPO
  );
}

export default function NavbarIconLink({
  icon = "github",
  href,
  label,
  mobile,
  className,
}) {
  const { pathname } = useLocation();
  const Icon = ICONS[icon];
  if (!Icon) {
    return null;
  }

  const repo = icon === "github" ? repoFor(pathname) : null;
  const target = href ?? repo?.href;
  const text = label ?? (icon === "github" ? "GitHub" : "Discord");
  const title = repo ? `${repo.name} on GitHub` : text;

  return (
    <Link
      href={target}
      className={clsx(
        mobile ? "menu__link" : "navbar__item navbar__link",
        styles.link,
        className,
      )}
      title={title}
      aria-label={title}
    >
      <Icon className={styles.icon} aria-hidden="true" />
      <span className={clsx(!mobile && styles.label)}>{text}</span>
    </Link>
  );
}
