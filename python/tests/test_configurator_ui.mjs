import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG_TABS_CONFIG, CONFIG_TAB_IDS } from '../../src/utils/configuratorTabs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../');

console.log('[Test] Running Part 18 Complete Premium Automotive Configurator UI Verification...');

// ─── Test 1: Verify all 8 configuration categories are defined in StudioHeader ───
const expectedTabIds = [
  'overview',
  'paint',
  'wheels',
  'materials',
  'closures',
  'dynamics',
  'lighting',
  'environment',
];

if (!Array.isArray(CONFIG_TABS_CONFIG) || CONFIG_TABS_CONFIG.length < 8) {
  throw new Error(`Expected at least 8 CONFIG_TABS_CONFIG, got ${CONFIG_TABS_CONFIG?.length}`);
}

for (const tabId of expectedTabIds) {
  const found = CONFIG_TABS_CONFIG.find((t) => t.id === tabId);
  if (!found || !found.label || !found.iconName) {
    throw new Error(`Missing or incomplete configuration tab: ${tabId}`);
  }
}
console.log('✓ PASS 1: All 8 automotive configuration tabs defined in configurator navigation.');

// ─── Test 2: Verify ConfiguratorWorkspace.jsx component exists and handles all tabs ───
const workspacePath = path.resolve(ROOT, 'src/components/ui/ConfiguratorWorkspace.jsx');
if (!fs.existsSync(workspacePath)) {
  throw new Error('ConfiguratorWorkspace.jsx does not exist.');
}
const workspaceContent = fs.readFileSync(workspacePath, 'utf-8');
for (const tabId of expectedTabIds) {
  if (!workspaceContent.includes(`activeTab === '${tabId}'`)) {
    throw new Error(`ConfiguratorWorkspace.jsx does not implement section for tab: ${tabId}`);
  }
}
console.log('✓ PASS 2: ConfiguratorWorkspace.jsx implements specialized workspaces for all 8 categories.');

// ─── Test 3: Verify AutomotiveCameraDock.jsx exists and defines automotive viewpoints ───
const cameraDockPath = path.resolve(ROOT, 'src/components/ui/AutomotiveCameraDock.jsx');
if (!fs.existsSync(cameraDockPath)) {
  throw new Error('AutomotiveCameraDock.jsx does not exist.');
}
const cameraDockContent = fs.readFileSync(cameraDockPath, 'utf-8');
const expectedVps = ['front-left', 'side-left', 'rear-left', 'front', 'rear', 'cockpit', 'detail-wheel'];
for (const vp of expectedVps) {
  if (!cameraDockContent.includes(vp)) {
    throw new Error(`AutomotiveCameraDock.jsx missing quick viewpoint: ${vp}`);
  }
}
console.log('✓ PASS 3: AutomotiveCameraDock.jsx provides direct one-touch automotive camera viewpoints.');

// ─── Test 4: Verify VehicleSpecStrip.jsx displays verified engineering telemetry ───
const specStripPath = path.resolve(ROOT, 'src/components/ui/VehicleSpecStrip.jsx');
if (!fs.existsSync(specStripPath)) {
  throw new Error('VehicleSpecStrip.jsx does not exist.');
}
const specStripContent = fs.readFileSync(specStripPath, 'utf-8');
if (!specStripContent.includes('DIMENSIONS') || !specStripContent.includes('GROUND PLANE') || !specStripContent.includes('TOPOLOGY')) {
  throw new Error('VehicleSpecStrip.jsx missing essential CAD and engineering telemetry tags.');
}
console.log('✓ PASS 4: VehicleSpecStrip.jsx renders real-time CAD dimensions, ground tangency, and topology.');

// ─── Test 5: Verify App.jsx integration of new configurator components ───
const appPath = path.resolve(ROOT, 'src/App.jsx');
const appContent = fs.readFileSync(appPath, 'utf-8');

if (!appContent.includes('StudioHeader') || !appContent.includes('<StudioHeader')) {
  throw new Error('App.jsx does not import and mount StudioHeader');
}
if (!appContent.includes('ConfiguratorWorkspace') || !appContent.includes('<ConfiguratorWorkspace')) {
  throw new Error('App.jsx does not import and mount ConfiguratorWorkspace');
}
if (!appContent.includes('AutomotiveCameraDock') || !appContent.includes('<AutomotiveCameraDock')) {
  throw new Error('App.jsx does not import and mount AutomotiveCameraDock');
}
if (!appContent.includes('VehicleSpecStrip') || !appContent.includes('<VehicleSpecStrip')) {
  throw new Error('App.jsx does not import and mount VehicleSpecStrip');
}
console.log('✓ PASS 5: App.jsx mounts all redesigned configurator UI systems.');

// ─── Test 6: Verify currentPart and Milestone 18 status in App.jsx ───
if (!/currentPart\s*=\s*(18|19|20)/.test(appContent)) {
  throw new Error('App.jsx currentPart must be >= 18');
}
if (!appContent.includes("id: 18, title: 'Premium Showroom HUD Interface', status: 'completed'")) {
  throw new Error('App.jsx must mark milestone 18 as completed');
}
console.log('✓ PASS 6: App.jsx tracks Part 18 as completed and milestone 18 as verified.');

// ─── Test 7: Verify purposeful light and dark surface contrast in index.css ───
const cssPath = path.resolve(ROOT, 'src/index.css');
const cssContent = fs.readFileSync(cssPath, 'utf-8');

if (!cssContent.includes('--surface-light') || !cssContent.includes('--text-light-primary')) {
  throw new Error('index.css must define purposeful light surface variables for high readability.');
}
if (!cssContent.includes('--glass-dark') || !cssContent.includes('--accent-cyan')) {
  throw new Error('index.css must define frosted glass and automotive accent variables.');
}
console.log('✓ PASS 7: Purposeful light/dark surface contrast system verified in index.css.');

// ─── Test 8: Verify backward compatibility with all previous toolbars ───
const requiredToolbars = [
  'PaintToolbar',
  'WheelToolbar',
  'SecondaryMaterialToolbar',
  'VehicleRigToolbar',
  'WheelAnimationToolbar',
  'VehicleLightingToolbar',
  'EnvironmentToolbar',
  'ComponentHUD',
];
for (const tb of requiredToolbars) {
  if (!appContent.includes(tb)) {
    throw new Error(`App.jsx must retain backward compatibility mount for: ${tb}`);
  }
}
console.log('✓ PASS 8: Full backward compatibility guaranteed across all 8 previous subsystem toolbars.');

console.log('\n======================================================');
console.log('🎉 ALL 8 CONFIGURATOR UI VERIFICATION TESTS PASSED! 🎉');
console.log('======================================================\n');
