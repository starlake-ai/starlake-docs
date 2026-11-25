import React, {useId} from 'react';
import styles from './styles.module.css';

// Renders a diagram laid out at build time by src/remark/diagram. Colors come
// from the site tokens through CSS, so light and dark mode both apply.

const GLYPHS = {
  person: (
    <>
      <circle cx="9" cy="5.5" r="3" />
      <path d="M3 16c0-3.6 2.7-6 6-6s6 2.4 6 6" />
    </>
  ),
  client: (
    <>
      <rect x="1.5" y="2.5" width="15" height="12" rx="2" />
      <path d="M5 7l2.5 2L5 11M9.5 11.5H13" />
    </>
  ),
  browser: (
    <>
      <rect x="1.5" y="2.5" width="15" height="13" rx="2" />
      <path d="M1.5 6.5h15" />
    </>
  ),
  server: (
    <>
      <rect x="2" y="2.5" width="14" height="5.5" rx="1.5" />
      <rect x="2" y="10" width="14" height="5.5" rx="1.5" />
      <path d="M5 5.25h.01M5 12.75h.01" />
    </>
  ),
  service: (
    <>
      <rect x="2.5" y="2.5" width="13" height="13" rx="2.5" />
      <path d="M6 7h6M6 11h4" />
    </>
  ),
  cluster: (
    <>
      <rect x="2" y="2" width="6" height="6" rx="1.5" />
      <rect x="10" y="2" width="6" height="6" rx="1.5" />
      <rect x="6" y="10" width="6" height="6" rx="1.5" />
    </>
  ),
  database: (
    <>
      <ellipse cx="9" cy="4" rx="6" ry="2.25" />
      <path d="M3 4v10c0 1.25 2.7 2.25 6 2.25s6-1 6-2.25V4" />
      <path d="M3 9c0 1.25 2.7 2.25 6 2.25S15 10.25 15 9" />
    </>
  ),
  bucket: (
    <>
      <ellipse cx="9" cy="4.5" rx="6.5" ry="2" />
      <path d="M2.5 4.5l1.6 9.6c.2 1.2 2.3 2.1 4.9 2.1s4.7-.9 4.9-2.1l1.6-9.6" />
    </>
  ),
  balancer: (
    <>
      <circle cx="9" cy="4" r="2.25" />
      <path d="M9 6.25V9M9 9L3.5 14M9 9v5M9 9l5.5 5" />
    </>
  ),
  gateway: (
    <>
      <path d="M3 16V7.5a6 6 0 0112 0V16" />
      <path d="M9 7v6.5M6.5 11L9 13.5l2.5-2.5" />
    </>
  ),
  file: (
    <>
      <path d="M4 1.75h6.5L14 5.25V16.25H4z" />
      <path d="M10.5 1.75v3.5H14M6.5 9.5h5M6.5 12.5h5" />
    </>
  ),
  metrics: (
    <>
      <path d="M2.5 15.5h13" />
      <path d="M5 12.5V9M9 12.5V4.5M13 12.5V7" />
    </>
  ),
};

/** A polyline with rounded bends, as an SVG path. */
function roundedPath(points, radius = 7) {
  if (points.length === 0) return '';
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i - 1];
    const [x, y] = points[i];
    const [nx, ny] = points[i + 1];
    const inLength = Math.hypot(x - px, y - py);
    const outLength = Math.hypot(nx - x, ny - y);
    const r = Math.min(radius, inLength / 2, outLength / 2);
    if (r < 0.5) {
      d += ` L${x},${y}`;
      continue;
    }
    const ax = x - ((x - px) / inLength) * r;
    const ay = y - ((y - py) / inLength) * r;
    const bx = x + ((nx - x) / outLength) * r;
    const by = y + ((ny - y) / outLength) * r;
    d += ` L${ax},${ay} Q${x},${y} ${bx},${by}`;
  }
  const last = points[points.length - 1];
  return `${d} L${last[0]},${last[1]}`;
}

function Zone({zone}) {
  return (
    <rect
      className={zone.dashed ? `${styles.zone} ${styles.zoneDashed}` : styles.zone}
      data-depth={zone.depth % 2}
      x={zone.x}
      y={zone.y}
      width={zone.width}
      height={zone.height}
      rx="10"
    />
  );
}

