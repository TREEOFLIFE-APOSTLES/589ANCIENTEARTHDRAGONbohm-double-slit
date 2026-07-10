/**
 * Custom control panel — replaces lil-gui.
 *
 * Structure: sections with segmented controls, live sliders, toggle chips,
 * preset buttons and instant styled tooltips. All state lives in the shared
 * `params` object; callbacks notify main.ts of what changed.
 */

import type { WaveDisplayMode } from '../rendering/wave-renderer';

export interface SimParams {
  slitCount: number;
  slitWidth: number;
  slitSep: number;
  mode: 'bohm' | 'copenhagen';
  waveDisplay: WaveDisplayMode;
  showWave: boolean;
  showPotential: boolean;
  showFlow: boolean;
  showTrajectories: boolean;
  showAnnotations: boolean;
  showSymmetryAxis: boolean;
  burstSize: number;
  autoFire: boolean;
  paused: boolean;
  simSpeed: number;
}

export interface PanelCallbacks {
  onExperimentChange: (final: boolean) => void; // slit geometry changed
  onModeChange: () => void;
  onDisplayChange: () => void;                  // wave display mode changed
  onFire: (count: number) => void;
  onClear: () => void;
}

export interface Panel {
  refresh: () => void;
  element: HTMLElement;
}

interface Preset {
  label: string;
  tip: string;
  apply: (p: SimParams) => void;
}

const PRESETS: Preset[] = [
  {
    label: 'Classic',
    tip: 'The textbook double-slit: the configuration from Philippidis, Dewdney & Hiley (1979).',
    apply: p => { p.slitCount = 2; p.slitWidth = 12; p.slitSep = 60; },
  },
  {
    label: 'Wide fringes',
    tip: 'Closer slits spread the fringes apart (fringe spacing ∝ 1/separation).',
    apply: p => { p.slitCount = 2; p.slitWidth = 8; p.slitSep = 38; },
  },
  {
    label: 'Fine fringes',
    tip: 'Widely separated slits pack many narrow fringes together.',
    apply: p => { p.slitCount = 2; p.slitWidth = 10; p.slitSep = 120; },
  },
  {
    label: 'Single slit',
    tip: 'One slit only: pure diffraction, no two-slit interference. Compare the detector pattern!',
    apply: p => { p.slitCount = 1; p.slitWidth = 14; },
  },
  {
    label: 'Triple slit',
    tip: 'Three slits: primary maxima sharpen and faint secondary maxima appear between them.',
    apply: p => { p.slitCount = 3; p.slitWidth = 10; p.slitSep = 55; },
  },
];

// ─── Tooltip singleton ───────────────────────────────────────────────────────

let tipEl: HTMLDivElement | null = null;
let tipTimer = 0;

function ensureTipEl(): HTMLDivElement {
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.className = 'bd-tooltip';
    document.body.appendChild(tipEl);
  }
  return tipEl;
}

export function attachTip(el: HTMLElement, text: string): void {
  el.addEventListener('mouseenter', () => {
    tipTimer = window.setTimeout(() => {
      const t = ensureTipEl();
      t.textContent = text;
      t.style.display = 'block';
      const r = el.getBoundingClientRect();
      const tw = t.offsetWidth;
      let x = r.left + r.width / 2 - tw / 2;
      x = Math.max(8, Math.min(x, window.innerWidth - tw - 8));
      let y = r.top - t.offsetHeight - 8;
      if (y < 8) y = r.bottom + 8;
      t.style.left = `${x}px`;
      t.style.top = `${y}px`;
    }, 180);
  });
  el.addEventListener('mouseleave', () => {
    clearTimeout(tipTimer);
    if (tipEl) tipEl.style.display = 'none';
  });
}

// ─── Widget builders ─────────────────────────────────────────────────────────

function section(title: string): HTMLDivElement {
  const s = document.createElement('div');
  s.className = 'bd-section';
  const h = document.createElement('div');
  h.className = 'bd-section-title';
  h.textContent = title;
  s.appendChild(h);
  return s;
}

interface SegOption<T> { value: T; label: string; tip?: string }

function segmented<T>(
  options: SegOption<T>[],
  get: () => T,
  set: (v: T) => void
): { el: HTMLDivElement; refresh: () => void } {
  const el = document.createElement('div');
  el.className = 'bd-segmented';
  const btns: Array<{ btn: HTMLButtonElement; value: T }> = [];

  for (const opt of options) {
    const btn = document.createElement('button');
    btn.textContent = opt.label;
    btn.type = 'button';
    if (opt.tip) attachTip(btn, opt.tip);
    btn.addEventListener('click', () => { set(opt.value); refresh(); });
    el.appendChild(btn);
    btns.push({ btn, value: opt.value });
  }

  function refresh(): void {
    const cur = get();
    for (const { btn, value } of btns) {
      btn.classList.toggle('active', value === cur);
    }
  }
  refresh();
  return { el, refresh };
}

