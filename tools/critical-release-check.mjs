import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const exists = file => fs.existsSync(path.join(root, file));
const pkg = JSON.parse(read('package.json'));
const version = String(pkg.version || '').trim();
const html = read('index.html');
const template = read('src/index.template.html');
const core = read('src/scripts/000-core.js');
const startup = read('src/scripts/012-startup-recovery-v45.js');
const productExperience = read('src/scripts/007-product-experience.js');
const assistantWorkspace = read('src/scripts/041-planner-assistant-workspace-v730.js');
const manifest = JSON.parse(read('src/manifest.json'));

const checks = [];
const requireCheck = (name, ok) => checks.push([name, Boolean(ok)]);

requireCheck('package version is V7.3.x', /^7\.3\.\d+$/.test(version));
requireCheck('production HTML identifies package version', html.includes(`name="app-version" content="${version}"`));
requireCheck('source template identifies package version', template.includes(`name="app-version" content="${version}"`));
requireCheck('core APP_CONFIG identifies package version', core.includes(`version: '${version}'`));
requireCheck('single-file production app has a CSP', html.includes('Content-Security-Policy'));
requireCheck('PWA manifest exists', exists('manifest.webmanifest'));
requireCheck('service worker exists', exists('service-worker.js'));
requireCheck('SVG application icon exists', exists('app-icon.svg'));
requireCheck('192px application icon exists', exists('app-icon-192.png'));
requireCheck('512px application icon exists', exists('app-icon-512.png'));
requireCheck('production HTML links PWA manifest', /rel=["']manifest["']/.test(html));
requireCheck('production HTML registers service worker', /serviceWorker\.register\(/.test(html));

for (const id of [
  'classSelect',
  'settingsBtn',
  'helpGuideBtn',
  'visibilityModeBtn',
  'pageLockBtn',
  'welcomeSecurityModal',
  'welcomeEncryptionKeyInput',
  'welcomeEncryptionKeyConfirmInput',
  'welcomeSecurityStartBtn',
  'mainWorkspace'
]) {
  requireCheck(`critical DOM control #${id} is present`, html.includes(`id="${id}"`));
}

requireCheck('fresh startup mode remains implemented', startup.includes("mode = 'fresh'") && startup.includes("dataset.startupMode = recovery ? 'recovery' : 'fresh'"));
requireCheck('fresh setup requires an encryption password', startup.includes('Create your encryption password') && html.includes('welcome-required-badge'));
requireCheck('existing encrypted-save recovery remains implemented', startup.includes('unlockPendingSave') && startup.includes('Existing browser save found'));
requireCheck('Start Fresh recovery remains implemented', startup.includes('beginFreshStart') && html.includes('welcomeStartFreshBtn'));

for (const workflow of ['setup', 'room', 'seating', 'review', 'share']) {
  requireCheck(`workflow ${workflow} remains registered`, productExperience.includes(`${workflow}:`));
}
requireCheck('primary V7 workflow navigation builder remains present', productExperience.includes('v4WorkflowNav') && productExperience.includes('buildWorkflowNavigation'));
requireCheck('Presentation Mode remains reachable from product experience', productExperience.includes('visibilityModeBtn'));
requireCheck('V7.3 Planner Assistant workspace remains present', assistantWorkspace.includes('PlannerAssistantWorkspaceV730'));
requireCheck('V7.3 Assistant working-plan surface remains present', assistantWorkspace.includes('working plan') || assistantWorkspace.includes('Working plan'));

requireCheck('manifest declares 42 V7.3 JavaScript modules', Array.isArray(manifest.scriptFiles) && manifest.scriptFiles.length === 42);
requireCheck('manifest ends with V7.3 Assistant workspace module', manifest.scriptFiles?.at(-1) === '041-planner-assistant-workspace-v730.js');

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (failed.length) {
  throw new Error(`Critical V7.3 release contract failed: ${failed.map(([name]) => name).join('; ')}`);
}
console.log(`Critical V7.3 release contract passed (${checks.length} checks).`);