/** A zone title, drawn over the edges on the zone's own fill. */
function ZoneHeader({zone}) {
  return (
    <g className={styles.zoneHeader} data-depth={zone.depth % 2}>
      <rect x={zone.x + 10} y={zone.y + 10} width={zone.headerWidth} height="22" rx="4" />
      <text x={zone.x + 16} y={zone.y + 25}>
        <tspan className={styles.zoneLabel}>{zone.label}</tspan>
        {zone.detail && (
          <tspan className={styles.zoneDetail} dx="8">
            {zone.detail}
          </tspan>
        )}
      </text>
    </g>
  );
}

function Node({node}) {
  const padX = 14;
  const padY = 11;
  return (
    <g
      className={[styles.node, node.accent && styles.accent, node.dashed && styles.dashedNode]
        .filter(Boolean)
        .join(' ')}>
      <rect x={node.x} y={node.y} width={node.width} height={node.height} rx="8" />
      <g className={styles.glyph} transform={`translate(${node.x + padX} ${node.y + padY - 1})`}>
        {GLYPHS[node.kind] || GLYPHS.service}
      </g>
      <text className={styles.nodeLabel} x={node.x + padX + 27} y={node.y + padY + 12.5}>
        {node.label}
      </text>
      {node.detail.map((line, i) => (
        <text
          key={i}
          className={styles.nodeDetail}
          x={node.x + padX}
          y={node.y + padY + 17 + 11.5 + i * 15}>
          {line}
        </text>
      ))}
    </g>
  );
}

function Edge({edge, markerId}) {
  return (
    <path
      className={edge.dashed ? `${styles.edge} ${styles.edgeDashed}` : styles.edge}
      d={roundedPath(edge.points)}
      markerEnd={`url(#${markerId})`}
      markerStart={edge.both ? `url(#${markerId}-start)` : undefined}
    />
  );
}

function Tag({label}) {
  const {x, y, width, height, port, text} = label;
  return (
    <g className={styles.tag}>
      <rect x={x} y={y} width={width} height={height} rx={height / 2} />
      <text x={x + 8} y={y + height / 2 + 4}>
        {port && <tspan className={styles.tagPort}>{port}</tspan>}
        {text && (
          <tspan className={styles.tagText} dx={port ? 6 : 0}>
            {text}
          </tspan>
        )}
      </text>
    </g>
  );
}

export default function Diagram({layout}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const data = typeof layout === 'string' ? JSON.parse(layout) : layout;
  if (!data) return null;
  const {width, height, zones, nodes, edges, title, caption} = data;
  const markerId = `dg-arrow-${id}`;
  const titleId = `dg-title-${id}`;
  return (
    <figure className={styles.root}>
      <div className={styles.scroll}>
        <svg
          className={styles.svg}
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          // never shrunk below 80%, so the text stays legible: wider ones scroll
          style={{maxWidth: `${width}px`, minWidth: `${Math.round(Math.max(Math.min(width, 520), width * 0.8))}px`}}
          role="img"
          aria-labelledby={title ? titleId : undefined}>
          {title && <title id={titleId}>{title}</title>}
          <defs>
            <marker
              id={markerId}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto">
              <path className={styles.arrow} d="M1 1.5L9 5L1 8.5z" />
            </marker>
            <marker
              id={`${markerId}-start`}
              viewBox="0 0 10 10"
              refX="1"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto">
              <path className={styles.arrow} d="M9 1.5L1 5L9 8.5z" />
            </marker>
          </defs>
          {zones.map((z) => (
            <Zone key={z.id} zone={z} />
          ))}
          {edges.map((e) => (
            <Edge key={e.id} edge={e} markerId={markerId} />
          ))}
          {zones.map((z) => (
            <ZoneHeader key={z.id} zone={z} />
          ))}
          {nodes.map((n) => (
            <Node key={n.id} node={n} />
          ))}
          {edges.map((e) => e.label && <Tag key={e.id} label={e.label} />)}
        </svg>
      </div>
      {caption && <figcaption className={styles.caption}>{caption}</figcaption>}
    </figure>
  );
}
