/**
 * Renders Bohmian particle trajectories.
 *
 * Active particles are drawn live each frame (bright, glowing head).
 * Finished trajectories are stamped ONCE onto a persistent offscreen layer
 * by the caller (stampTrail), so per-frame cost scales with active
 * particles only, no matter how many thousands have completed.
 */

import { GRID_W, GRID_H } from '../physics/constants';
import type { Particle } from '../physics/trajectory';

export function renderActiveTrajectories(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  canvasW: number,
  canvasH: number
): void {
  const sx = canvasW / GRID_W;
  const sy = canvasH / GRID_H;

  ctx.save();
  for (const p of particles) {
    if (!p.active || p.trail.length < 2) continue;

    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = '#39ff14';
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(p.trail[0][0] * sx, p.trail[0][1] * sy);
    // Decimate: every 2nd point is indistinguishable at ~1 cell/step
    for (let i = 2; i < p.trail.length; i += 2) {
      ctx.lineTo(p.trail[i][0] * sx, p.trail[i][1] * sy);
    }
    const last = p.trail[p.trail.length - 1];
    ctx.lineTo(last[0] * sx, last[1] * sy);
    ctx.stroke();

    // Glowing head
    const cx = last[0] * sx;
    const cy = last[1] * sy;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 6);
    grad.addColorStop(0, 'rgba(100, 255, 80, 1)');
    grad.addColorStop(0.5, 'rgba(57, 255, 20, 0.5)');
    grad.addColorStop(1, 'rgba(57, 255, 20, 0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Stamp a finished particle's full trail onto the persistent trail layer. */
export function stampTrail(
  layerCtx: CanvasRenderingContext2D,
  p: Particle,
  canvasW: number,
  canvasH: number
): void {
  if (p.trail.length < 2) return;
  const sx = canvasW / GRID_W;
  const sy = canvasH / GRID_H;

  layerCtx.save();
  layerCtx.globalAlpha = 0.4;
  layerCtx.strokeStyle = p.detectedAt !== null ? '#22aa00' : '#1a6600';
  layerCtx.lineWidth = 1;
  layerCtx.lineJoin = 'round';

  layerCtx.beginPath();
  layerCtx.moveTo(p.trail[0][0] * sx, p.trail[0][1] * sy);
  for (let i = 2; i < p.trail.length; i += 2) {
    layerCtx.lineTo(p.trail[i][0] * sx, p.trail[i][1] * sy);
  }
  const last = p.trail[p.trail.length - 1];
  layerCtx.lineTo(last[0] * sx, last[1] * sy);
  layerCtx.stroke();
  layerCtx.restore();
}

/**
 * Render the detector histogram as a horizontal bar chart at the bottom of
 * the canvas, with the theoretical |psi|^2 profile overlaid for comparison.
 */
export function renderHistogram(
  ctx: CanvasRenderingContext2D,
  histogram: Float32Array,
  theory: Float32Array | null,
  canvasW: number,
  canvasH: number,
  stripH: number
): void {
  let maxVal = 1;
  for (let i = 0; i < histogram.length; i++) {
    if (histogram[i] > maxVal) maxVal = histogram[i];
  }
  const bins = histogram.length;
  const binW = canvasW / bins;
  const stripY = canvasH - stripH;

  ctx.save();

  // Background strip
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, stripY, canvasW, stripH);

  // Top border line
  ctx.strokeStyle = 'rgba(74, 158, 255, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, stripY);
  ctx.lineTo(canvasW, stripY);
  ctx.stroke();

  // Bars growing upward from bottom
  for (let i = 0; i < bins; i++) {
    const norm = histogram[i] / maxVal;
    if (norm < 0.005) continue;
    const barH = norm * (stripH - 4);
    const bx = i * binW;

    const hue = 200 - norm * 150;
    ctx.fillStyle = `hsl(${hue}, 100%, ${35 + norm * 45}%)`;
    ctx.fillRect(bx, stripY + stripH - barH, binW - 0.5, barH);
  }

  // Theoretical Born-rule curve for comparison
  if (theory) {
    ctx.strokeStyle = 'rgba(255, 210, 80, 0.85)';
    ctx.lineWidth = 1.25;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    for (let i = 0; i < theory.length; i++) {
      const px = (i + 0.5) * (canvasW / theory.length);
      const py = stripY + stripH - 2 - theory[i] * (stripH - 6);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Labels
  ctx.fillStyle = 'rgba(150, 200, 255, 0.75)';
  ctx.font = '12px ui-monospace,monospace';
  ctx.textAlign = 'left';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 3;
  ctx.fillText('DETECTOR SCREEN', 8, stripY + 14);
  if (theory) {
    ctx.fillStyle = 'rgba(255, 210, 80, 0.8)';
    ctx.font = '10px ui-monospace,monospace';
    ctx.textAlign = 'right';
    ctx.fillText('▪▪ theory |ψ|²', canvasW - 8, stripY + 13);
  }

  ctx.restore();
}
