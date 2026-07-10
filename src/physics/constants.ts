// Dimensionless units: hbar = 1, m = 1
// All lengths in units of grid cells

export const HBAR = 1;
export const MASS = 1;

// Grid dimensions — wider grid prevents slit edges clipping the boundary
// guard in sampleVelocity() at large slit separations
export const GRID_W = 500;
export const GRID_H = 600;

// Wavelength in grid cells — determines fringe spacing
export const LAMBDA = 25;
export const K = (2 * Math.PI) / LAMBDA;

// Barrier position (y index)
export const BARRIER_Y = 150;

// Default slit parameters (in grid cells)
export const DEFAULT_SLIT_WIDTH = 12;
export const DEFAULT_SLIT_SEP = 60; // centre-to-centre separation

// Regularisation: min R before we clamp Q
export const R_EPSILON = 1e-5;

// Free-particle forward speed ħk/m — the natural velocity scale
export const V_FORWARD = (HBAR * K) / MASS;

// Speed cap: Bohmian speeds genuinely spike near wave nodes, but unbounded
// values destabilise the fixed-step RK4. 6× forward speed preserves the
// whip-around-the-node dynamics while bounding the step length.
export const V_MAX = 6 * V_FORWARD;
