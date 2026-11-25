// Lays out a ```diagram block at build time: parses its YAML, sizes every
// label, runs ELK (layered, orthogonal edges) and returns absolute
// coordinates for <Diagram>, so the page ships an SVG and no layout code.
const yaml = require('js-yaml');
const ELK = require('elkjs/lib/elk.bundled.js');

const elk = new ELK();

// Text metrics, approximated per character: there is no DOM at build time.
// Inter averages ~0.56em per character at weight 600, ~0.52em at 400;
// JetBrains Mono is exactly 0.6em.
const TITLE = {size: 13, em: 0.57};
const DETAIL = {size: 11.5, em: 0.53};
const MONO = {size: 11, em: 0.6};
const ZONE = {size: 12, em: 0.57};

const textWidth = (text, font) => Math.ceil(String(text).length * font.size * font.em);

const NODE_PAD_X = 14;
const NODE_PAD_Y = 11;
const GLYPH = 18; // glyph box, left of the title
const GLYPH_GAP = 9;
const LINE_TITLE = 17;
const LINE_DETAIL = 15;
const NODE_MIN_WIDTH = 132;

const KINDS = new Set([
  'person', 'client', 'server', 'service', 'database', 'bucket', 'balancer',
  'gateway', 'browser', 'cluster', 'metrics',
]);

function fail(message) {
  throw new Error(`diagram: ${message}`);
}

const asList = (value) => (value == null ? [] : Array.isArray(value) ? value.map(String) : [String(value)]);

/**
 * "a -> b", "a -.-> b" (dashed), "a <-> b" (both ways), with an optional
 * ": 22, 9494 SSH" label: a leading list of port numbers becomes the tag.
 */
function parseEdge(edge, index) {
  let spec = edge;
  if (typeof edge === 'string') {
    const m = edge.match(/^\s*([\w-]+)\s*(<->|-\.->|->)\s*([\w-]+)\s*(?::\s*(.*))?$/);
    if (!m) fail(`edge ${index + 1} "${edge}" is not "from -> to: label"`);
    spec = {from: m[1], to: m[3], label: m[4], dashed: m[2] === '-.->', both: m[2] === '<->'};
  }
  const {from, to} = spec;
  if (!from || !to) fail(`edge ${index + 1} needs a from and a to`);
  let port = spec.port != null ? String(spec.port) : '';
  let text = spec.label != null ? String(spec.label).trim() : '';
  if (!port && text) {
    const m = text.match(/^(\d+(?:\s*(?:,|and)\s*\d+)*)(?:[\s,]+(.*))?$/);
    if (m) {
      port = m[1].replace(/\s*,\s*/g, ', ');
      text = (m[2] || '').trim();
    }
  }
  return {
    id: `e${index}`,
    from: String(from),
    to: String(to),
    port,
    text,
    dashed: Boolean(spec.dashed),
    both: Boolean(spec.both),
  };
}

function edgeLabelSize(edge) {
  if (!edge.port && !edge.text) return null;
  const port = edge.port ? textWidth(edge.port, MONO) : 0;
  const text = edge.text ? textWidth(edge.text, DETAIL) : 0;
  const gap = edge.port && edge.text ? 6 : 0;
  return {width: port + gap + text + 16, height: 20};
}

function nodeSize(node) {
  const titleWidth = GLYPH + GLYPH_GAP + textWidth(node.label, TITLE);
  const detailWidth = Math.max(0, ...node.detail.map((line) => textWidth(line, DETAIL)));
  const width = Math.max(NODE_MIN_WIDTH, titleWidth, detailWidth) + 2 * NODE_PAD_X;
  const height = 2 * NODE_PAD_Y + LINE_TITLE + node.detail.length * LINE_DETAIL;
  return {width, height};
}

function zoneHeader(zone) {
  return textWidth(zone.label, ZONE) + (zone.detail ? 8 + textWidth(zone.detail, MONO) : 0) + 28;
}

const overlaps = (a, b, margin) =>
  a.x < b.x + b.width + margin && b.x < a.x + a.width + margin &&
  a.y < b.y + b.height + margin && b.y < a.y + a.height + margin;

/**
 * Put each edge tag on a straight stretch of its own edge, clear of the
 * nodes, the zone titles and the tags already placed. Among the free spots,
 * the one closest to where ELK reserved room for the label wins.
 */
