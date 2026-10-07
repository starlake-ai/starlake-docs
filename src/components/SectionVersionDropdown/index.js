import React from "react";
import { useActivePlugin } from "@docusaurus/plugin-content-docs/client";
import DocsVersionDropdownNavbarItem from "@theme/NavbarItem/DocsVersionDropdownNavbarItem";

// Navbar item (type: "custom-sectionVersionDropdown") wrapping the stock docs
// version dropdown. QoD and Starflow are separate docs instances with their
// own release numbers, so each dropdown only renders while browsing pages of
// its own instance (docsPluginId) instead of on every page of the site.
// The stock item gets dropdownItemsBefore/After defaults from the navbar
// schema, which does not apply them to custom types, hence the defaults here.
export default function SectionVersionDropdown({
  docsPluginId,
  dropdownItemsBefore = [],
  dropdownItemsAfter = [],
  ...props
}) {
  const activePlugin = useActivePlugin({ failfast: false });
  if (activePlugin?.pluginId !== docsPluginId) {
    return null;
  }
  return (
    <DocsVersionDropdownNavbarItem
      docsPluginId={docsPluginId}
      dropdownItemsBefore={dropdownItemsBefore}
      dropdownItemsAfter={dropdownItemsAfter}
      {...props}
    />
  );
}
