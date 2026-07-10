/** "About Bohmian mechanics" modal with references. */

export function createInfoModal(): { open: () => void } {
  const modal = document.createElement('div');
  modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);align-items:center;justify-content:center;padding:20px;';

  const modalBox = document.createElement('div');
  modalBox.style.cssText = 'background:rgba(8,10,24,0.97);border:1px solid rgba(74,158,255,0.25);border-radius:8px;max-width:560px;width:100%;padding:28px 32px;font:13px/1.7 ui-monospace,monospace;color:rgba(160,210,255,0.85);box-shadow:0 20px 60px rgba(0,0,0,0.7);position:relative;max-height:88vh;overflow-y:auto;';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.style.cssText = 'position:absolute;top:14px;right:18px;background:none;border:none;font:20px monospace;color:rgba(150,200,255,0.5);cursor:pointer;line-height:1;padding:0;';
  closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

  modalBox.innerHTML = `
<h2 style="font:600 15px ui-monospace,monospace;color:rgba(160,210,255,0.95);margin:0 0 16px;letter-spacing:0.08em;">About This Simulation</h2>

<p style="margin:0 0 14px;">In standard quantum mechanics (Copenhagen), a particle has no definite position between measurements — the wave function <em>is</em> all there is. David Bohm showed in 1952 that this is not the only consistent interpretation.</p>

<p style="margin:0 0 14px;">In Bohmian mechanics, each particle has a <strong>definite position at all times</strong>, guided by a real physical wave ψ through the <strong>quantum potential</strong>:</p>

<div style="background:rgba(74,158,255,0.07);border:1px solid rgba(74,158,255,0.15);border-radius:4px;padding:10px 14px;margin:0 0 14px;font:12px ui-monospace,monospace;line-height:2;">
  v = (ħ/m) Im(∇ψ / ψ) &nbsp;&nbsp;<span style="opacity:0.5">← guidance equation</span><br>
  Q = −(ħ²/2m) ∇²R / R &nbsp;<span style="opacity:0.5">← quantum potential, R = |ψ|</span>
</div>

<p style="margin:0 0 14px;">The interference pattern is not mysterious — it emerges from the topology of Q. Trajectories bunch into the valleys of Q (bright fringes) and are repelled from its ridges (dark fringes). No randomness, no collapse, no measurement problem. All quantum predictions are reproduced exactly.</p>

<p style="margin:0 0 6px;color:rgba(120,170,220,0.7);font-size:11px;letter-spacing:0.06em;text-transform:uppercase;">Key papers</p>
<ul style="margin:0 0 16px;padding-left:18px;line-height:2;">
  <li>Bohm (1952) — <em>A Suggested Interpretation of the Quantum Theory in Terms of "Hidden" Variables</em><br>
    <a href="https://journals.aps.org/pr/abstract/10.1103/PhysRev.85.166" target="_blank" rel="noopener" style="color:rgba(100,180,255,0.8);">Phys. Rev. 85, 166 (Part I)</a> &nbsp;·&nbsp;
    <a href="https://journals.aps.org/pr/abstract/10.1103/PhysRev.85.180" target="_blank" rel="noopener" style="color:rgba(100,180,255,0.8);">Phys. Rev. 85, 180 (Part II)</a>
  </li>
  <li>Philippidis, Dewdney &amp; Hiley (1979) — <em>Quantum interference and the quantum potential</em> — the paper that first drew Bohmian trajectories for the double-slit<br>
    <a href="https://link.springer.com/article/10.1007/BF02721975" target="_blank" rel="noopener" style="color:rgba(100,180,255,0.8);">Il Nuovo Cimento B 52, 15–28</a>
  </li>
</ul>

<p style="margin:0 0 6px;color:rgba(120,170,220,0.7);font-size:11px;letter-spacing:0.06em;text-transform:uppercase;">Further reading</p>
<ul style="margin:0;padding-left:18px;line-height:2;">
  <li><a href="https://plato.stanford.edu/entries/qm-bohm/" target="_blank" rel="noopener" style="color:rgba(100,180,255,0.8);">Stanford Encyclopedia of Philosophy — Bohmian Mechanics</a> — comprehensive, peer-reviewed, free</li>
  <li>Holland (1993) — <em>The Quantum Theory of Motion</em> — the definitive textbook treatment</li>
</ul>
`;

  modalBox.prepend(closeBtn);
  modal.appendChild(modalBox);
  document.body.appendChild(modal);

  return { open: () => { modal.style.display = 'flex'; } };
}