function placeTags(edges, nodeBoxes, zoneHeaders) {
  const placed = [];
  for (const item of edges) {
    if (!item.size) continue;
    const {width, height} = item.size;
    const candidates = [];
    for (let i = 1; i < item.points.length; i++) {
      const [ax, ay] = item.points[i - 1];
      const [bx, by] = item.points[i];
      const length = Math.hypot(bx - ax, by - ay);
      const along = Math.abs(bx - ax) < Math.abs(by - ay) ? height : width;
      if (length < along + 8) continue;
      for (let t = 0.1; t < 0.95; t += 0.05) {
        const cx = ax + (bx - ax) * t;
        const cy = ay + (by - ay) * t;
        candidates.push({x: cx - width / 2, y: cy - height / 2, width, height, length, cx, cy});
      }
    }
    const hint = item.hint;
    const distance = (c) => (hint ? Math.hypot(c.cx - hint[0], c.cy - hint[1]) : -c.length);
    candidates.sort((a, b) => distance(a) - distance(b));
    // the free spot closest to the hint, else the spot with the fewest clashes
    const clashes = (c) =>
      nodeBoxes.filter((n) => overlaps(c, n, 4)).length * 3 +
      zoneHeaders.filter((z) => overlaps(c, z, 2)).length * 2 +
      placed.filter((p) => overlaps(c, p, 8)).length * 2;
    let tag = null;
    let best = Infinity;
    for (const c of candidates) {
      const score = clashes(c);
      if (score < best) {
        best = score;
        tag = c;
        if (score === 0) break;
      }
    }
    if (tag) placed.push(tag);
    item.tag = tag;
  }
  return edges;
}

/** The point of a polyline closest to (x, y). */
function snapToPolyline(points, x, y) {
  let best = [x, y];
  let bestDistance = Infinity;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    const dx = bx - ax;
    const dy = by - ay;
    const length = dx * dx + dy * dy;
    const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / length));
    const px = ax + t * dx;
    const py = ay + t * dy;
    const distance = (px - x) ** 2 + (py - y) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = [px, py];
    }
  }
  return best;
}

