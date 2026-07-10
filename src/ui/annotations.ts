/**
 * Educational annotation overlays.
 * Positioned at edges/sides to avoid blocking particle trajectories.
 */

import { GRID_H, BARRIER_Y } from '../physics/constants';

export interface Annotation {
  // Fractional canvas position (0..1)
  fx: number;
  fy: number;
  align: 'left' | 'right' | 'center';
  text: string;
  subtext?: string;
  color?: string;
  id?: string;
}

export const ANNOTATIONS: Annotation[] = [
  {
    id: 'slits',
    fx: 0.5,
    fy: (BARRIER_Y - 30) / GRID_H,
    align: 'center',
    text: 'Pilot wave → BOTH slits',
    subtext: 'Particle → only ONE slit',
    color: 'rgba(100,200,255,0.9)',
  },
  {
    fx: 0.03,
    fy: (BARRIER_Y + 60) / GRID_H,
    align: 'left',
    text: 'Quantum potential',
    subtext: 'Q = −(ℏ²/2m) ∇²R/R',
    color: 'rgba(200,140,255,0.85)',
  },
  {
    fx: 0.97,
    fy: (BARRIER_Y + 60) / GRID_H,
    align: 'right',
    text: 'Guidance eq.',
    subtext: 'v = (ℏ/m) Im(∇ψ/ψ)',
    color: 'rgba(100,230,180,0.85)',
  },
  {
    fx: 0.03,
    fy: 0.72,
    align: 'left',
    text: 'Trajectories never',
    subtext: 'cross symmetry axis',
    color: 'rgba(255,160,100,0.8)',
  },
  {
    fx: 0.97,
    fy: 0.72,
    align: 'right',
    text: 'Bunching → bright',
    subtext: 'fringes (Q valleys)',
    color: 'rgba(100,230,180,0.8)',
  },
];

export function renderAnnotations(
  ctx: CanvasRenderingContext2D,
  visible: boolean,
  canvasW: number,
  simH: number,  // simulation area height (excludes histogram strip)
  slitCount: number = 2
): void {
  if (!visible) return;

  for (const ann of ANNOTATIONS) {
    let { text, subtext } = ann;
    if (ann.id === 'slits' && slitCount === 1) {
      text = 'Pilot wave diffracts at the slit';
      subtext = 'Particle rides it — no interference';
    } else if (ann.id === 'slits' && slitCount === 3) {
      text = 'Pilot wave → ALL THREE slits';
    }

    const x = ann.fx * canvasW;
    const y = ann.fy * simH;

    ctx.save();
    ctx.font = 'bold 12px ui-monospace,monospace';
    ctx.textAlign = ann.align;
    ctx.textBaseline = 'top';

    const color = ann.color ?? 'rgba(180,220,255,0.9)';

    // Drop-shadow for readability
    ctx.shadowColor = 'rgba(0,0,0,0.95)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);

    if (subtext) {
      ctx.font = '11px ui-monospace,monospace';
      ctx.fillStyle = color.replace(/[\d.]+\)$/, '0.72)');
      ctx.fillText(subtext, x, y + 16);
    }

    ctx.restore();
  }
}

/** Render the guidance equation in the top-left corner. */
export function renderEquations(
  ctx: CanvasRenderingContext2D,
  mode: 'bohm' | 'copenhagen'
): void {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 4;
  ctx.font = '12px ui-monospace,monospace';

  if (mode === 'bohm') {
    ctx.fillStyle = 'rgba(130, 190, 255, 0.75)';
    ctx.textAlign = 'left';
    ctx.fillText('v = (ℏ/m) Im(∇ψ/ψ)', 10, 18);
    ctx.fillText('Q = −(ℏ²/2m) ∇²R/R', 10, 34);
  } else {
    ctx.fillStyle = 'rgba(255, 190, 80, 0.75)';
    ctx.textAlign = 'left';
    ctx.fillText('|ψ(x)|² = detection probability', 10, 18);
    ctx.fillText('No trajectory — wave function collapses', 10, 34);
  }

  ctx.restore();
}

/** Draw a symmetry axis line down the centre. */
export function renderSymmetryAxis(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  simH: number
): void {
  const cx = canvasW / 2;
  const barrierY = (BARRIER_Y / GRID_H) * simH;

  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = '#ff8866';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 8]);
  ctx.beginPath();
  ctx.moveTo(cx, barrierY);
  ctx.lineTo(cx, simH);
  ctx.stroke();

  // Label
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#ff8866';
  ctx.font = '10px ui-monospace,monospace';
  ctx.textAlign = 'center';
  ctx.setLineDash([]);
  ctx.fillText('symmetry axis', cx, simH - 20);
  ctx.restore();
}
