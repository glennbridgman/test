# Double Pendulum Divergence Webapp

This is a browser-based simulator for chaotic divergence in a double pendulum.

It repeatedly applies small perturbations `δ₀` to a baseline initial condition, then measures the empirical time until the perturbed trajectory exceeds a phase-space divergence threshold `Δ*`.

The app compares empirical divergence times against the theoretical model:

\[
 t_\text{div} \approx \frac{\ln(\Delta^*/\delta_0)}{\lambda}
\]

where `λ` is estimated directly from a reference perturbation growth curve.

## Run locally

From this directory:

```bash
python3 -m http.server 8000
```

Then open:

- `http://localhost:8000`

## Features

- Configurable simulation horizon, timestep, threshold, fit range, and perturbation sweep range.
- Empirical vs theoretical divergence chart (log-scaled perturbation axis).
- Reference perturbation growth chart (log-scaled separation axis).
- Results table and CSV download generated in-browser.
- No runtime Python package dependencies for users (everything runs in the browser).
