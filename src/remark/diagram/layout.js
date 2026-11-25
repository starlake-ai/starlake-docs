// Lays out a ```diagram block at build time: parses its YAML, sizes every
// label, runs ELK (layered, orthogonal edges) and returns absolute
// coordinates for <Diagram>, so the page ships an SVG and no layout code.
//
// Format:
//
//   title: What the diagram shows        # read by screen readers
//   direction: down                      # down (default), right, left, up
//   order: keep                          # optional: follow the written order
//   zones:                               # boxes that group nodes, nestable
//     vpc: {label: VPC, detail: 10.42.0.0/16}
//     pub: {label: Public subnets, in: vpc, dashed: true}
//   nodes:
//     ec2: {label: EC2 t3.large, kind: server, accent: true, in: pub,
//           detail: [Ubuntu 22.04, Elastic IP]}
//   edges:
//     - "clients -> ec2: 31338 FlightSQL, TLS"   # leading numbers: the port tag
//     - "op -.-> ec2: 20900 REST and UI"         # dashed
//     - "a <-> b"                                # arrows both ways
//     - "a ~~~ b"                                # invisible: orders a before b
//
// Node kinds pick the glyph: person, client, browser, server, service,
// cluster, database, bucket, file, balancer, gateway, metrics. accent: true
// marks the product's own parts in the section color; dashed: true draws an
// optional or virtual node. An edge may start or end on a zone.
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