function slider(
  label: string,
  min: number,
  max: number,
  step: number,
  get: () => number,
  set: (v: number, final: boolean) => void,
  tip?: string
): { el: HTMLDivElement; refresh: () => void } {
  const el = document.createElement('div');
  el.className = 'bd-slider-row';

  const lab = document.createElement('label');
  lab.textContent = label;
  if (tip) attachTip(lab, tip);

  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(get());

  const val = document.createElement('span');
  val.className = 'bd-slider-value';
  val.textContent = String(get());

  input.addEventListener('input', () => {
    const v = Number(input.value);
    val.textContent = String(v);
    set(v, false);
  });
  input.addEventListener('change', () => set(Number(input.value), true));

  el.appendChild(lab);
  el.appendChild(input);
  el.appendChild(val);

  return {
    el,
    refresh: () => {
      input.value = String(get());
      val.textContent = String(get());
    },
  };
}

function chip(
  label: string,
  get: () => boolean,
  set: (v: boolean) => void,
  tip?: string
): { el: HTMLButtonElement; refresh: () => void } {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'bd-chip';
  el.textContent = label;
  if (tip) attachTip(el, tip);
  el.addEventListener('click', () => { set(!get()); refresh(); });
  function refresh(): void {
    el.classList.toggle('active', get());
  }
  refresh();
  return { el, refresh };
}

function button(label: string, onClick: () => void, tip?: string, cls = ''): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `bd-btn ${cls}`;
  el.textContent = label;
  if (tip) attachTip(el, tip);
  el.addEventListener('click', onClick);
  return el;
}

// ─── Panel assembly ──────────────────────────────────────────────────────────

