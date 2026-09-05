import fs from 'node:fs';
import path from 'node:path';
import { Linter } from 'eslint';
import js from '@eslint/js';
import globals from 'globals';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';

const root = process.cwd();
const srcDir = path.join(root, 'src');
const manifest = JSON.parse(fs.readFileSync(path.join(srcDir, 'manifest.json'), 'utf8'));
const template = fs.readFileSync(path.join(srcDir, 'index.template.html'), 'utf8');
const css = fs.readFileSync(path.join(srcDir, 'styles', 'style-000.css'), 'utf8');
const scriptFiles = manifest.scriptFiles || [];
const sources = scriptFiles.map(file => ({ file, text: fs.readFileSync(path.join(srcDir, 'scripts', file), 'utf8') }));

function decodeHtml(value) {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

const handlerBodies = [];
for (const match of template.matchAll(/\son[a-z]+\s*=\s*"([\s\S]*?)"/gi)) {
  const body = decodeHtml(match[1]);
  if (body.trim()) handlerBodies.push(body);
}
for (const match of template.matchAll(/\son[a-z]+\s*=\s*'([\s\S]*?)'/gi)) {
  const body = decodeHtml(match[1]);
  if (body.trim()) handlerBodies.push(body);
}

let combined = '';
const lineRanges = [];
let lineCursor = 1;
for (const source of sources) {
  const marker = `\n/*__AUDIT_SOURCE:${source.file}__*/\n`;
  combined += marker;
  lineCursor += marker.split('\n').length - 1;
  const start = lineCursor;
  combined += source.text;
  const lines = source.text.split('\n').length;
  const end = start + lines - 1;
  lineRanges.push({ file: source.file, start, end });
  lineCursor = end;
  combined += '\n';
  lineCursor += 1;
}
combined += '\n/*__AUDIT_HTML_HANDLERS__*/\n';
handlerBodies.forEach((body, index) => {
  combined += `function __auditHtmlHandler${index}(event){${body}\n}\n`;
});

function locate(line) {
  const range = lineRanges.find(item => line >= item.start && line <= item.end);
  if (!range) return { file: 'src/index.template.html', line };
  return { file: `src/scripts/${range.file}`, line: line - range.start + 1 };
}

const linter = new Linter({ configType: 'flat' });
const lintConfig = [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...globals.es2025,
        __auditHtmlHandler0: 'readonly',
        showOpenFilePicker: 'readonly',
        showSaveFilePicker: 'readonly',
        EyeDropper: 'readonly',
        BarcodeDetector: 'readonly',
        CompressionStream: 'readonly',
        DecompressionStream: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { vars: 'all', args: 'after-used', ignoreRestSiblings: true, caughtErrors: 'none', argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-redeclare': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-else-if': 'error',
      'no-func-assign': 'error',
      'no-class-assign': 'error',
      'no-const-assign': 'error',
      'no-import-assign': 'error',
      'no-self-assign': 'error',
      'no-setter-return': 'error',
      'no-unsafe-finally': 'error',
      'no-unexpected-multiline': 'error',
      'no-useless-catch': 'warn',
      'no-constant-binary-expression': 'error',
      'valid-typeof': 'error',
      'getter-return': 'error',
      'constructor-super': 'error',
      'no-this-before-super': 'error',
      'no-new-native-nonconstructor': 'error',
      'no-obj-calls': 'error',
      'no-promise-executor-return': 'warn'
    }
  }
];
const lintMessages = linter.verify(combined, lintConfig, { filename: 'application-bundle.js' });

const lintByRule = new Map();
for (const msg of lintMessages) {
  const key = msg.ruleId || 'parse';
  if (!lintByRule.has(key)) lintByRule.set(key, []);
  const loc = locate(msg.line || 1);
  lintByRule.get(key).push({ ...msg, auditFile: loc.file, auditLine: loc.line });
}

const comments = [];
let ast;
try {
  ast = acorn.parse(combined, {
    ecmaVersion: 'latest',
    sourceType: 'script',
    locations: true,
    onComment: comments,
    allowHashBang: true
  });
} catch (error) {
  console.error('ACORN_PARSE_ERROR', error.message);
  process.exitCode = 2;
}

