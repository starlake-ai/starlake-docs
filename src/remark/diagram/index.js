// Remark plugin: turns ```diagram code blocks into a <diagram> element
// carrying the laid-out drawing, rendered by src/components/Diagram.
// Works in .md and .mdx pages, like the Mermaid plugin it replaces.
const {layoutDiagram} = require('./layout');

function remarkDiagram() {
  return async (root, file) => {
    const {visit} = await import('unist-util-visit');
    const blocks = [];
    visit(root, 'code', (node) => {
      if (node.lang === 'diagram') blocks.push(node);
    });
    for (const node of blocks) {
      let layout;
      try {
        layout = await layoutDiagram(node.value);
      } catch (e) {
        const where = node.position ? `:${node.position.start.line}` : '';
        throw new Error(`${file.path || 'page'}${where}: ${e.message}`);
      }
      // replace the code node in place, as the Mermaid plugin does: a node
      // with a leftover value would turn into text
      const position = node.position;
      for (const key of Object.keys(node)) delete node[key];
      Object.assign(node, {
        type: 'diagramBlock',
        position,
        data: {hName: 'diagram', hProperties: {layout: JSON.stringify(layout)}},
      });
    }
  };
}

module.exports = remarkDiagram;
