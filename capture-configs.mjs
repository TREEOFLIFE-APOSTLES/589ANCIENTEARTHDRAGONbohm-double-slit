import { chromium } from 'playwright';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const BASE_DIR = 'I:/Scratch/bohm-double-slit/gif-frames';
const OUT_DIR = 'I:/Scratch/bohm-double-slit/public/demo';
mkdirSync(OUT_DIR, { recursive: true });

const FPS = 12;
const DURATION_S = 6;
const TOTAL_FRAMES = FPS * DURATION_S;
const INTERVAL_MS = 1000 / FPS;

const CONFIGS = [
  {
    name: 'hero',
    warmupMs: 4000,
    setup: (p) => {
      p.params.slitCount = 2;
      p.params.slitWidth = 12;
      p.params.slitSep = 60;
      p.params.mode = 'bohm';
      p.params.showWave = true;
      p.params.showTrajectories = true;
      p.params.showPotential = false;
      p.params.showFlow = false;
      p.params.burstSize = 20;
      p.params.autoFire = true;
    },
  },
  {
    name: 'single-slit',
    warmupMs: 3500,
    setup: (p) => {
      p.params.slitCount = 1;
      p.params.slitWidth = 14;
      p.params.mode = 'bohm';
      p.params.showWave = true;
      p.params.showTrajectories = true;
      p.params.showPotential = false;
      p.params.showFlow = false;
      p.params.autoFire = true;
    },
  },
  {
    name: 'triple-slit',
    warmupMs: 4000,
    setup: (p) => {
      p.params.slitCount = 3;
      p.params.slitWidth = 10;
      p.params.slitSep = 55;
      p.params.mode = 'bohm';
      p.params.showWave = true;
      p.params.showTrajectories = true;
      p.params.showPotential = false;
      p.params.showFlow = false;
      p.params.autoFire = true;
    },
  },
  {
    name: 'quantum-potential',
    warmupMs: 4000,
    setup: (p) => {
      p.params.slitCount = 2;
      p.params.slitWidth = 12;
      p.params.slitSep = 60;
      p.params.mode = 'bohm';
      p.params.showWave = false;
      p.params.showPotential = true;
      p.params.showFlow = true;
      p.params.showTrajectories = true;
      p.params.autoFire = true;
    },
  },
  {
    name: 'copenhagen-vs-bohm',
    warmupMs: 3500,
    setup: (p) => {
      p.params.slitCount = 2;
      p.params.slitWidth = 12;
      p.params.slitSep = 60;
      p.params.mode = 'copenhagen';
      p.params.showWave = true;
      p.params.showPotential = false;
      p.params.showFlow = false;
      p.params.autoFire = true;
    },
  },
];

const browser = await chromium.launch();

for (const cfg of CONFIGS) {
  console.log(`\n=== ${cfg.name} ===`);
  const framesDir = join(BASE_DIR, cfg.name);
  rmSync(framesDir, { recursive: true, force: true });
  mkdirSync(framesDir, { recursive: true });

  const page = await browser.newPage();
  await page.setViewportSize({ width: 760, height: 900 });
  await page.goto('http://localhost:4183', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__bd && window.__bd.params);

  await page.evaluate((setupFnSrc) => {
    const fn = new Function('return ' + setupFnSrc)();
    fn(window.__bd);
    window.__bd.fire(30);
  }, cfg.setup.toString());

  console.log(`Warming up ${cfg.warmupMs}ms...`);
  await page.waitForTimeout(cfg.warmupMs);

  const canvas = page.locator('canvas');
  console.log(`Capturing ${TOTAL_FRAMES} frames...`);
  for (let i = 0; i < TOTAL_FRAMES; i++) {
    const pad = String(i).padStart(4, '0');
    await canvas.screenshot({ path: join(framesDir, `frame-${pad}.png`) });
    if (i % 12 === 0) console.log(`  ${i}/${TOTAL_FRAMES}`);
    await page.waitForTimeout(INTERVAL_MS);
  }

  await page.close();

  console.log('Encoding gif...');
  const outPath = join(OUT_DIR, `${cfg.name}.gif`);
  const paletteSrc = join(framesDir, 'frame-%04d.png');
  execSync(
    `ffmpeg -y -framerate ${FPS} -i "${paletteSrc}" -vf "scale=640:-1:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer" "${outPath}"`,
    { stdio: 'inherit' }
  );
  console.log(`Wrote ${outPath}`);
}

await browser.close();
console.log('\nAll configs captured.');
