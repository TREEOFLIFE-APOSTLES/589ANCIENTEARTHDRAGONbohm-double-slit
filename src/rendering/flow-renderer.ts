/**
 * Sparse quiver rendering of the Bohmian velocity field.
 * Samples are precomputed once per wave recompute; drawing is a few
 * hundred short lines per frame.
 */

import { GRID_W, GRID_H, BARRIER_Y, V_FORWARD } from '../physics/constants';
import type { VelocityField } from '../physics/velocity-field';
import type { WaveField } from '../physics/wave';

export interface FlowSample {
  x: number;   // grid coords
  y: number;
  ux: number;  // unit direction
  uy: number;
  s: number;   // speed normalised to [0, 1]
}

const STEP = 18;          // grid cells between samples
const PROB_CUTOFF = 0.015; // skip arrows in effectively-dark regions

export function buildFlowSamples(
  vf: VelocityField,
  wave: WaveField
): FlowSample[] {
  const samples: FlowSample[] = [];

  for (let y = BARRIER_Y + STEP / 2; y < GRID_H - 4; y += STEP) {
    for (let x = STEP / 2; x < GRID_W - 2; x += STEP) {
      const idx = Math.round(y) * GRID_W + Math.round(x);
      if (wave.prob[idx] < PROB_CUTOFF) continue;

      const vx = vf.vx[idx];
      const vy = vf.vy[idx];
      const speed = Math.sqrt(vx * vx + vy * vy);
      if (speed < 1e-6) continue;

      samples.push({
        x, y,
        ux: vx / speed,
        uy: vy / speed,
        s: Math.min(1, speed / (2 * V_FORWARD)),
      });
    }
  }

  return samples;
}

export function renderFlow(
  ctx: CanvasRenderingContext2D,
  samples: FlowSample[],
  canvasW: number,
  simH: number
): void {
  const sx = canvasW / GRID_W;
  const sy = simH / GRID_H;

  ctx.save();
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';

  for (const f of samples) {
    const px = f.x * sx;
    const py = f.y * sy;
    const len = 5 + 8 * f.s;
    const tx = px + f.ux * len;
    const ty = py + f.uy * len;

    ctx.globalAlpha = 0.22 + 0.5 * f.s;
    ctx.strokeStyle = '#8fd8ff';
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(tx, ty);
    ctx.stroke();

    // arrowhead dot
    ctx.fillStyle = '#c2ecff';
    ctx.beginPath();
    ctx.arc(tx, ty, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
