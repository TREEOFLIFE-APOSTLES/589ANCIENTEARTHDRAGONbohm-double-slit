import './style.css';
import { computeWaveField, getDetectorProfile, type WaveField } from './physics/wave';
import { computeQuantumPotential, type QField } from './physics/quantum-potential';
import { computeVelocityField, type VelocityField } from './physics/velocity-field';
import { spawnParticles, stepParticle, type Particle } from './physics/trajectory';
import { GRID_W, GRID_H, DEFAULT_SLIT_WIDTH, DEFAULT_SLIT_SEP, BARRIER_Y } from './physics/constants';
import { renderWaveField, renderBarrier, renderIncomingWave } from './rendering/wave-renderer';
import { renderQuantumPotential } from './rendering/potential-renderer';
import { renderActiveTrajectories, renderHistogram, stampTrail } from './rendering/trajectory-renderer';
import { buildFlowSamples, renderFlow, type FlowSample } from './rendering/flow-renderer';
import { renderAnnotations, renderEquations, renderSymmetryAxis } from './ui/annotations';
import { createPanel, type SimParams } from './ui/panel';
import { createInfoModal } from './ui/info-modal';

// ─── Canvas + layout ─────────────────────────────────────────────────────────

const CANVAS_W = 680;   // CSS display size
const CANVAS_H = 820;
const HISTOGRAM_H = 70; // horizontal detector strip at bottom
const SIM_H = CANVAS_H - HISTOGRAM_H;

// Retina/HiDPI: render at up to 2x and scale down with CSS for sharp text
const DPR = Math.min(window.devicePixelRatio || 1, 2);

const container = document.getElementById('app')!;
container.className = 'bd-layout';

const column = document.createElement('div');
column.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:10px;min-width:0;';

const titleEl = document.createElement('div');
titleEl.style.cssText = 'color:rgba(160,210,255,0.92);font:600 14px/1.4 ui-monospace,monospace;text-align:center;letter-spacing:0.12em;text-transform:uppercase;opacity:0.85;';
titleEl.textContent = 'Bohmian Mechanics — Double-Slit Experiment';

const subtitleEl = document.createElement('div');
subtitleEl.style.cssText = 'color:rgba(120,170,220,0.55);font:11px ui-monospace,monospace;text-align:center;letter-spacing:0.06em;margin-top:-6px;';
subtitleEl.textContent = 'Pilot wave guides particles · Quantum potential organises trajectories';

const canvas = document.createElement('canvas');
canvas.width = Math.round(CANVAS_W * DPR);
canvas.height = Math.round(CANVAS_H * DPR);
canvas.style.cssText = `width:${CANVAS_W}px;height:${CANVAS_H}px;max-width:100%;cursor:crosshair;border:1px solid rgba(74,158,255,0.18);border-radius:6px;display:block;`;

const statusEl = document.createElement('div');
statusEl.style.cssText = 'color:rgba(120,180,255,0.5);font:10px ui-monospace,monospace;text-align:center;height:14px;';

// ─── View bar (2D / 3D / info) ───────────────────────────────────────────────

const viewBar = document.createElement('div');
viewBar.style.cssText = 'display:flex;gap:6px;align-items:center;';

function makeViewBtn(label: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.textContent = label;
  btn.className = 'bd-btn';
  btn.style.flex = 'initial';
  btn.style.fontSize = '10px';
  return btn;
}

const btn2D = makeViewBtn('2D Top-down');
const btn3D = makeViewBtn('3D Perspective');
const dragHint = document.createElement('span');
dragHint.style.cssText = 'font:9px ui-monospace,monospace;color:rgba(120,170,220,0.4);display:none;';
dragHint.textContent = '← drag to rotate →';
const btnInfo = makeViewBtn('?');
btnInfo.title = 'About Bohmian mechanics & references';

viewBar.appendChild(btn2D);
viewBar.appendChild(btn3D);
viewBar.appendChild(dragHint);
viewBar.appendChild(btnInfo);

const infoModal = createInfoModal();
btnInfo.addEventListener('click', infoModal.open);

