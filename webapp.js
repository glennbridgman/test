function derivatives(state, p) {
  const [theta1, theta2, omega1, omega2] = state;
  const { m1, m2, l1, l2, g } = p;
  const delta = theta1 - theta2;
  const sinDelta = Math.sin(delta);
  const cosDelta = Math.cos(delta);
  const denom = 2 * m1 + m2 - m2 * Math.cos(2 * theta1 - 2 * theta2);

  const omega1Dot = (
    -g * (2 * m1 + m2) * Math.sin(theta1)
    - m2 * g * Math.sin(theta1 - 2 * theta2)
    - 2 * sinDelta * m2 * (omega2 ** 2 * l2 + omega1 ** 2 * l1 * cosDelta)
  ) / (l1 * denom);

  const omega2Dot = (
    2 * sinDelta * (
      omega1 ** 2 * l1 * (m1 + m2)
      + g * (m1 + m2) * Math.cos(theta1)
      + omega2 ** 2 * l2 * m2 * cosDelta
    )
  ) / (l2 * denom);

  return [omega1, omega2, omega1Dot, omega2Dot];
}

function addScaled(a, b, scale) {
  return a.map((x, i) => x + scale * b[i]);
}

function rk4Step(state, dt, p) {
  const k1 = derivatives(state, p);
  const k2 = derivatives(addScaled(state, k1, 0.5 * dt), p);
  const k3 = derivatives(addScaled(state, k2, 0.5 * dt), p);
  const k4 = derivatives(addScaled(state, k3, dt), p);
  return state.map((x, i) => x + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}

function wrapAngle(diff) {
  return ((diff + Math.PI) % (2 * Math.PI)) - Math.PI;
}

function phaseDistance(a, b) {
  const d1 = wrapAngle(a[0] - b[0]);
  const d2 = wrapAngle(a[1] - b[1]);
  const d3 = a[2] - b[2];
  const d4 = a[3] - b[3];
  return Math.sqrt(d1 * d1 + d2 * d2 + d3 * d3 + d4 * d4);
}

function logspace(min, max, n) {
  const a = Math.log10(min);
  const b = Math.log10(max);
  return Array.from({ length: n }, (_, i) => 10 ** (a + (i * (b - a)) / (n - 1)));
}

function estimateLyapunov(times, dists, minD, maxD) {
  const pts = times
    .map((t, i) => [t, dists[i]])
    .filter(([, d]) => d > minD && d < maxD)
    .map(([t, d]) => [t, Math.log(d)]);

  if (pts.length < 8) throw new Error("Not enough fit points; widen fit range or increase tmax.");

  const xMean = pts.reduce((s, [x]) => s + x, 0) / pts.length;
  const yMean = pts.reduce((s, [, y]) => s + y, 0) / pts.length;
  const num = pts.reduce((s, [x, y]) => s + (x - xMean) * (y - yMean), 0);
  const den = pts.reduce((s, [x]) => s + (x - xMean) ** 2, 0);
  const slope = num / den;
  if (!(slope > 0)) throw new Error("Estimated Lyapunov exponent is non-positive.");
  return slope;
}

function drawAxes(ctx, { x, y, w, h, xlabel, ylabel, title }) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = "#111";
  ctx.font = "16px sans-serif";
  ctx.fillText(title, x, y - 20);
  ctx.strokeStyle = "#444";
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + h);
  ctx.stroke();
  ctx.font = "13px sans-serif";
  ctx.fillText(xlabel, x + w / 2 - 60, y + h + 30);
  ctx.save();
  ctx.translate(x - 45, y + h / 2 + 60);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(ylabel, 0, 0);
  ctx.restore();
}

