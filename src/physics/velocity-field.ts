/**
 * Bohmian guidance equation velocity field.
 *
 * v = (hbar / m) * Im(grad(psi) / psi)
 *
 * This formulation avoids phase unwrapping: we compute grad of the complex
 * field directly, then take Im(grad_psi / psi).
 *
 * For psi = re + i*im:
 *   vx = (hbar/m) * (re * d(im)/dx - im * d(re)/dx) / |psi|^2
 *   vy = (hbar/m) * (re * d(im)/dy - im * d(re)/dy) / |psi|^2
 *
 * No additive forward-momentum term: the Huygens sum of outgoing waves
 * exp(i*k*r)/sqrt(r) already carries the full forward momentum in its phase
 * gradient (a single source gives exactly v = (ħk/m) r̂). Adding ħk/m on top
 * would double-count it, halving every deflection angle.
 *
 * Near wave nodes |psi|² → 0 and the true Bohmian speed diverges; we
 * regularise the division and cap |v| at V_MAX so the fixed-step RK4
 * stays stable while preserving the whip-around-the-node behaviour.
 */

import { GRID_W, GRID_H, HBAR, MASS, BARRIER_Y, V_MAX } from './constants';
import type { WaveField } from './wave';

export interface VelocityField {
  vx: Float32Array;
  vy: Float32Array;
}

export function computeVelocityField(wave: WaveField): VelocityField {
  const { re, im, amp } = wave;
  const total = GRID_W * GRID_H;
  const vx = new Float32Array(total);
  const vy = new Float32Array(total);

  const coeff = HBAR / MASS;

  // Regularisation floor relative to the field's typical intensity
  let maxProb = 0;
  for (let i = 0; i < total; i++) {
    const p = amp[i] * amp[i];
    if (p > maxProb) maxProb = p;
  }
  const pFloor = maxProb * 1e-7;

  for (let y = BARRIER_Y + 1; y < GRID_H - 1; y++) {
    for (let x = 1; x < GRID_W - 1; x++) {
      const idx = y * GRID_W + x;
      const prob = Math.max(amp[idx] * amp[idx], pFloor);

      const reC = re[idx];
      const imC = im[idx];

      // Central differences
      const dre_dx = (re[y * GRID_W + (x + 1)] - re[y * GRID_W + (x - 1)]) / 2;
      const dim_dx = (im[y * GRID_W + (x + 1)] - im[y * GRID_W + (x - 1)]) / 2;
      const dre_dy = (re[(y + 1) * GRID_W + x] - re[(y - 1) * GRID_W + x]) / 2;
      const dim_dy = (im[(y + 1) * GRID_W + x] - im[(y - 1) * GRID_W + x]) / 2;

      // Im[(dψ/dx)/ψ] = (re·d(im)/dx - im·d(re)/dx) / |ψ|²
      let ux = coeff * (reC * dim_dx - imC * dre_dx) / prob;
      let uy = coeff * (reC * dim_dy - imC * dre_dy) / prob;

      const speed = Math.sqrt(ux * ux + uy * uy);
      if (speed > V_MAX) {
        const s = V_MAX / speed;
        ux *= s;
        uy *= s;
      }

      vx[idx] = ux;
      vy[idx] = uy;
    }
  }

  return { vx, vy };
}

/** Bilinear interpolation of the velocity field at a continuous (x, y) position. */
export function sampleVelocity(
  vf: VelocityField,
  x: number,
  y: number
): [number, number] {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;

  if (xi < 1 || xi >= GRID_W - 2 || yi < BARRIER_Y + 1 || yi >= GRID_H - 2) {
    return [0, 0];
  }

  const i00 = yi * GRID_W + xi;
  const i10 = yi * GRID_W + (xi + 1);
  const i01 = (yi + 1) * GRID_W + xi;
  const i11 = (yi + 1) * GRID_W + (xi + 1);

  const wx = (arr: Float32Array) =>
    arr[i00] * (1 - fx) * (1 - fy) +
    arr[i10] * fx * (1 - fy) +
    arr[i01] * (1 - fx) * fy +
    arr[i11] * fx * fy;

  return [wx(vf.vx), wx(vf.vy)];
}