// Canvas wrapper for 3D perspective transform
const canvasWrapper = document.createElement('div');
canvasWrapper.style.cssText = `max-width:${CANVAS_W}px;perspective:1200px;display:flex;align-items:center;justify-content:center;`;

column.appendChild(titleEl);
column.appendChild(subtitleEl);
column.appendChild(viewBar);
canvasWrapper.appendChild(canvas);
column.appendChild(canvasWrapper);
column.appendChild(statusEl);
container.appendChild(column);

// ─── 3D perspective drag ─────────────────────────────────────────────────────

let is3D = false;
let rotX = -28;
let rotY = 8;
let dragStart: { x: number; y: number; rx: number; ry: number } | null = null;

function applyTransform(): void {
  if (is3D) {
    canvas.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
    canvas.style.cursor = 'grab';
    canvas.style.transition = 'none';
  } else {
    canvas.style.transform = 'rotateX(0deg) rotateY(0deg)';
    canvas.style.cursor = 'crosshair';
    canvas.style.transition = 'transform 0.4s cubic-bezier(0.25,0.46,0.45,0.94)';
  }
  btn2D.classList.toggle('bd-btn-primary', !is3D);
  btn3D.classList.toggle('bd-btn-primary', is3D);
  dragHint.style.display = is3D ? 'inline' : 'none';
}

canvas.addEventListener('mousedown', (e) => {
  if (!is3D) return;
  dragStart = { x: e.clientX, y: e.clientY, rx: rotX, ry: rotY };
  canvas.style.cursor = 'grabbing';
});
window.addEventListener('mousemove', (e) => {
  if (!dragStart) return;
  rotY = dragStart.ry + (e.clientX - dragStart.x) * 0.35;
  rotX = Math.max(-70, Math.min(5, dragStart.rx + (e.clientY - dragStart.y) * 0.35));
  applyTransform();
});
window.addEventListener('mouseup', () => {
  if (dragStart) canvas.style.cursor = is3D ? 'grab' : 'crosshair';
  dragStart = null;
});
btn2D.addEventListener('click', () => { is3D = false; applyTransform(); });
btn3D.addEventListener('click', () => { is3D = true; rotX = -28; rotY = 8; applyTransform(); });

const ctx = canvas.getContext('2d')!;
ctx.scale(DPR, DPR);

// ─── Offscreen layers ────────────────────────────────────────────────────────

