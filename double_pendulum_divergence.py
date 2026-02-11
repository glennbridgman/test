#!/usr/bin/env python3
"""Double pendulum perturbation growth experiment (dependency-light).

Outputs a CSV relating perturbation size to divergence time and (optionally)
produces charts when matplotlib is available.
"""

from __future__ import annotations

import argparse
import csv
import importlib.util
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

HAS_MATPLOTLIB = importlib.util.find_spec("matplotlib") is not None
if HAS_MATPLOTLIB:
    import matplotlib.pyplot as plt


@dataclass(frozen=True)
class PendulumParameters:
    m1: float = 1.0
    m2: float = 1.0
    l1: float = 1.0
    l2: float = 1.0
    g: float = 9.81


def derivatives(state: list[float], params: PendulumParameters) -> list[float]:
    theta1, theta2, omega1, omega2 = state
    m1, m2, l1, l2, g = params.m1, params.m2, params.l1, params.l2, params.g

    delta = theta1 - theta2
    sin_delta = math.sin(delta)
    cos_delta = math.cos(delta)

    denom1 = l1 * (2 * m1 + m2 - m2 * math.cos(2 * theta1 - 2 * theta2))
    denom2 = l2 * (2 * m1 + m2 - m2 * math.cos(2 * theta1 - 2 * theta2))

    omega1_dot = (
        -g * (2 * m1 + m2) * math.sin(theta1)
        - m2 * g * math.sin(theta1 - 2 * theta2)
        - 2 * sin_delta * m2 * (omega2**2 * l2 + omega1**2 * l1 * cos_delta)
    ) / denom1

    omega2_dot = (
        2
        * sin_delta
        * (
            omega1**2 * l1 * (m1 + m2)
            + g * (m1 + m2) * math.cos(theta1)
            + omega2**2 * l2 * m2 * cos_delta
        )
    ) / denom2

    return [omega1, omega2, omega1_dot, omega2_dot]


def vec_add(a: list[float], b: list[float], scale: float = 1.0) -> list[float]:
    return [x + scale * y for x, y in zip(a, b)]


def rk4_step(state: list[float], dt: float, params: PendulumParameters) -> list[float]:
    k1 = derivatives(state, params)
    k2 = derivatives(vec_add(state, k1, 0.5 * dt), params)
    k3 = derivatives(vec_add(state, k2, 0.5 * dt), params)
    k4 = derivatives(vec_add(state, k3, dt), params)

    out: list[float] = []
    for i in range(4):
        out.append(state[i] + dt * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]) / 6.0)
    return out


def wrap_angle_diff(diff: float) -> float:
    return (diff + math.pi) % (2 * math.pi) - math.pi


def phase_space_distance(a: list[float], b: list[float]) -> float:
    d1 = wrap_angle_diff(a[0] - b[0])
    d2 = wrap_angle_diff(a[1] - b[1])
    d3 = a[2] - b[2]
    d4 = a[3] - b[3]
    return math.sqrt(d1 * d1 + d2 * d2 + d3 * d3 + d4 * d4)


def simulate_trajectory(
    initial_state: list[float],
    params: PendulumParameters,
    dt: float,
    steps: int,
) -> list[list[float]]:
    states: list[list[float]] = [initial_state[:]]
    state = initial_state[:]
    for _ in range(steps):
        state = rk4_step(state, dt, params)
        states.append(state)
    return states


def first_divergence_time(
    base_traj: list[list[float]],
    perturbed_state: list[float],
    params: PendulumParameters,
    dt: float,
    threshold: float,
) -> float | None:
    perturbed = perturbed_state[:]
    for i, base_state in enumerate(base_traj):
        if i > 0:
            perturbed = rk4_step(perturbed, dt, params)
        dist = phase_space_distance(base_state, perturbed)
        if dist >= threshold:
            return i * dt
    return None


def estimate_lyapunov(
    times: list[float],
    distances: list[float],
    min_dist: float,
    max_dist: float,
) -> float:
    xs: list[float] = []
    ys: list[float] = []
    for t, d in zip(times, distances):
        if min_dist < d < max_dist:
            xs.append(t)
            ys.append(math.log(d))

    n = len(xs)
    if n < 8:
        raise RuntimeError("Insufficient points for Lyapunov fit; adjust fit window or tmax.")

    x_mean = sum(xs) / n
    y_mean = sum(ys) / n
    num = sum((x - x_mean) * (y - y_mean) for x, y in zip(xs, ys))
    den = sum((x - x_mean) ** 2 for x in xs)
    if den == 0:
        raise RuntimeError("Cannot estimate Lyapunov exponent (degenerate fit).")

    slope = num / den
    if slope <= 0:
        raise RuntimeError("Estimated Lyapunov exponent is non-positive.")
    return slope