async function layoutDiagram(source) {
  let spec;
  try {
    spec = yaml.load(source) || {};
  } catch (e) {
    fail(`invalid YAML: ${e.message}`);
  }

  const direction = String(spec.direction || 'down').toLowerCase();
  if (!['down', 'right'].includes(direction)) fail(`direction must be down or right, not ${direction}`);

  const zones = new Map();
  for (const [id, z] of Object.entries(spec.zones || {})) {
    zones.set(id, {
      id,
      label: String(z.label ?? id),
      detail: z.detail != null ? String(z.detail) : '',
      parent: z.in != null ? String(z.in) : null,
      dashed: Boolean(z.dashed),
    });
  }
  for (const z of zones.values()) {
    if (z.parent && !zones.has(z.parent)) fail(`zone ${z.id} is in unknown zone ${z.parent}`);
  }

  const nodes = new Map();
  for (const [id, n] of Object.entries(spec.nodes || {})) {
    const node = typeof n === 'string' ? {label: n} : n || {};
    const kind = String(node.kind || 'service');
    if (!KINDS.has(kind)) fail(`node ${id} has unknown kind ${kind} (${[...KINDS].join(', ')})`);
    if (zones.has(id)) fail(`${id} is both a node and a zone`);
    const parent = node.in != null ? String(node.in) : null;
    if (parent && !zones.has(parent)) fail(`node ${id} is in unknown zone ${parent}`);
    nodes.set(id, {
      id,
      label: String(node.label ?? id),
      detail: asList(node.detail),
      kind,
      accent: Boolean(node.accent),
      parent,
    });
  }
  if (nodes.size === 0) fail('no nodes');

  const edges = (spec.edges || []).map(parseEdge);
  for (const e of edges) {
    for (const end of [e.from, e.to]) {
      if (!nodes.has(end)) fail(`edge ${e.from} -> ${e.to}: unknown node ${end}`);
    }
  }

  // ELK graph: zones are compound nodes, edges all live at the root so that
  // INCLUDE_CHILDREN routes them across zone borders.
  const elkNodes = new Map();
  const childrenOf = (parent) => [
    ...[...zones.values()].filter((z) => z.parent === parent).map((z) => elkNodes.get(z.id)),
    ...[...nodes.values()].filter((n) => n.parent === parent).map((n) => elkNodes.get(n.id)),
  ];
  for (const n of nodes.values()) {
    elkNodes.set(n.id, {id: n.id, ...nodeSize(n)});
  }
  for (const z of zones.values()) {
    elkNodes.set(z.id, {
      id: z.id,
      layoutOptions: {
        'elk.padding': '[top=44,left=18,bottom=18,right=18]',
        'elk.nodeSize.constraints': 'MINIMUM_SIZE',
        'elk.nodeSize.minimum': `(${zoneHeader(z)}, 60)`,
      },
    });
  }
  for (const z of zones.values()) {
    elkNodes.get(z.id).children = childrenOf(z.id);
  }

  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction === 'right' ? 'RIGHT' : 'DOWN',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.spacing.nodeNodeBetweenLayers': '52',
      'elk.layered.spacing.edgeNodeBetweenLayers': '22',
      'elk.layered.spacing.edgeEdgeBetweenLayers': '14',
      'elk.spacing.nodeNode': '36',
      'elk.spacing.edgeNode': '22',
      'elk.spacing.edgeEdge': '14',
      'elk.spacing.edgeLabel': '4',
      'elk.edgeLabels.inline': 'true',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.crossingMinimization.semiInteractive': 'true',
      'elk.padding': '[top=4,left=4,bottom=4,right=4]',
    },
    children: childrenOf(null),
    edges: edges.map((e) => {
      const size = edgeLabelSize(e);
      return {
        id: e.id,
        sources: [e.from],
        targets: [e.to],
        labels: size ? [{id: `${e.id}-label`, text: e.port || e.text, ...size}] : [],
      };
    }),
  };

  const result = await elk.layout(graph);

  // Absolute positions: ELK gives node positions relative to their parent.
  const abs = new Map();
  const walk = (n, ox, oy, depth) => {
    const x = ox + (n.x || 0);
    const y = oy + (n.y || 0);
    abs.set(n.id, {x, y, width: n.width, height: n.height, depth});
    for (const c of n.children || []) walk(c, x, y, depth + 1);
  };
  for (const c of result.children || []) walk(c, 0, 0, 0);

  // Edge coordinates are relative to the edge's container, the root here,
  // unless ELK reports another container.
  const offsetOf = (container) => {
    if (!container || container === 'root') return {x: 0, y: 0};
    const a = abs.get(container);
    return a ? {x: a.x, y: a.y} : {x: 0, y: 0};
  };

  const round = (v) => Math.round(v * 10) / 10;
  const out = {
    title: spec.title != null ? String(spec.title) : '',
    caption: spec.caption != null ? String(spec.caption) : '',
    width: Math.ceil(result.width),
    height: Math.ceil(result.height),
    zones: [...zones.values()]
      .map((z) => ({...z, ...abs.get(z.id)}))
      .sort((a, b) => a.depth - b.depth)
      .map((z) => ({
        id: z.id, label: z.label, detail: z.detail, dashed: z.dashed, depth: z.depth,
        headerWidth: zoneHeader(z) - 20,
        x: round(z.x), y: round(z.y), width: round(z.width), height: round(z.height),
      })),
    nodes: [...nodes.values()].map((n) => {
      const a = abs.get(n.id);
      return {
        id: n.id, label: n.label, detail: n.detail, kind: n.kind, accent: n.accent,
        x: round(a.x), y: round(a.y), width: round(a.width), height: round(a.height),
      };
    }),
    edges: placeTags(
      (result.edges || []).map((re) => {
        const e = edges.find((x) => x.id === re.id);
        const off = offsetOf(re.container);
        const points = [];
        for (const s of re.sections || []) {
          points.push([s.startPoint.x + off.x, s.startPoint.y + off.y]);
          for (const b of s.bendPoints || []) points.push([b.x + off.x, b.y + off.y]);
          points.push([s.endPoint.x + off.x, s.endPoint.y + off.y]);
        }
        const label = (re.labels || [])[0];
        return {
          edge: e,
          points,
          size: label ? {width: label.width, height: label.height} : null,
          hint: label
            ? [label.x + off.x + label.width / 2, label.y + off.y + label.height / 2]
            : null,
        };
      }),
      [...nodes.values()].map((n) => abs.get(n.id)),
      [...zones.values()].map((z) => {
        const a = abs.get(z.id);
        return {x: a.x, y: a.y, width: zoneHeader(z), height: 40};
      }),
    ).map(({edge, points, tag}) => ({
      id: edge.id,
      dashed: edge.dashed,
      both: edge.both,
      points: points.map(([x, y]) => [round(x), round(y)]),
      label: tag
        ? {
            port: edge.port, text: edge.text,
            x: round(tag.x), y: round(tag.y), width: tag.width, height: tag.height,
          }
        : null,
    })),
  };
  return out;
}

module.exports = {layoutDiagram, parseEdge, KINDS};
