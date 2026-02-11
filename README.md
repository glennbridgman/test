# Double Pendulum Divergence Simulator

This project simulates a chaotic double pendulum and repeatedly applies small
perturbations to one angle in the initial condition.

For each perturbation magnitude `δ₀`, it measures the empirical time required
for the phase-space distance from a baseline trajectory to cross a divergence
threshold `Δ*`.

It also computes a theoretical prediction from exponential divergence,

\[
 t_\text{div} \approx \frac{\ln(\Delta^*/\delta_0)}{\lambda}
\]

where `λ` is estimated from a separate reference perturbation growth run.

## Run

```bash
python3 double_pendulum_divergence.py
```

If `matplotlib` is installed, the script also writes PNG charts. Without it, the CSV output is still produced.

Useful options:

- `--tmax`: total simulation time (seconds)
- `--dt`: integration step size
- `--divergence-threshold`: phase-space separation defining “fully diverged”
- `--min-perturb`, `--max-perturb`, `--samples`: perturbation sweep setup
- `--output-dir`: location for generated CSV and charts

Example:

```bash
python3 double_pendulum_divergence.py \
  --tmax 30 \
  --dt 0.002 \
  --min-perturb 1e-9 \
  --max-perturb 1e-2 \
  --samples 24
```

## Outputs

By default, files are written to `outputs/`:

- `divergence_vs_perturbation.csv`
- `divergence_comparison.png`
- `reference_growth.png`

The comparison chart overlays empirical divergence times with the theoretical
log-law prediction.