// Inter advance widths in em, by character class; mono is fixed width.
function interEm(ch) {
  if (/[ilj.,:;'|!]/.test(ch)) return 0.27;
  if (/[ftrI() \[\]\/-]/.test(ch)) return 0.34;
  if (/[mwMW]/.test(ch)) return 0.86;
  if (/[A-Z]/.test(ch)) return 0.68;
  if (/[0-9]/.test(ch)) return 0.6;
  if (/[a-z]/.test(ch)) return 0.55;
  return 0.6;
}

const textWidth = (text, font) => {
  const str = String(text);
  if (font === MONO) return Math.ceil(str.length * font.size * font.em);
  let em = 0;
  for (const ch of str) em += interEm(ch);
  // the averages in TITLE and ZONE carry the extra width of weight 600
  return Math.ceil(em * font.size * (font.em / 0.53));
};

const NODE_PAD_X = 14;
const NODE_PAD_Y = 11;
const GLYPH = 18; // glyph box, left of the title
const GLYPH_GAP = 9;
const LINE_TITLE = 17;
const LINE_DETAIL = 15;
const NODE_MIN_WIDTH = 132;

const KINDS = new Set([
  'person', 'client', 'server', 'service', 'database', 'bucket', 'balancer',
  'gateway', 'browser', 'cluster', 'metrics', 'file',
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
    const m = edge.match(/^\s*([\w-]+)\s*(<->|-\.->|->|~~~)\s*([\w-]+)\s*(?::\s*(.*))?$/);
    if (!m) fail(`edge ${index + 1} "${edge}" is not "from -> to: label"`);
    spec = {
      from: m[1], to: m[3], label: m[4],
      dashed: m[2] === '-.->', both: m[2] === '<->', hidden: m[2] === '~~~',
    };
  }
  const {from, to} = spec;
  if (!from || !to) fail(`edge ${index + 1} needs a from and a to`);
  let port = spec.port != null ? String(spec.port) : '';
  let text = spec.label != null ? String(spec.label).trim() : '';
  if (!port && text) {
    const m = text.match(/^:?(\d+(?:\s*(?:,|and)\s*:?\d+)*)(?:[\s,]+(.*))?$/);
    if (m) {
      port = m[1].replace(/:/g, '').replace(/\s*,\s*/g, ', ');
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
    hidden: Boolean(spec.hidden),
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
      const isVertical = Math.abs(bx - ax) < Math.abs(by - ay);
      // on a vertical line the tag may also slide sideways, the line then
      // crossing it near one end instead of in the middle
      const slides = isVertical ? [0, width / 2 - 14, -(width / 2 - 14)] : [0];
      for (const slide of slides) {
        for (let t = 0.1; t < 0.95; t += 0.05) {
          const cx = ax + (bx - ax) * t + slide;
          const cy = ay + (by - ay) * t;
          candidates.push({
            x: cx - width / 2, y: cy - height / 2, width, height, length,
            cx: cx - slide, cy, slide: Math.abs(slide),
          });
        }
      }
    }
    const hint = item.hint;
    const distance = (c) =>
      (hint ? Math.hypot(c.cx - hint[0], c.cy - hint[1]) : -c.length) + c.slide * 2;
    candidates.sort((a, b) => distance(a) - distance(b));
    // the free spot closest to the hint, else the spot with the fewest clashes
    const clashes = (c) =>
      nodeBoxes.filter((n) => overlaps(c, n, 4)).length * 3 +
      zoneHeaders.filter((z) => overlaps(c, z, 2)).length * 2 +
      placed.filter((p) => overlaps(c, p, 8)).length * 2;
    let tag = null;
    let best = Infinity;
    // the closest free spot: candidates are sorted by distance
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
  const DIRECTIONS = {down: 'DOWN', right: 'RIGHT', left: 'LEFT', up: 'UP'};
  const keepOrder = String(spec.order || '').toLowerCase() === 'keep';
  if (!DIRECTIONS[direction]) fail(`direction must be down, right, left or up, not ${direction}`);

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
      dashed: Boolean(node.dashed),
      parent,
    });
  }
  if (nodes.size === 0) fail('no nodes');

  const edges = (spec.edges || []).map(parseEdge);
  for (const e of edges) {
    for (const end of [e.from, e.to]) {
      if (!nodes.has(end) && !zones.has(end)) fail(`edge ${e.from} -> ${e.to}: unknown node or zone ${end}`);
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
      'elk.direction': DIRECTIONS[direction],
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
      // order: keep follows the order nodes and edges are written in, where
      // crossings allow, and breaks cycles the same way
      ...(keepOrder
        ? {
            'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
            'elk.layered.cycleBreaking.strategy': 'MODEL_ORDER',
          }
        : {}),
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

  compactZones(zones, nodes, abs, result.edges || [], offsetOf, direction);
  collapseGaps(zones, nodes, abs, result, offsetOf, direction);

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
        id: n.id, label: n.label, detail: n.detail, kind: n.kind, accent: n.accent, dashed: n.dashed,
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
    )
      .filter(({edge}) => !edge.hidden) // ~~~ edges only order the layout
      .map(({edge, points, tag}) => ({
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
  return fitBounds(out);
}

/**
 * ELK leaves an empty band inside a zone that an edge starts or ends on, on
 * the side the edges leave by. Shrink each zone to its content, innermost
 * first, and move the edge ends that sat on the old border.
 */
function compactZones(zones, nodes, abs, elkEdges, offsetOf, direction) {
  const PAD = 18;
  const vertical = direction === 'down' || direction === 'up';
  const byDepth = [...zones.values()].sort((a, b) => abs.get(b.id).depth - abs.get(a.id).depth);
  for (const z of byDepth) {
    const box = abs.get(z.id);
    const kids = [...nodes.values(), ...zones.values()].filter((c) => c.parent === z.id);
    if (kids.length === 0) continue;
    const far = Math.max(...kids.map((c) => {
      const b = abs.get(c.id);
      return vertical ? b.y + b.height : b.x + b.width;
    }));
    const oldEnd = vertical ? box.y + box.height : box.x + box.width;
    const newEnd = far + PAD;
    if (direction === 'up' || direction === 'left' || oldEnd - newEnd < 4) continue;
    if (vertical) box.height = newEnd - box.y;
    else box.width = newEnd - box.x;
    for (const re of elkEdges) {
      const off = offsetOf(re.container);
      for (const sec of re.sections || []) {
        for (const pt of [sec.startPoint, sec.endPoint]) {
          const x = pt.x + off.x;
          const y = pt.y + off.y;
          if (vertical && Math.abs(y - oldEnd) < 1 && x >= box.x - 1 && x <= box.x + box.width + 1) {
            pt.y = newEnd - off.y;
          } else if (!vertical && Math.abs(x - oldEnd) < 1 && y >= box.y - 1 && y <= box.y + box.height + 1) {
            pt.x = newEnd - off.x;
          }
        }
      }
    }
  }
}

/**
 * Shrink the empty bands between rows (or columns, left to right) to at most
 * MAX_GAP, mapping every coordinate along the flow through the same
 * piecewise-linear function so that lines stay straight and orthogonal.
 */
function collapseGaps(zones, nodes, abs, result, offsetOf, direction) {
  const MAX_GAP = 96;
  if (direction === 'up' || direction === 'left') return;
  const v = direction === 'down';
  const start = (b) => (v ? b.y : b.x);
  const size = (b) => (v ? b.height : b.width);
  // occupied spans: nodes, zone headers and zone bottom padding
  const spans = [];
  for (const n of nodes.values()) {
    const b = abs.get(n.id);
    spans.push([start(b), start(b) + size(b)]);
  }
  for (const z of zones.values()) {
    const b = abs.get(z.id);
    spans.push([start(b), start(b) + (v ? 44 : 30)]);
    spans.push([start(b) + size(b) - 18, start(b) + size(b)]);
  }
  spans.sort((a, b) => a[0] - b[0]);
  const cuts = []; // [from, to, removed]
  let end = spans.length ? spans[0][1] : 0;
  for (const [a, b] of spans.slice(1)) {
    if (a - end > MAX_GAP) cuts.push([end, a, a - end - MAX_GAP]);
    end = Math.max(end, b);
  }
  if (cuts.length === 0) return;
  const map = (t) => {
    let shift = 0;
    for (const [a, b, removed] of cuts) {
      if (t >= b) shift += removed;
      else if (t > a) shift += ((t - a) / (b - a)) * removed;
    }
    return t - shift;
  };
  // edge coordinates are relative to their container: make them absolute
  // first, while the containers are still where ELK put them
  for (const re of result.edges || []) {
    const off = offsetOf(re.container);
    for (const sec of re.sections || []) {
      for (const pt of [sec.startPoint, ...(sec.bendPoints || []), sec.endPoint]) {
        pt.x += off.x;
        pt.y += off.y;
      }
    }
    for (const l of re.labels || []) {
      l.x += off.x;
      l.y += off.y;
    }
    re.container = 'root';
  }
  for (const id of [...nodes.keys(), ...zones.keys()]) {
    const b = abs.get(id);
    const s0 = map(start(b));
    const s1 = map(start(b) + size(b));
    if (v) {
      b.y = s0;
      b.height = s1 - s0;
    } else {
      b.x = s0;
      b.width = s1 - s0;
    }
  }
  const k = v ? 'y' : 'x';
  for (const re of result.edges || []) {
    for (const sec of re.sections || []) {
      for (const pt of [sec.startPoint, ...(sec.bendPoints || []), sec.endPoint]) {
        pt[k] = map(pt[k]);
      }
    }
    for (const l of re.labels || []) {
      l[k] = map(l[k]);
    }
  }
  const total = cuts.reduce((sum, c) => sum + c[2], 0);
  if (v) result.height -= total;
  else result.width -= total;
}

/** Grow or shift the drawing so every zone, node, line and tag is inside it. */
function fitBounds(out) {
  let minX = 0;
  let minY = 0;
  let maxX = out.width;
  let maxY = out.height;
  const box = (x, y, w, h) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  };
  for (const z of out.zones) box(z.x, z.y, z.width, z.height);
  for (const n of out.nodes) box(n.x, n.y, n.width, n.height);
  for (const e of out.edges) {
    for (const [x, y] of e.points) box(x, y, 0, 0);
    if (e.label) box(e.label.x, e.label.y, e.label.width, e.label.height);
  }
  const dx = minX < 0 ? 4 - minX : 0;
  const dy = minY < 0 ? 4 - minY : 0;
  if (dx || dy) {
    for (const item of [...out.zones, ...out.nodes]) {
      item.x += dx;
      item.y += dy;
    }
    for (const e of out.edges) {
      e.points = e.points.map(([x, y]) => [x + dx, y + dy]);
      if (e.label) {
        e.label.x += dx;
        e.label.y += dy;
      }
    }
  }
  out.width = Math.ceil(maxX + dx + 4);
  out.height = Math.ceil(maxY + dy + 4);
  return out;
}

module.exports = {layoutDiagram, parseEdge, KINDS};
