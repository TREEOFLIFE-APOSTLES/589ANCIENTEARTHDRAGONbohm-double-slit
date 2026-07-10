/**
 * Huygens-Fresnel wave function computation.
 *
 * Each slit is discretised into point sources with the Rayleigh-Sommerfeld
 * obliquity factor:
 *
 *   psi(x, y) = sum over sources of cos(theta) * exp(i*k*r) / sqrt(r)
 *
 * where cos(theta) = dy/r suppresses unphysical sideways/backward radiation
 * from each secondary source.
 *
 * Source count adapts to slit width: aliasing (grating lobes) only appears
 * when source spacing exceeds lambda, so spacing <= 2 cells (lambda/12.5)
 * is far inside the safe zone while keeping the sum cheap enough to
 * recompute live while a slider is dragged.
 *
 * Returns Float32Arrays of length GRID_W * GRID_H, idx = y * GRID_W + x.
 * Only computed for y > BARRIER_Y (the region beyond the slits).
 */

import { GRID_W, GRID_H, K, BARRIER_Y } from './constants';

export interface WaveField {
  re: Float32Array;
  im: Float32Array;
  amp: Float32Array;  // |psi|
  prob: Float32Array; // |psi|^2, normalised to [0,1]
}

export interface SlitParams {
  slitWidth: number;   // full width in grid cells
  slitSep: number;     // centre-to-centre separation in grid cells
  slitCount: number;   // 1, 2 or 3
}

/** Preview quality uses fewer sources for smooth slider dragging. */
export type WaveQuality = 'full' | 'preview';

function sourcesPerSlit(slitWidth: number, quality: WaveQuality): number {
  const spacing = quality === 'preview' ? 4 : 2; // grid cells, both << lambda/2
  return Math.max(quality === 'preview' ? 4 : 8, Math.ceil(slitWidth / spacing));
}

function slitCentres(slitCount: number, slitSep: number): number[] {
  const cx = GRID_W / 2;
  if (slitCount === 1) return [cx];
  if (slitCount === 3) return [cx - slitSep, cx, cx + slitSep];
  return [cx - slitSep / 2, cx + slitSep / 2];
}

export function computeWaveField(
  params: SlitParams,
  quality: WaveQuality = 'full'
): WaveField {
  const { slitWidth, slitSep, slitCount } = params;
  const perSlit = sourcesPerSlit(slitWidth, quality);
  const centres = slitCentres(slitCount, slitSep);

  // Source x positions along the barrier line (y = BARRIER_Y)
  const sourceXs: number[] = [];
  for (const c of centres) {
    for (let s = 0; s < perSlit; s++) {
      const t = (s + 0.5) / perSlit; // 0..1
      sourceXs.push(c - slitWidth / 2 + t * slitWidth);
    }
  }

  const total = GRID_W * GRID_H;
  const re = new Float32Array(total);
  const im = new Float32Array(total);
  const amp = new Float32Array(total);
  const prob = new Float32Array(total);

  let maxProb = 0;
  const nSrc = sourceXs.length;

  // Preview quality also strides rows: the pattern varies on the scale of
  // lambda (25 cells), so duplicating alternate rows is visually invisible
  // during a slider drag.
  const yStep = quality === 'preview' ? 2 : 1;

  for (let y = BARRIER_Y + 1; y < GRID_H; y += yStep) {
    const dy = y - BARRIER_Y;
    for (let x = 0; x < GRID_W; x++) {
      let sumRe = 0;
      let sumIm = 0;

      for (let s = 0; s < nSrc; s++) {
        const dx = x - sourceXs[s];
        const r = Math.sqrt(dx * dx + dy * dy);
        if (r < 0.75) continue; // avoid singularity directly at source

        // obliquity cos(theta) = dy/r  →  weight = dy / r^1.5
        const w = dy / (r * Math.sqrt(r));
        const phase = K * r;
        sumRe += w * Math.cos(phase);
        sumIm += w * Math.sin(phase);
      }

      const idx = y * GRID_W + x;
      re[idx] = sumRe;
      im[idx] = sumIm;
      const a = Math.sqrt(sumRe * sumRe + sumIm * sumIm);
      amp[idx] = a;
      const p = a * a;
      prob[idx] = p;
      if (p > maxProb) maxProb = p;
    }

    // Fill the skipped row by copying this one
    if (yStep === 2 && y + 1 < GRID_H) {
      const src = y * GRID_W;
      const dst = (y + 1) * GRID_W;
      re.copyWithin(dst, src, src + GRID_W);
      im.copyWithin(dst, src, src + GRID_W);
      amp.copyWithin(dst, src, src + GRID_W);
      prob.copyWithin(dst, src, src + GRID_W);
    }
  }

  // Normalise prob to [0, 1]
  if (maxProb > 0) {
    for (let i = 0; i < total; i++) {
      prob[i] /= maxProb;
    }
  }

  return { re, im, amp, prob };
}

/** Returns normalised amplitude at the detector screen (last row). */
export function getDetectorProfile(wave: WaveField): Float32Array {
  const profile = new Float32Array(GRID_W);
  const y = GRID_H - 1;
  let maxVal = 0;

  for (let x = 0; x < GRID_W; x++) {
    const v = wave.prob[y * GRID_W + x];
    profile[x] = v;
    if (v > maxVal) maxVal = v;
  }

  if (maxVal > 0) {
    for (let x = 0; x < GRID_W; x++) profile[x] /= maxVal;
  }

  return profile;
}