export function createPanel(params: SimParams, cb: PanelCallbacks): Panel {
  const root = document.createElement('div');
  root.className = 'bd-panel';

  const header = document.createElement('div');
  header.className = 'bd-panel-header';
  header.innerHTML = '<span>CONTROLS</span><span class="bd-kbd-hint">space pause · f fire · c clear</span>';
  root.appendChild(header);

  const refreshers: Array<() => void> = [];
  const track = <T extends { refresh: () => void }>(w: T): T => {
    refreshers.push(w.refresh);
    return w;
  };

  // Interpretation
  const sMode = section('Interpretation');
  sMode.appendChild(track(segmented(
    [
      { value: 'bohm' as const, label: 'Bohm', tip: 'Particles have definite trajectories at all times, guided by the pilot wave.' },
      { value: 'copenhagen' as const, label: 'Copenhagen', tip: 'No trajectories exist — particles simply appear at the detector with probability |ψ|².' },
    ],
    () => params.mode,
    v => { params.mode = v; cb.onModeChange(); refreshAll(); }
  )).el);
  root.appendChild(sMode);

  // Experiment
  const sExp = section('Experiment');
  const slitRow = document.createElement('div');
  slitRow.className = 'bd-inline-row';
  const slitLab = document.createElement('label');
  slitLab.textContent = 'Slits';
  attachTip(slitLab, 'Number of slit openings in the barrier. One slit = pure diffraction; two or more = interference.');
  slitRow.appendChild(slitLab);
  slitRow.appendChild(track(segmented(
    [1, 2, 3].map(n => ({ value: n, label: String(n) })),
    () => params.slitCount,
    v => { params.slitCount = v; cb.onExperimentChange(true); }
  )).el);
  sExp.appendChild(slitRow);

  sExp.appendChild(track(slider(
    'Slit width', 6, 30, 1,
    () => params.slitWidth,
    (v, final) => { params.slitWidth = v; cb.onExperimentChange(final); },
    'Width of each slit opening. Narrower slits diffract more, spreading the pattern wider.'
  )).el);

  const sepSlider = track(slider(
    'Separation', 30, 140, 1,
    () => params.slitSep,
    (v, final) => { params.slitSep = v; cb.onExperimentChange(final); },
    'Centre-to-centre distance between slits. Larger separation packs fringes closer together.'
  ));
  sExp.appendChild(sepSlider.el);

  const presetRow = document.createElement('div');
  presetRow.className = 'bd-preset-row';
  for (const preset of PRESETS) {
    presetRow.appendChild(button(preset.label, () => {
      preset.apply(params);
      refreshAll();
      cb.onExperimentChange(true);
    }, preset.tip, 'bd-btn-preset'));
  }
  sExp.appendChild(presetRow);
  root.appendChild(sExp);

  // Layers
  const sLayers = section('Layers');
  const chipRow = document.createElement('div');
  chipRow.className = 'bd-chip-row';
  chipRow.appendChild(track(chip('ψ wave', () => params.showWave, v => { params.showWave = v; },
    'The pilot wave |ψ|² — a real physical field that passes through ALL slits and guides every particle.')).el);
  chipRow.appendChild(track(chip('Q potential', () => params.showPotential, v => { params.showPotential = v; },
    'Quantum potential Q = −(ℏ²/2m)∇²R/R. Its valleys (bright) pull trajectories into bright fringes. This is the non-local part of Bohmian mechanics.')).el);
  chipRow.appendChild(track(chip('Flow field', () => params.showFlow, v => { params.showFlow = v; },
    'The guidance velocity field v = (ℏ/m)Im(∇ψ/ψ) as arrows — the "current" every particle rides.')).el);
  chipRow.appendChild(track(chip('Trajectories', () => params.showTrajectories, v => { params.showTrajectories = v; },
    'Definite Bohmian particle paths. They never cross each other or the symmetry axis.')).el);
  chipRow.appendChild(track(chip('Labels', () => params.showAnnotations, v => { params.showAnnotations = v; },
    'Educational annotations on the canvas.')).el);
  chipRow.appendChild(track(chip('Axis', () => params.showSymmetryAxis, v => { params.showSymmetryAxis = v; },
    'The central symmetry axis — provably, no trajectory ever crosses it.')).el);
  sLayers.appendChild(chipRow);

  const dispRow = document.createElement('div');
  dispRow.className = 'bd-inline-row';
  const dispLab = document.createElement('label');
  dispLab.textContent = 'Wave shows';
  attachTip(dispLab, '|ψ|²: probability density (bright = likely). Re ψ: the oscillating wave itself (red/blue crests).');
  dispRow.appendChild(dispLab);
  dispRow.appendChild(track(segmented(
    [
      { value: 'prob' as const, label: '|ψ|²' },
      { value: 'real' as const, label: 'Re ψ' },
    ],
    () => params.waveDisplay,
    v => { params.waveDisplay = v; cb.onDisplayChange(); }
  )).el);
  sLayers.appendChild(dispRow);
  root.appendChild(sLayers);

  // Particles
  const sPart = section('Particles');
  sPart.appendChild(track(slider(
    'Burst size', 1, 200, 1,
    () => params.burstSize,
    v => { params.burstSize = v; },
    'How many particles a burst fires. Starting positions are Born-rule sampled from |ψ|².'
  )).el);

  const fireRow = document.createElement('div');
  fireRow.className = 'bd-btn-row';
  fireRow.appendChild(button('Fire burst', () => cb.onFire(params.burstSize),
    'Fire a burst of particles (keyboard: F)', 'bd-btn-primary'));
  fireRow.appendChild(button('Fire 1', () => cb.onFire(1), 'Fire a single particle'));
  fireRow.appendChild(button('Clear', () => cb.onClear(), 'Clear all particles, trails and the detector histogram (keyboard: C)'));
  sPart.appendChild(fireRow);

  const autoRow = document.createElement('div');
  autoRow.className = 'bd-chip-row';
  autoRow.appendChild(track(chip('Auto-fire', () => params.autoFire, v => { params.autoFire = v; },
    'Continuously fire particles so the detector histogram builds toward the theoretical |ψ|² curve.')).el);
  autoRow.appendChild(track(chip('Pause', () => params.paused, v => { params.paused = v; },
    'Freeze the simulation (keyboard: SPACE).')).el);
  sPart.appendChild(autoRow);

  const speedRow = document.createElement('div');
  speedRow.className = 'bd-inline-row';
  const speedLab = document.createElement('label');
  speedLab.textContent = 'Speed';
  attachTip(speedLab, 'Simulation speed multiplier.');
  speedRow.appendChild(speedLab);
  speedRow.appendChild(track(segmented(
    [
      { value: 0.5, label: '½×' },
      { value: 1, label: '1×' },
      { value: 2, label: '2×' },
    ],
    () => params.simSpeed,
    v => { params.simSpeed = v; }
  )).el);
  sPart.appendChild(speedRow);
  root.appendChild(sPart);

  function refreshAll(): void {
    for (const r of refreshers) r();
    // Separation is meaningless with a single slit
    sepSlider.el.classList.toggle('bd-disabled', params.slitCount === 1);
  }
  refreshAll();

  return { refresh: refreshAll, element: root };
}
