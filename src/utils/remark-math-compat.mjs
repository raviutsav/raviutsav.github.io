/**
 * Remark plugin to support bracket math delimiters \[ ... \]
 * In Markdown/CommonMark, \[ and \] are treated as escaped brackets,
 * leaving [ ... ] in paragraph text nodes.
 * This plugin converts those into KaTeX math AST nodes.
 */
export function remarkMathCompat() {
  return (tree) => {
    if (!tree || !Array.isArray(tree.children)) return;

    for (let i = 0; i < tree.children.length; i++) {
      const node = tree.children[i];
      if (
        node.type === 'paragraph' &&
        Array.isArray(node.children) &&
        node.children.length === 1 &&
        node.children[0].type === 'text'
      ) {
        const text = node.children[0].value.trim();
        if (text.startsWith('[') && text.endsWith(']') && text.includes('\\')) {
          const mathContent = text.slice(1, -1).trim();
          tree.children[i] = {
            type: 'math',
            value: mathContent,
            data: {
              hName: 'div',
              hProperties: { className: ['math', 'math-display'] },
            },
          };
        }
      }
    }
  };
}