function plotSemilogX(canvas, xVals, series, options) {
  const ctx = canvas.getContext("2d");
  const pad = { left: 80, right: 25, top: 55, bottom: 55 };
  const w = canvas.width - pad.left - pad.right;
  const h = canvas.height - pad.top - pad.bottom;

  const xMin = Math.min(...xVals);
  const xMax = Math.max(...xVals);
  const yAll = series.flatMap((s) => s.y.filter((v) => Number.isFinite(v)));
  const yMin = Math.min(...yAll);
  const yMax = Math.max(...yAll);

  drawAxes(ctx, {
    x: pad.left,
    y: pad.top,
    w,
    h,
    xlabel: options.xlabel,
    ylabel: options.ylabel,
    title: options.title,
  });

  const mapX = (v) => pad.left + ((Math.log10(v) - Math.log10(xMin)) / (Math.log10(xMax) - Math.log10(xMin))) * w;
  const mapY = (v) => pad.top + h - ((v - yMin) / (yMax - yMin)) * h;

  series.forEach((s) => {
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = 2;
    if (s.line) {
      ctx.beginPath();
      s.y.forEach((yv, i) => {
        if (!Number.isFinite(yv)) return;
        const px = mapX(xVals[i]);
        const py = mapY(yv);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    }
    if (s.points) {
      s.y.forEach((yv, i) => {
        if (!Number.isFinite(yv)) return;
        const px = mapX(xVals[i]);
        const py = mapY(yv);
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  });
}

function plotLogY(canvas, xVals, yVals, options) {
  const ctx = canvas.getContext("2d");
  const pad = { left: 80, right: 25, top: 55, bottom: 55 };
  const w = canvas.width - pad.left - pad.right;
  const h = canvas.height - pad.top - pad.bottom;

  const yFiltered = yVals.filter((v) => v > 0 && Number.isFinite(v));
  const yMin = Math.min(...yFiltered);
  const yMax = Math.max(...yFiltered);
  const xMin = xVals[0];
  const xMax = xVals[xVals.length - 1];

  drawAxes(ctx, {
    x: pad.left,
    y: pad.top,
    w,
    h,
    xlabel: options.xlabel,
    ylabel: options.ylabel,
    title: options.title,
  });

  const mapX = (v) => pad.left + ((v - xMin) / (xMax - xMin)) * w;
  const mapY = (v) => pad.top + h - ((Math.log10(v) - Math.log10(yMin)) / (Math.log10(yMax) - Math.log10(yMin))) * h;

  ctx.strokeStyle = "#0b7";
  ctx.lineWidth = 2;
  ctx.beginPath();
  yVals.forEach((yv, i) => {
    if (!(yv > 0)) return;
    const px = mapX(xVals[i]);
    const py = mapY(yv);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();
}

function toCsv(rows) {
  return rows.map((r) => r.map((v) => (Number.isNaN(v) ? "" : String(v))).join(",")).join("\n");
}

async function runSimulation() {
  const status = document.getElementById("status");
  const runBtn = document.getElementById("runBtn");
  const summary = document.getElementById("summary");

  const tmax = Number(document.getElementById("tmax").value);
  const dt = Number(document.getElementById("dt").value);
  const threshold = Number(document.getElementById("threshold").value);
  const minPert = Number(document.getElementById("minPert").value);
  const maxPert = Number(document.getElementById("maxPert").value);
  const samples = Number(document.getElementById("samples").value);
  const fitMin = Number(document.getElementById("fitMin").value);
  const fitMax = Number(document.getElementById("fitMax").value);

  const p = { m1: 1, m2: 1, l1: 1, l2: 1, g: 9.81 };
  const base0 = [(120 * Math.PI) / 180, (-10 * Math.PI) / 180, 0, 0];
  const steps = Math.floor(tmax / dt);

  runBtn.disabled = true;
  status.textContent = "Computing baseline trajectory...";

  try {
    const baseTraj = [base0.slice()];
    let s = base0.slice();
    for (let i = 0; i < steps; i++) {
      s = rk4Step(s, dt, p);
      baseTraj.push(s);
    }

    const times = Array.from({ length: steps + 1 }, (_, i) => i * dt);

    status.textContent = "Estimating Lyapunov exponent...";
    const ref0 = base0.slice();
    ref0[0] += 1e-9;
    let ref = ref0.slice();
    const refDists = [];
    for (let i = 0; i <= steps; i++) {
      if (i > 0) ref = rk4Step(ref, dt, p);
      refDists.push(phaseDistance(baseTraj[i], ref));
    }

    const lambda = estimateLyapunov(times, refDists, fitMin, fitMax);
    const deltas = logspace(minPert, maxPert, samples);

    status.textContent = "Sweeping perturbations...";
    const empirical = [];
    const predicted = [];

    deltas.forEach((delta) => {
      const init = base0.slice();
      init[0] += delta;
      let pert = init.slice();
      let tDiv = NaN;
      for (let i = 0; i <= steps; i++) {
        if (i > 0) pert = rk4Step(pert, dt, p);
        if (phaseDistance(baseTraj[i], pert) >= threshold) {
          tDiv = i * dt;
          break;
        }
      }
      empirical.push(tDiv);
      predicted.push(Math.log(threshold / delta) / lambda);
    });

    plotSemilogX(
      document.getElementById("comparisonPlot"),
      deltas,
      [
        { y: empirical, color: "#1f5fe0", points: true, line: false },
        { y: predicted, color: "#d62728", points: false, line: true },
      ],
      {
        title: `Divergence vs Perturbation (λ ≈ ${lambda.toFixed(3)} 1/s)`,
        xlabel: "Initial perturbation δ₀ (log scale)",
        ylabel: "Divergence time (s)",
      }
    );

    plotLogY(document.getElementById("growthPlot"), times, refDists, {
      title: "Reference Perturbation Growth",
      xlabel: "Time (s)",
      ylabel: "Phase-space separation (log scale)",
    });

    const tbody = document.querySelector("#resultsTable tbody");
    tbody.innerHTML = "";
    deltas.forEach((d, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${d.toExponential(3)}</td><td>${Number.isNaN(empirical[i]) ? "not diverged" : empirical[i].toFixed(4)}</td><td>${predicted[i].toFixed(4)}</td>`;
      tbody.appendChild(tr);
    });

    const csvRows = [["perturbation", "empirical_divergence_time", "predicted_divergence_time"]];
    deltas.forEach((d, i) => csvRows.push([d, empirical[i], predicted[i]]));
    const blob = new Blob([toCsv(csvRows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    document.getElementById("downloadCsv").href = url;

    summary.textContent = `Estimated Lyapunov exponent λ ≈ ${lambda.toFixed(6)} 1/s.`;
    status.textContent = "Done.";
  } catch (err) {
    status.textContent = `Error: ${err.message}`;
  } finally {
    runBtn.disabled = false;
  }
}

document.getElementById("runBtn").addEventListener("click", runSimulation);
