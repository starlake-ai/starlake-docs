// Sends page views for /qod and /starflow to their own GA4 properties.
// The site-wide tag configured in docusaurus.config.js (preset gtag) keeps
// tracking every page; this module only adds the per-section properties.
import ExecutionEnvironment from '@docusaurus/ExecutionEnvironment';
import siteConfig from '@generated/docusaurus.config';

const { qodGaId, starflowGaId } = siteConfig.customFields;

const SECTIONS = [
  { prefix: '/qod', id: qodGaId },
  { prefix: '/starflow', id: starflowGaId },
].filter((s) => s.id);

const configured = new Set();
let scriptLoaded = false;

function sectionFor(pathname) {
  return SECTIONS.find(
    (s) => pathname === s.prefix || pathname.startsWith(s.prefix + '/'),
  );
}

function ensureGtag(id) {
  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function () {
      window.dataLayer.push(arguments);
    };
  // One gtag.js script serves any number of measurement IDs; the preset gtag
  // plugin normally loads it already, so only inject when it is missing.
  if (
    !scriptLoaded &&
    !document.querySelector('script[src*="googletagmanager.com/gtag/js"]')
  ) {
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
    document.head.appendChild(s);
    window.gtag('js', new Date());
  }
  scriptLoaded = true;
  if (!configured.has(id)) {
    window.gtag('config', id, { send_page_view: false, anonymize_ip: true });
    configured.add(id);
  }
}

export function onRouteDidUpdate({ location, previousLocation }) {
  if (!ExecutionEnvironment.canUseDOM || process.env.NODE_ENV !== 'production') {
    return;
  }
  // Ignore hash-only changes (heading anchors).
  if (previousLocation && location.pathname === previousLocation.pathname) {
    return;
  }
  const section = sectionFor(location.pathname);
  if (!section) return;

  ensureGtag(section.id);
  window.gtag('event', 'page_view', {
    send_to: section.id,
    page_title: document.title,
    page_location: window.location.href,
    page_path: location.pathname + location.search,
  });
}