const functionInfo = [];
const callInfo = [];
const declarationNames = new Map();
if (ast) {
  walk.fullAncestor(ast, (node, _state, ancestors) => {
    if (node.type === 'FunctionDeclaration' && node.id?.name) {
      const info = { name: node.id.name, loc: node.loc.start, returnsValue: 0, returnsEmpty: 0, throws: 0, async: Boolean(node.async), generator: Boolean(node.generator) };
      walk.simple(node.body, {
        ReturnStatement(ret) {
          if (ret.argument) info.returnsValue += 1;
          else info.returnsEmpty += 1;
        },
        ThrowStatement() { info.throws += 1; }
      });
      functionInfo.push(info);
      if (!declarationNames.has(node.id.name)) declarationNames.set(node.id.name, []);
      declarationNames.get(node.id.name).push(node.loc.start);
    }
    if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier') {
      if (!declarationNames.has(node.id.name)) declarationNames.set(node.id.name, []);
      declarationNames.get(node.id.name).push(node.loc.start);
    }
    if (node.type === 'CallExpression') {
      let callee = '';
      if (node.callee.type === 'Identifier') callee = node.callee.name;
      else if (node.callee.type === 'MemberExpression') {
        const prop = node.callee.computed ? '' : node.callee.property?.name || '';
        if (node.callee.object?.type === 'Identifier' && prop) callee = `${node.callee.object.name}.${prop}`;
      }
      if (callee) callInfo.push({ callee, argc: node.arguments.length, loc: node.loc.start });
    }
  });
}

const mixedReturnFunctions = functionInfo.filter(item => item.returnsValue > 0 && item.returnsEmpty > 0);
const duplicateDeclarations = [...declarationNames.entries()].filter(([, locs]) => locs.length > 1);
const callArities = new Map();
for (const call of callInfo) {
  if (!callArities.has(call.callee)) callArities.set(call.callee, new Set());
  callArities.get(call.callee).add(call.argc);
}
const inconsistentCallArities = [...callArities.entries()]
  .filter(([, arities]) => arities.size >= 3)
  .map(([callee, arities]) => ({ callee, arities: [...arities].sort((a, b) => a - b) }));

const staleCommentPattern = /\b(?:TODO|FIXME|HACK|XXX|obsolete|deprecated|legacy|temporary|temp fix|revision|v(?:4|5|6)\.[0-9]+)\b/i;
const staleComments = comments
  .filter(comment => staleCommentPattern.test(comment.value))
  .map(comment => {
    const loc = locate(comment.loc.start.line);
    return { file: loc.file, line: loc.line, text: comment.value.trim().replace(/\s+/g, ' ').slice(0, 220) };
  });

const sourceTextWithoutCss = [template, ...sources.map(item => item.text)].join('\n');
const selectorTokens = new Map();
try {
  const rootCss = postcss.parse(css);
  rootCss.walkRules(rule => {
    try {
      selectorParser(selectors => {
        selectors.walk(node => {
          if (node.type !== 'class' && node.type !== 'id') return;
          const token = String(node.value || '').trim();
          if (!token) return;
          const key = `${node.type}:${token}`;
          if (!selectorTokens.has(key)) selectorTokens.set(key, { type: node.type, token, selectors: new Set() });
          selectorTokens.get(key).selectors.add(rule.selector);
        });
      }).processSync(rule.selector);
    } catch (_) { /* Complex selectors are ignored rather than guessed. */ }
  });
} catch (error) {
  console.error('CSS_PARSE_ERROR', error.message);
}

const orphanSelectorTokens = [...selectorTokens.values()].filter(item => {
  const escaped = item.token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const boundary = new RegExp(`(^|[^A-Za-z0-9_-])${escaped}([^A-Za-z0-9_-]|$)`);
  if (boundary.test(sourceTextWithoutCss)) return false;
  // Hyphenated prefixes are frequently generated dynamically. Keep them for manual review.
  const parts = item.token.split('-');
  if (parts.length > 2 && sourceTextWithoutCss.includes(`${parts.slice(0, -1).join('-')}-`)) return false;
  return true;
});

