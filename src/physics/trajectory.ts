/**
 * Bohmian particle trajectory integrator.
 *
 * Each particle has a definite position at all times.
 * Its velocity is given by the guidance equation: v = (hbar/m) * Im(grad(psi)/psi)
 *
 * Integration: 4th-order Runge-Kutta with dt chosen to keep step ~ 1 grid cell.
 */

import { GRID_W, GRID_H, BARRIER_Y } from './constants';
import type { WaveField } from './wave';
import { sampleVelocity, type VelocityField } from './velocity-field';

export interface Particle {
  x: number;
  y: number;
  trail: Array<[number, number]>;
  active: boolean;
  detectedAt: number | null; // x position at detector
  age: number;               // integration steps taken
}

// Base forward speed is ħk/m ≈ 0.25 cells per unit time, so DT=5 → ~1.25
// cells/frame of visible motion.
const DT = 5.0;
const MAX_TRAIL = 800;

// Stationary-state Bohmian flow has genuine slow regions and vortices near
// dark-fringe nodes. A particle that wanders for this many steps without
// reaching the detector is retired (no detection recorded).
const MAX_AGE = 3000;

export function createParticle(x: number): Particle {
  // Spawn at y+8: far enough from the barrier that the wave has developed
  // its far-field character and vy is well-defined everywhere
  const startY = BARRIER_Y + 8;
  return {
    x,
    y: startY,
    trail: [[x, startY]],
    active: true,
    detectedAt: null,
    age: 0,
  };
}

// Minimum |psi|^2 fraction of row-max before a position is eligible for spawn.
// Prevents particles starting in near-zero amplitude regions (dark nodes near
// the barrier at extreme slit params) where the flow is slow and vortical.
const SPAWN_PROB_THRESHOLD = 0.02;

/**
 * Spawn particles whose initial x positions follow the Born distribution,
 * but only at positions where |psi|^2 exceeds SPAWN_PROB_THRESHOLD * rowMax.
 */
export function spawnParticles(count: number, wave: WaveField): Particle[] {
  const y = BARRIER_Y + 8;
  const row = new Float32Array(GRID_W);
  let rowMax = 0;

  for (let x = 0; x < GRID_W; x++) {
    const v = wave.prob[y * GRID_W + x];
    row[x] = v;
    if (v > rowMax) rowMax = v;
  }

  // Zero out positions below threshold so they cannot be sampled
  let sum = 0;
  for (let x = 0; x < GRID_W; x++) {
    if (row[x] < SPAWN_PROB_THRESHOLD * rowMax) row[x] = 0;
    sum += row[x];
  }

  const particles: Particle[] = [];
  if (sum <= 0) return particles; // degenerate field — nothing sensible to spawn

  // Build CDF over eligible positions only
  const cdf = new Float32Array(GRID_W);
  let acc = 0;
  for (let x = 0; x < GRID_W; x++) {
    acc += row[x] / sum;
    cdf[x] = acc;
  }

  for (let n = 0; n < count; n++) {
    const r = Math.random();
    let x = GRID_W / 2; // fallback to centre
    for (let i = 0; i < GRID_W; i++) {
      if (cdf[i] >= r) { x = i + Math.random(); break; }
    }
    particles.push(createParticle(x));
  }

  return particles;
}

function rk4Step(
  x: number,
  y: number,
  vf: VelocityField,
  dt: number
): [number, number] {
  const [k1x, k1y] = sampleVelocity(vf, x, y);
  const [k2x, k2y] = sampleVelocity(vf, x + dt * k1x / 2, y + dt * k1y / 2);
  const [k3x, k3y] = sampleVelocity(vf, x + dt * k2x / 2, y + dt * k2y / 2);
  const [k4x, k4y] = sampleVelocity(vf, x + dt * k3x, y + dt * k3y);

  return [
    x + (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x),
    y + (dt / 6) * (k1y + 2 * k2y + 2 * k3y + k4y),
  ];
}

export function stepParticle(
  particle: Particle,
  vf: VelocityField,
  speed: number = 1
): void {
  if (!particle.active) return;

  const [nx, ny] = rk4Step(particle.x, particle.y, vf, DT * speed);
  particle.age++;

  // Out of bounds
  if (nx < 0 || nx >= GRID_W || ny >= GRID_H) {
    particle.active = false;
    if (ny >= GRID_H - 1) particle.detectedAt = nx;
    return;
  }

  particle.x = nx;
  particle.y = ny;

  if (particle.trail.length >= MAX_TRAIL) particle.trail.shift();
  particle.trail.push([nx, ny]);

  // Reached detector
  if (ny >= GRID_H - 2) {
    particle.detectedAt = nx;
    particle.active = false;
    return;
  }

  // Trapped in a slow region / vortex — retire without detection
  if (particle.age >= MAX_AGE) {
    particle.active = false;
  }
}