def perturbation_grid(min_delta: float, max_delta: float, count: int) -> list[float]:
    if count == 1:
        return [min_delta]
    a = math.log10(min_delta)
    b = math.log10(max_delta)
    step = (b - a) / (count - 1)
    return [10 ** (a + i * step) for i in range(count)]


def write_results_csv(
    out_file: Path,
    deltas: Iterable[float],
    empirical: Iterable[float],
    predicted: Iterable[float],
) -> None:
    out_file.parent.mkdir(parents=True, exist_ok=True)
    with out_file.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["perturbation", "empirical_divergence_time", "predicted_divergence_time"])
        for row in zip(deltas, empirical, predicted):
            writer.writerow(row)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tmax", type=float, default=40.0)
    parser.add_argument("--dt", type=float, default=0.002)
    parser.add_argument("--divergence-threshold", type=float, default=1.0)
    parser.add_argument("--min-perturb", type=float, default=1e-8)
    parser.add_argument("--max-perturb", type=float, default=1e-2)
    parser.add_argument("--samples", type=int, default=20)
    parser.add_argument("--fit-min-dist", type=float, default=1e-6)
    parser.add_argument("--fit-max-dist", type=float, default=1e-2)
    parser.add_argument("--output-dir", type=Path, default=Path("outputs"))
    args = parser.parse_args()

    params = PendulumParameters()
    base_initial = [math.radians(120.0), math.radians(-10.0), 0.0, 0.0]

    steps = int(args.tmax / args.dt)
    times = [i * args.dt for i in range(steps + 1)]
    base_traj = simulate_trajectory(base_initial, params, args.dt, steps)

    ref_initial = base_initial[:]
    ref_initial[0] += 1e-9
    ref_distances: list[float] = []
    ref_state = ref_initial[:]
    for i in range(steps + 1):
        if i > 0:
            ref_state = rk4_step(ref_state, args.dt, params)
        ref_distances.append(phase_space_distance(base_traj[i], ref_state))

    lyapunov = estimate_lyapunov(times, ref_distances, args.fit_min_dist, args.fit_max_dist)

    perturbations = perturbation_grid(args.min_perturb, args.max_perturb, args.samples)
    empirical_times: list[float] = []
    predicted_times: list[float] = []

    for delta in perturbations:
        initial = base_initial[:]
        initial[0] += delta

        empirical_t = first_divergence_time(
            base_traj=base_traj,
            perturbed_state=initial,
            params=params,
            dt=args.dt,
            threshold=args.divergence_threshold,
        )
        empirical_times.append(float("nan") if empirical_t is None else empirical_t)
        predicted_times.append(math.log(args.divergence_threshold / delta) / lyapunov)

    out_dir = args.output_dir
    out_dir.mkdir(parents=True, exist_ok=True)
    csv_path = out_dir / "divergence_vs_perturbation.csv"
    write_results_csv(csv_path, perturbations, empirical_times, predicted_times)

    print(f"Estimated Lyapunov exponent: {lyapunov:.6f} 1/s")
    print(f"Wrote results CSV: {csv_path}")

    if HAS_MATPLOTLIB:
        fig, ax = plt.subplots(figsize=(8, 5))
        ax.semilogx(perturbations, empirical_times, "o", label="Empirical")
        ax.semilogx(perturbations, predicted_times, "-", label=f"Theory fit λ≈{lyapunov:.3f}")
        ax.set_xlabel("Initial perturbation magnitude (δ₀)")
        ax.set_ylabel("Divergence time (s)")
        ax.set_title("Double pendulum divergence time vs initial perturbation")
        ax.grid(True, which="both", alpha=0.3)
        ax.legend()
        fig.tight_layout()
        chart_path = out_dir / "divergence_comparison.png"
        fig.savefig(chart_path, dpi=150)

        fig2, ax2 = plt.subplots(figsize=(8, 5))
        ax2.plot(times, ref_distances)
        ax2.set_yscale("log")
        ax2.set_xlabel("Time (s)")
        ax2.set_ylabel("Phase-space separation")
        ax2.set_title("Reference perturbation growth used for Lyapunov fit")
        ax2.grid(True, which="both", alpha=0.3)
        fig2.tight_layout()
        growth_path = out_dir / "reference_growth.png"
        fig2.savefig(growth_path, dpi=150)

        print(f"Wrote comparison chart: {chart_path}")
        print(f"Wrote reference growth chart: {growth_path}")
    else:
        print("matplotlib is not installed; skipping chart generation.")


if __name__ == "__main__":
    main()