const docFiles = [
  'README.md', 'CHANGELOG.md', 'DATA-HANDLING.md', 'PRIVACY.md', 'SECURITY.md',
  ...fs.readdirSync(path.join(root, 'docs')).filter(name => name.endsWith('.md')).map(name => `docs/${name}`)
].filter(file => fs.existsSync(path.join(root, file)));
const docFindings = [];
for (const file of docFiles) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/\bV(?:4|5|6)\.[0-9]+\b/i.test(line) && !/changelog|history|migration|compatib|older|legacy/i.test(line)) {
      docFindings.push({ file, line: index + 1, text: line.trim().slice(0, 220) });
    }
    if (/TODO|FIXME|TBD|temporary workflow|integration helper/i.test(line)) {
      docFindings.push({ file, line: index + 1, text: line.trim().slice(0, 220) });
    }
  });
}

const htmlIds = [...template.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)].map(match => match[1]);
const duplicateHtmlIds = [...new Set(htmlIds.filter((id, index) => htmlIds.indexOf(id) !== index))];

function printSection(title, rows, formatter = row => JSON.stringify(row), limit = 250) {
  console.log(`\n===== ${title} (${rows.length}) =====`);
  rows.slice(0, limit).forEach(row => console.log(formatter(row)));
  if (rows.length > limit) console.log(`... ${rows.length - limit} more`);
}

console.log('FULL CODE AUDIT');
console.log(`Scripts: ${sources.length}`);
console.log(`Combined JS bytes: ${Buffer.byteLength(combined)}`);
console.log(`HTML handler bodies counted as references: ${handlerBodies.length}`);
console.log(`CSS bytes: ${Buffer.byteLength(css)}`);

for (const [rule, rows] of [...lintByRule.entries()].sort((a, b) => b[1].length - a[1].length)) {
  printSection(`ESLINT ${rule}`, rows, row => `${row.severity === 2 ? 'ERROR' : 'WARN'} ${row.auditFile}:${row.auditLine}:${row.column || 0} ${row.message}`);
}
printSection('MIXED RETURN FUNCTIONS', mixedReturnFunctions, item => {
  const loc = locate(item.loc.line);
  return `${loc.file}:${loc.line} ${item.name} value=${item.returnsValue} empty=${item.returnsEmpty} throws=${item.throws}`;
});
printSection('DUPLICATE DECLARATION NAMES (scope-agnostic review list)', duplicateDeclarations, ([name, locs]) => `${name}: ${locs.length} declarations`);
printSection('CALLS WITH 3+ DISTINCT ARGUMENT COUNTS (manual contract review)', inconsistentCallArities, item => `${item.callee}: [${item.arities.join(', ')}]`);
printSection('STALE / LEGACY COMMENTS', staleComments, item => `${item.file}:${item.line} ${item.text}`);
printSection('ORPHAN CSS CLASS/ID TOKENS (conservative candidates)', orphanSelectorTokens, item => `${item.type} ${item.token} :: ${[...item.selectors].slice(0, 4).join(' || ')}`);
printSection('DOCUMENTATION STALENESS CANDIDATES', docFindings, item => `${item.file}:${item.line} ${item.text}`);
printSection('DUPLICATE HTML IDS', duplicateHtmlIds, item => item);

const summary = {
  eslintErrors: lintMessages.filter(item => item.severity === 2).length,
  eslintWarnings: lintMessages.filter(item => item.severity === 1).length,
  unused: (lintByRule.get('no-unused-vars') || []).length,
  undefined: (lintByRule.get('no-undef') || []).length,
  unreachable: (lintByRule.get('no-unreachable') || []).length,
  mixedReturns: mixedReturnFunctions.length,
  staleComments: staleComments.length,
  orphanSelectorTokens: orphanSelectorTokens.length,
  docCandidates: docFindings.length,
  duplicateHtmlIds: duplicateHtmlIds.length
};
console.log('\n===== SUMMARY =====');
console.log(JSON.stringify(summary, null, 2));
fs.mkdirSync(path.join(root, '.integration'), { recursive: true });
fs.writeFileSync(path.join(root, '.integration', 'full-code-audit-summary.json'), JSON.stringify(summary, null, 2));