function makeLayer(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

// Grid-resolution caches for the static field images (rebuilt on recompute)
const [waveLayer, waveLayerCtx] = makeLayer(GRID_W, GRID_H);
const [qLayer, qLayerCtx] = makeLayer(GRID_W, GRID_H);
// Persistent finished-trajectory layer at display resolution
const [trailLayer, trailCtx] = makeLayer(Math.round(CANVAS_W * DPR), Math.round(SIM_H * DPR));
trailCtx.scale(DPR, DPR);

// ─── State ───────────────────────────────────────────────────────────────────

const params: SimParams = {
  slitCount: 2,
  slitWidth: DEFAULT_SLIT_WIDTH,
  slitSep: DEFAULT_SLIT_SEP,
  mode: 'bohm',
  waveDisplay: 'prob',
  showWave: true,
  showPotential: false,
  showFlow: false,
  showTrajectories: true,
  showAnnotations: true,
  showSymmetryAxis: true,
  burstSize: 20,
  autoFire: true,
  paused: false,
  simSpeed: 1,
};

let wave: WaveField | null = null;
let qField: QField | null = null;
let vField: VelocityField | null = null;
let flowSamples: FlowSample[] = [];
let theory: Float32Array | null = null;
let particles: Particle[] = [];
let copenhagenDots: number[] = [];
const histogram = new Float32Array(GRID_W);
let detectedCount = 0;
let frameCount = 0;
let spawnTimer = 0;
const SPAWN_INTERVAL = 8;
let lastComputeMs = 0;

// ─── Physics recompute (throttled live preview + full-quality settle) ────────

let previewPending = false;
let settleTimer = 0;

function recompute(quality: 'full' | 'preview'): void {
  const t0 = performance.now();
  wave = computeWaveField(
    { slitWidth: params.slitWidth, slitSep: params.slitSep, slitCount: params.slitCount },
    quality
  );
  theory = getDetectorProfile(wave);
  if (quality === 'full') {
    qField = computeQuantumPotential(wave);
    vField = computeVelocityField(wave);
    flowSamples = buildFlowSamples(vField, wave);
    rebuildQLayer();
  } else {
    // Derived fields go stale during a drag; the settle pass rebuilds them.
    qField = null;
    vField = null;
    flowSamples = [];
  }
  lastComputeMs = performance.now() - t0;
  rebuildWaveLayer();
  clearParticles();
}

function onExperimentChange(final: boolean): void {
  if (final) {
    clearTimeout(settleTimer);
    recompute('full');
    return;
  }
  // Live drag: preview-quality recompute, at most one per frame
  if (!previewPending) {
    previewPending = true;
    requestAnimationFrame(() => {
      previewPending = false;
      recompute('preview');
    });
  }
  // Full-quality settle shortly after the last movement
  clearTimeout(settleTimer);
  settleTimer = window.setTimeout(() => recompute('full'), 250);
}

function rebuildWaveLayer(): void {
  if (!wave) return;
  const img = waveLayerCtx.createImageData(GRID_W, GRID_H);
  if (params.mode === 'copenhagen') {
    renderWaveField(img, wave, 'prob', 185);
  } else {
    renderWaveField(img, wave, params.waveDisplay);
  }
  waveLayerCtx.putImageData(img, 0, 0);
}

function rebuildQLayer(): void {
  if (!qField) return;
  const img = qLayerCtx.createImageData(GRID_W, GRID_H);
  renderQuantumPotential(img, qField, 160);
  qLayerCtx.putImageData(img, 0, 0);
}

function clearParticles(): void {
  particles = [];
  copenhagenDots = [];
  histogram.fill(0);
  detectedCount = 0;
  trailCtx.clearRect(0, 0, CANVAS_W, SIM_H);
}

function fireParticles(count: number): void {
  if (!wave) return;
  particles.push(...spawnParticles(count, wave));
  if (particles.length > 600) particles = particles.slice(-600);
}

// ─── Control panel ───────────────────────────────────────────────────────────

const panel = createPanel(params, {
  onExperimentChange,
  onModeChange: () => { clearParticles(); rebuildWaveLayer(); },
  onDisplayChange: rebuildWaveLayer,
  onFire: fireParticles,
  onClear: clearParticles,
});
container.appendChild(panel.element);

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (e.code === 'Space') { e.preventDefault(); params.paused = !params.paused; }
  else if (e.key === 'f') fireParticles(params.burstSize);
  else if (e.key === 'c') clearParticles();
  else if (e.key === 'q') params.showPotential = !params.showPotential;
  else if (e.key === 't') params.showTrajectories = !params.showTrajectories;
  else return;
  panel.refresh();
});

// ─── Hover physics readout ───────────────────────────────────────────────────

let hover: { gx: number; gy: number } | null = null;

canvas.addEventListener('mousemove', (e) => {
  if (is3D) { hover = null; return; }
  const r = canvas.getBoundingClientRect();
  const gx = ((e.clientX - r.left) / r.width) * GRID_W;
  const cssY = ((e.clientY - r.top) / r.height) * CANVAS_H;
  const gy = (cssY / SIM_H) * GRID_H;
  hover = cssY < SIM_H && gy > BARRIER_Y + 1 ? { gx, gy } : null;
});
canvas.addEventListener('mouseleave', () => { hover = null; });

