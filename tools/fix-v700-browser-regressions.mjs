import fs from 'node:fs';

function replaceOnce(file, from, to) {
  let source = fs.readFileSync(file, 'utf8');
  if (source.includes(to)) return;
  if (!source.includes(from)) throw new Error(`${file}: expected fragment not found`);
  source = source.replace(from, to);
  fs.writeFileSync(file, source);
}

replaceOnce(
  'src/scripts/032-digital-twin-v700.js',
  `    observer = new MutationObserver(scheduleEnhance);\n    observer.observe(canvas, { childList:true, subtree:true, attributes:true, attributeFilter:['class','style'] });`,
  `    observer = new MutationObserver(mutations => {\n      const isOwnOverlayNode = node => node instanceof Element && (\n        node.matches?.('.v700-room-grid,.v700-floor-plan,.v700-rulers,.v700-measurement-layer,.v700-object-measure') ||\n        node.closest?.('.v700-room-grid,.v700-floor-plan,.v700-rulers,.v700-measurement-layer,.v700-object-measure')\n      );\n      const relevant = mutations.some(mutation => {\n        if (isOwnOverlayNode(mutation.target)) return false;\n        if (mutation.type === 'childList') {\n          const changed = [...mutation.addedNodes, ...mutation.removedNodes].filter(node => node.nodeType === Node.ELEMENT_NODE);\n          if (changed.length && changed.every(isOwnOverlayNode)) return false;\n        }\n        return true;\n      });\n      if (relevant) scheduleEnhance();\n    });\n    observer.observe(canvas, { childList:true, subtree:true, attributes:true, attributeFilter:['class','style'] });`
);

replaceOnce(
  'tests/browser/interoperability-v69.spec.mjs',
  `  await expect(page.locator('meta[name="app-version"]')).toHaveAttribute('content', '6.9.0');`,
  `  await expect(page.locator('meta[name="app-version"]')).toHaveAttribute('content', /^\\d+\\.\\d+\\.\\d+$/);`
);

console.log('Fixed V7.0.0 overlay observer feedback and made the V6.9 feature regression version-agnostic.');
