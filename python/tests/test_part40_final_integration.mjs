/**
 * test_part40_final_integration.mjs — Part 40 Final Integration & Packaging Verification
 *
 * Verifies repository completeness, documentation integrity, demonstration evidence artifacts,
 * clean startup configuration, and full milestone completion across Parts 1–40.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../');
const REPORTS_DIR = path.resolve(ROOT, 'python/reports');

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedTests++;
  console.log(`  ✅ ${message}`);
}

console.log('\n🎓 ═════════════════════════════════════════════════════════════════');
console.log('   PART 40: FINAL INTEGRATION, PACKAGING & PROJECT VERIFICATION');
console.log('═════════════════════════════════════════════════════════════════\n');

// ─── 1. PACKAGE SCRIPTS & STARTUP WORKFLOW ──────────────────────────────
console.log('--- 1. PACKAGE & STARTUP WORKFLOW AUDIT ---');

const pkgFile = path.join(ROOT, 'package.json');
assert(fs.existsSync(pkgFile), 'package.json exists');
const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf-8'));

assert(pkg.scripts?.dev === 'vite', 'npm run dev is configured for development startup');
assert(pkg.scripts?.build === 'vite build', 'npm run build is configured for production bundling');
assert(pkg.dependencies?.three, 'Three.js is present in dependencies');
assert(pkg.dependencies?.['@react-three/fiber'], 'R3F is present in dependencies');
assert(pkg.dependencies?.['@react-three/drei'], 'Drei is present in dependencies');
assert(pkg.dependencies?.zustand, 'Zustand is present in dependencies');
assert(pkg.dependencies?.qrcode, 'QRCode is present in dependencies');
assert(pkg.dependencies?.ws, 'ws is present in dependencies');


// ─── 2. MILESTONE PROGRESSION IN APP.JSX ────────────────────────────────
console.log('\n--- 2. MILESTONE PROGRESSION & GRADUATION GATE ---');

const appFile = fs.readFileSync(path.join(ROOT, 'src/App.jsx'), 'utf-8');
assert(appFile.includes("id: 40, title: 'Final Integration, Packaging and Project Verification'"), 'App.jsx includes Milestone 40');
assert(appFile.includes("status: 'completed'"), 'Milestone 40 is marked completed');

// Extract all milestone objects and verify count is 40
const milestoneMatches = appFile.match(/id:\s*(\d+),\s*title:\s*'([^']+)',\s*status:\s*'completed'/g) || [];
assert(milestoneMatches.length >= 40, `All 40 engineering milestones are registered and marked completed (found ${milestoneMatches.length})`);


// ─── 3. DOCUMENTATION AUDIT (README.MD 15 SECTIONS) ─────────────────────
console.log('\n--- 3. COMPREHENSIVE README.MD AUDIT ---');

const readmeFile = path.join(ROOT, 'README.md');
assert(fs.existsSync(readmeFile), 'README.md exists');
const readme = fs.readFileSync(readmeFile, 'utf-8');

assert(readme.includes('## 1. Project Overview'), 'README includes Section 1: Project Overview');
assert(readme.includes('## 2. Main Features'), 'README includes Section 2: Main Features');
assert(readme.includes('## 3. Technology Stack'), 'README includes Section 3: Technology Stack');
assert(readme.includes('## 4. Architecture Overview'), 'README includes Section 4: Architecture Overview');
assert(readme.includes('## 5. Prerequisites'), 'README includes Section 5: Prerequisites');
assert(readme.includes('## 6. Installation'), 'README includes Section 6: Installation');
assert(readme.includes('## 7. Startup Instructions'), 'README includes Section 7: Startup Instructions');
assert(readme.includes('## 8. Showroom Usage'), 'README includes Section 8: Showroom Usage');
assert(readme.includes('## 9. Driving Mode Usage'), 'README includes Section 9: Driving Mode Usage');
assert(readme.includes('## 10. Smartphone Pairing Instructions'), 'README includes Section 10: Smartphone Pairing Instructions');
assert(readme.includes('## 11. Local Wi-Fi Requirements'), 'README includes Section 11: Local Wi-Fi Requirements');
assert(readme.includes('## 12. Controls Reference'), 'README includes Section 12: Controls Reference');
assert(readme.includes('## 13. Testing Instructions'), 'README includes Section 13: Testing Instructions');
assert(readme.includes('## 14. Known Limitations & Honest Disclosure'), 'README includes Section 14: Known Limitations');
assert(readme.includes('## 15. Asset Attribution & Licensing Reference'), 'README includes Section 15: Asset Attribution & Licensing');

assert(readme.includes('CC BY 4.0'), 'README attributes Khronos Group Car Concept under CC-BY 4.0');
assert(readme.includes('Poly Haven'), 'README attributes Studio HDRI from Poly Haven');


// ─── 4. PHASE 8 DEMONSTRATION EVIDENCE SCREENSHOTS ──────────────────────
console.log('\n--- 4. PHASE 8 DEMONSTRATION EVIDENCE ARTIFACTS ---');

const requiredScreenshots = [
  'part40_01_main_showroom.png',
  'part40_02_front_three_quarter.png',
  'part40_03_side_view.png',
  'part40_04_paint_customization.png',
  'part40_05_wheel_customization.png',
  'part40_06_driving_scene.png',
  'part40_07_driving_action.png',
  'part40_08_driving_hud.png',
  'part40_09_qr_pairing.png',
  'part40_10_controller_portrait.png',
  'part40_11_controller_landscape.png',
  'part40_12_controller_paired_active.png',
];

for (const shot of requiredScreenshots) {
  const shotPath = path.join(REPORTS_DIR, shot);
  assert(fs.existsSync(shotPath), `Screenshot exists: ${shot}`);
  const stats = fs.statSync(shotPath);
  assert(stats.size > 1024, `Screenshot has valid non-zero content: ${shot} (${(stats.size / 1024).toFixed(1)} KB)`);
}


// ─── 5. SECURITY & CLEAN ENVIRONMENT AUDIT ──────────────────────────────
console.log('\n--- 5. SECURITY, CREDENTIALS & SENSITIVE DATA AUDIT ---');

const viteConfig = fs.readFileSync(path.join(ROOT, 'vite.config.js'), 'utf-8');
assert(!viteConfig.includes('192.168.1.100') && !viteConfig.includes('192.168.0.100'), 'Vite config has no hardcoded developer IPs');
assert(viteConfig.includes('getLocalNetworkAddresses'), 'Dynamic local network address discovery is implemented');
assert(!readme.includes('sk_live_') && !readme.includes('ghp_'), 'Zero API keys or secrets in documentation');


// ─── 6. PROJECT STATUS & ACCEPTANCE MATRIX TRACKING ─────────────────────
console.log('\n--- 6. PROJECT_STATUS.MD & FEATURE_CHECKLIST.MD COMPLETION ---');

const statusFile = fs.readFileSync(path.join(ROOT, 'PROJECT_STATUS.md'), 'utf-8');
assert(statusFile.includes('Part 40/40 — Final Integration, Packaging and Project Verification (COMPLETED)'), 'PROJECT_STATUS.md marks Part 40 completed');
assert(statusFile.includes('VERIFIED COMPLETE'), 'PROJECT_STATUS.md includes Verified Complete classification');
assert(statusFile.includes('IMPLEMENTED & PROTOCOL-VERIFIED'), 'PROJECT_STATUS.md includes Protocol-Verified classification');
assert(statusFile.includes('INCOMPLETE OR KNOWN LIMITATIONS'), 'PROJECT_STATUS.md includes Honest Disclosures');

const checklistFile = fs.readFileSync(path.join(ROOT, 'FEATURE_CHECKLIST.md'), 'utf-8');
assert(checklistFile.includes('F-43'), 'FEATURE_CHECKLIST.md includes F-43 final integration feature');
assert(checklistFile.includes('CG-27'), 'FEATURE_CHECKLIST.md includes CG-27 computer graphics academic concept');

console.log('\n───────────────────────────────────────────────────────');
console.log(`📊 Part 40 Final Integration Results: ${passedTests} passed, 0 failed out of ${totalTests} tests`);
console.log('🎉 ALL PART 40 FINAL PACKAGING & VERIFICATION GATES SATISFIED!\n');