function renderHoverReadout(): void {
  if (!hover || !wave || !qField || !vField) return;
  const xi = Math.round(hover.gx);
  const yi = Math.round(hover.gy);
  if (xi < 1 || xi >= GRID_W - 1 || yi <= BARRIER_Y || yi >= GRID_H - 1) return;
  const idx = yi * GRID_W + xi;

  const p = wave.prob[idx];
  const q = qField.display[idx];
  const vx = vField.vx[idx];
  const vy = vField.vy[idx];

  const lines = [
    `|ψ|² = ${p.toFixed(3)}`,
    `Q̂  = ${q >= 0 ? '+' : ''}${q.toFixed(3)}`,
    `v  = (${vx.toFixed(2)}, ${vy.toFixed(2)})`,
  ];

  ctx.save();
  ctx.font = '11px ui-monospace,monospace';
  const w = 132;
  const h = 52;
  const bx = CANVAS_W - w - 10;
  const by = SIM_H - h - 10;
  ctx.fillStyle = 'rgba(5, 8, 20, 0.85)';
  ctx.strokeStyle = 'rgba(74,158,255,0.3)';
  ctx.beginPath();
  ctx.roundRect(bx, by, w, h, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(170, 220, 255, 0.9)';
  ctx.textAlign = 'left';
  lines.forEach((l, i) => ctx.fillText(l, bx + 9, by + 16 + i * 15));
  ctx.restore();
}

// ─── Render pipeline ─────────────────────────────────────────────────────────

function renderFrame(): void {
  ctx.fillStyle = '#07080f';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  if (!wave) return;

  const scaleY = SIM_H / GRID_H;

  // Static wave field — cached, single drawImage
  if (params.showWave) {
    if (params.mode === 'copenhagen') {
      ctx.save();
      ctx.filter = 'sepia(50%) hue-rotate(15deg) saturate(1.2)';
      ctx.drawImage(waveLayer, 0, 0, CANVAS_W, SIM_H);
      ctx.restore();
    } else {
      ctx.drawImage(waveLayer, 0, 0, CANVAS_W, SIM_H);
    }
  }

  // Quantum potential overlay — cached
  if (params.showPotential && params.mode === 'bohm') {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.55;
    ctx.drawImage(qLayer, 0, 0, CANVAS_W, SIM_H);
    ctx.restore();
  }

  renderIncomingWave(ctx, frameCount, CANVAS_W, SIM_H);
  renderRegionLabels(scaleY);
  renderBarrier(ctx, params.slitCount, params.slitWidth, params.slitSep, CANVAS_W, SIM_H);

  if (params.showSymmetryAxis && params.slitCount !== 1) {
    renderSymmetryAxis(ctx, CANVAS_W, SIM_H);
  }

  // Guidance velocity field
  if (params.showFlow && params.mode === 'bohm') {
    renderFlow(ctx, flowSamples, CANVAS_W, SIM_H);
  }

  // Trajectories: persistent finished layer + live actives
  if (params.showTrajectories && params.mode === 'bohm') {
    ctx.drawImage(trailLayer, 0, 0, CANVAS_W, SIM_H);
    renderActiveTrajectories(ctx, particles, CANVAS_W, SIM_H);
  }

  // Copenhagen collapse dots
  if (params.mode === 'copenhagen') {
    const scaleX = CANVAS_W / GRID_W;
    ctx.save();
    ctx.fillStyle = 'rgba(255, 210, 80, 0.9)';
    for (const x of copenhagenDots) {
      ctx.beginPath();
      ctx.arc(x * scaleX, SIM_H - 6, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  renderHistogram(ctx, histogram, theory, CANVAS_W, CANVAS_H, HISTOGRAM_H);
  renderEquations(ctx, params.mode);
  if (params.showAnnotations) renderAnnotations(ctx, true, CANVAS_W, SIM_H, params.slitCount);

  // HUD
  const active = particles.length;
  ctx.save();
  ctx.font = '12px ui-monospace,monospace';
  ctx.fillStyle = 'rgba(100, 200, 100, 0.65)';
  ctx.textAlign = 'left';
  ctx.fillText(`${active} active · ${detectedCount} detected${params.paused ? ' · PAUSED' : ''}`, 8, SIM_H - 10);
  ctx.restore();

  renderModeBadge();
  renderHoverReadout();
}

function renderRegionLabels(scaleY: number): void {
  const barrierY = BARRIER_Y * scaleY;
  ctx.save();
  ctx.font = '11px ui-monospace,monospace';
  ctx.fillStyle = 'rgba(120,170,220,0.5)';
  ctx.textAlign = 'left';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 4;
  ctx.fillText('SOURCE', 8, 52);
  ctx.fillText('↓ plane wave', 8, 66);
  ctx.fillText('INTERFERENCE', 8, barrierY + 24);
  ctx.fillText('REGION', 8, barrierY + 38);
  ctx.restore();
}

function renderModeBadge(): void {
  const isBohm = params.mode === 'bohm';
  const label = isBohm ? 'BOHMIAN MECHANICS' : 'COPENHAGEN';
  ctx.save();
  ctx.font = 'bold 12px ui-monospace,monospace';
  const tw = ctx.measureText(label).width;
  const bx = CANVAS_W - tw - 20;
  ctx.fillStyle = isBohm ? 'rgba(0,60,10,0.7)' : 'rgba(60,40,0,0.7)';
  ctx.beginPath();
  ctx.roundRect(bx - 6, 6, tw + 12, 18, 4);
  ctx.fill();
  ctx.fillStyle = isBohm ? 'rgba(57,255,20,0.9)' : 'rgba(255,200,80,0.9)';
  ctx.textAlign = 'left';
  ctx.fillText(label, bx, 19);
  ctx.restore();
}

// ─── Animation loop ──────────────────────────────────────────────────────────

let fpsAcc = 0;
let fpsFrames = 0;
let fps = 60;
let lastT = performance.now();

function animate(): void {
  frameCount++;

  const now = performance.now();
  fpsAcc += now - lastT;
  lastT = now;
  if (++fpsFrames >= 30) {
    fps = Math.round(1000 / (fpsAcc / fpsFrames));
    fpsAcc = 0;
    fpsFrames = 0;
  }

  if (!params.paused && vField && params.mode === 'bohm') {
    const survivors: Particle[] = [];
    for (const p of particles) {
      stepParticle(p, vField, params.simSpeed);
      if (p.active) {
        survivors.push(p);
      } else {
        // Finished: stamp trail once, count detection, drop from live set
        stampTrail(trailCtx, p, CANVAS_W, SIM_H);
        if (p.detectedAt !== null) {
          const xBin = Math.floor(p.detectedAt);
          if (xBin >= 0 && xBin < GRID_W) histogram[xBin]++;
          detectedCount++;
        }
      }
    }
    particles = survivors;

    if (params.autoFire) {
      spawnTimer++;
      if (spawnTimer >= SPAWN_INTERVAL) {
        spawnTimer = 0;
        fireParticles(1);
      }
    }
  }

  // Copenhagen: sample straight from |psi|^2 at the detector
  if (!params.paused && params.mode === 'copenhagen' && params.autoFire && wave) {
    spawnTimer++;
    if (spawnTimer >= SPAWN_INTERVAL * 2) {
      spawnTimer = 0;
      const y = GRID_H - 2;
      let sum = 0;
      for (let x = 0; x < GRID_W; x++) sum += wave.prob[y * GRID_W + x];
      const r = Math.random() * sum;
      let acc = 0;
      for (let x = 0; x < GRID_W; x++) {
        acc += wave.prob[y * GRID_W + x];
        if (acc >= r) {
          copenhagenDots.push(x + Math.random());
          histogram[x]++;
          detectedCount++;
          break;
        }
      }
      if (copenhagenDots.length > 3000) copenhagenDots = copenhagenDots.slice(-3000);
    }
  }

  renderFrame();
  statusEl.textContent = `ψ recompute ${lastComputeMs.toFixed(0)} ms · ${fps} fps`;
  requestAnimationFrame(animate);
}

// ─── Init ────────────────────────────────────────────────────────────────────

applyTransform();
recompute('full');
requestAnimationFrame(animate);

// Debug/testing handle
Object.defineProperty(window, '__bd', {
  value: {
    params,
    fire: fireParticles,
    stats: () => ({
      active: particles.length,
      detected: detectedCount,
      computeMs: lastComputeMs,
      fps,
      histogramSum: histogram.reduce((a, b) => a + b, 0),
    }),
  },
});
