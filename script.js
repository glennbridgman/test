const g = 9.81;
const pendulumCanvas = document.getElementById("pendulumCanvas");
const phaseCanvas = document.getElementById("phaseCanvas");
const divergenceCanvas = document.getElementById("divergenceCanvas");
const pctx = pendulumCanvas.getContext("2d");
const phctx = phaseCanvas.getContext("2d");
const dctx = divergenceCanvas.getContext("2d");

const palette = [
  "#ff6b6b",
  "#4dd0e1",
  "#ffd166",
  "#95e06c",
  "#c792ea",
  "#ff8fab",
  "#72efdd",
  "#f4a261",
];

const controls = {
  theta1: document.getElementById("theta1"),
  theta2: document.getElementById("theta2"),
  omega1: document.getElementById("omega1"),
  omega2: document.getElementById("omega2"),
  l1: document.getElementById("l1"),
  l2: document.getElementById("l2"),
  m1: document.getElementById("m1"),
  m2: document.getElementById("m2"),
  dt: document.getElementById("dt"),
  substeps: document.getElementById("substeps"),
  phaseMode: document.getElementById("phaseMode"),
  perturbation: document.getElementById("perturbation"),
  divergenceThreshold: document.getElementById("divergenceThreshold"),
  lyapunov: document.getElementById("lyapunov"),
};

const runs = [];
const divergenceResults = [];
let isPaused = false;
let nextColor = 0;
let nextRunId = 1;

function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

function sanitize(value, fallback, min = -Infinity, max = Infinity) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function wrapAngle(angle) {
  const twopi = 2 * Math.PI;
  let wrapped = ((angle + Math.PI) % twopi + twopi) % twopi - Math.PI;
  if (!Number.isFinite(wrapped)) wrapped = 0;
  return wrapped;
}

function createRunFromInputs(options = {}) {
  const l1 = sanitize(controls.l1.value, 1, 0.05);
  const l2 = sanitize(controls.l2.value, 1, 0.05);
  const m1 = sanitize(controls.m1.value, 1, 0.05);
  const m2 = sanitize(controls.m2.value, 1, 0.05);

  const baseTheta1 = degToRad(sanitize(controls.theta1.value, 120));
  const params = {
    l1,
    l2,
    m1,
    m2,
    dt: sanitize(controls.dt.value, 0.01, 0.001, 0.05),
    divergenceThreshold: sanitize(controls.divergenceThreshold.value, 1.4, 0.01, 20),
    lyapunov: sanitize(controls.lyapunov.value, 1, 0.01, 5),
  };

  const initialState = {
    theta1: options.theta1 ?? baseTheta1,
    theta2: options.theta2 ?? degToRad(sanitize(controls.theta2.value, -10)),
    omega1: options.omega1 ?? sanitize(controls.omega1.value, 0),
    omega2: options.omega2 ?? sanitize(controls.omega2.value, 0),
  };

  const run = {
    id: nextRunId++,
    params,
    initialState: { ...initialState },
    state: { ...initialState },
    phaseTrace: [],
    pendulumTrace: [],
    color: palette[nextColor++ % palette.length],
    steps: 0,
    role: options.role ?? "generic",
    perturbationDeg: options.perturbationDeg ?? null,
    baselineId: options.baselineId ?? null,
    divergedAtTime: null,
    divergenceDistance: null,
    label: options.label ?? `Run ${nextRunId - 1}`,
  };

  return run;
}

function derivatives({ theta1, theta2, omega1, omega2 }, { l1, l2, m1, m2 }) {
  const delta = theta1 - theta2;
  const sinDelta = Math.sin(delta);
  const cosDelta = Math.cos(delta);

  const den1 = l1 * (2 * m1 + m2 - m2 * Math.cos(2 * delta));
  const den2 = l2 * (2 * m1 + m2 - m2 * Math.cos(2 * delta));

  const alpha1 =
    (-g * (2 * m1 + m2) * Math.sin(theta1) -
      m2 * g * Math.sin(theta1 - 2 * theta2) -
      2 * sinDelta * m2 * (omega2 * omega2 * l2 + omega1 * omega1 * l1 * cosDelta)) /
    den1;

  const alpha2 =
    (2 *
      sinDelta *
      (omega1 * omega1 * l1 * (m1 + m2) +
        g * (m1 + m2) * Math.cos(theta1) +
        omega2 * omega2 * l2 * m2 * cosDelta)) /
    den2;

  return {
    dTheta1: omega1,
    dTheta2: omega2,
    dOmega1: alpha1,
    dOmega2: alpha2,
  };
}

function rk4Step(run) {
  const { state, params } = run;
  const dt = params.dt;

  const k1 = derivatives(state, params);

  const s2 = {
    theta1: state.theta1 + 0.5 * dt * k1.dTheta1,
    theta2: state.theta2 + 0.5 * dt * k1.dTheta2,
    omega1: state.omega1 + 0.5 * dt * k1.dOmega1,
    omega2: state.omega2 + 0.5 * dt * k1.dOmega2,
  };
  const k2 = derivatives(s2, params);

  const s3 = {
    theta1: state.theta1 + 0.5 * dt * k2.dTheta1,
    theta2: state.theta2 + 0.5 * dt * k2.dTheta2,
    omega1: state.omega1 + 0.5 * dt * k2.dOmega1,
    omega2: state.omega2 + 0.5 * dt * k2.dOmega2,
  };
  const k3 = derivatives(s3, params);

  const s4 = {
    theta1: state.theta1 + dt * k3.dTheta1,
    theta2: state.theta2 + dt * k3.dTheta2,
    omega1: state.omega1 + dt * k3.dOmega1,
    omega2: state.omega2 + dt * k3.dOmega2,
  };
  const k4 = derivatives(s4, params);

  state.theta1 += (dt / 6) * (k1.dTheta1 + 2 * k2.dTheta1 + 2 * k3.dTheta1 + k4.dTheta1);
  state.theta2 += (dt / 6) * (k1.dTheta2 + 2 * k2.dTheta2 + 2 * k3.dTheta2 + k4.dTheta2);
  state.omega1 += (dt / 6) * (k1.dOmega1 + 2 * k2.dOmega1 + 2 * k3.dOmega1 + k4.dOmega1);
  state.omega2 += (dt / 6) * (k1.dOmega2 + 2 * k2.dOmega2 + 2 * k3.dOmega2 + k4.dOmega2);

  run.steps += 1;
}

function updateRunTrails(run) {
  const { theta1, theta2, omega1, omega2 } = run.state;
  const { l1, l2 } = run.params;

  const x1 = l1 * Math.sin(theta1);
  const y1 = l1 * Math.cos(theta1);
  const x2 = x1 + l2 * Math.sin(theta2);
  const y2 = y1 + l2 * Math.cos(theta2);

  run.pendulumTrace.push({ x2, y2 });
  run.phaseTrace.push({ theta1, theta2, omega1, omega2 });

  if (run.pendulumTrace.length > 500) run.pendulumTrace.shift();
  if (run.phaseTrace.length > 2500) run.phaseTrace.shift();
}

function drawPendulumPanel() {
  const w = pendulumCanvas.width;
  const h = pendulumCanvas.height;
  pctx.clearRect(0, 0, w, h);

  pctx.fillStyle = "#04070c";
  pctx.fillRect(0, 0, w, h);

  const origin = { x: w * 0.5, y: h * 0.2 };
  const maxLen = Math.max(...runs.map((r) => r.params.l1 + r.params.l2), 2);
  const scale = (h * 0.68) / maxLen;

  pctx.strokeStyle = "#2a2f37";
  pctx.beginPath();
  pctx.moveTo(origin.x - 18, origin.y);
  pctx.lineTo(origin.x + 18, origin.y);
  pctx.stroke();

  for (const run of runs) {
    const { theta1, theta2 } = run.state;
    const { l1, l2 } = run.params;

    const x1 = origin.x + l1 * Math.sin(theta1) * scale;
    const y1 = origin.y + l1 * Math.cos(theta1) * scale;
    const x2 = x1 + l2 * Math.sin(theta2) * scale;
    const y2 = y1 + l2 * Math.cos(theta2) * scale;

    pctx.strokeStyle = `${run.color}66`;
    pctx.lineWidth = 1.5;
    pctx.beginPath();
    for (let i = 0; i < run.pendulumTrace.length; i += 1) {
      const point = run.pendulumTrace[i];
      const tx = origin.x + point.x * scale;
      const ty = origin.y + point.y * scale;
      if (i === 0) pctx.moveTo(tx, ty);
      else pctx.lineTo(tx, ty);
    }
    pctx.stroke();

    pctx.strokeStyle = run.color;
    pctx.lineWidth = 2;
    pctx.beginPath();
    pctx.moveTo(origin.x, origin.y);
    pctx.lineTo(x1, y1);
    pctx.lineTo(x2, y2);
    pctx.stroke();

    pctx.fillStyle = run.color;
    pctx.beginPath();
    pctx.arc(x1, y1, 7, 0, Math.PI * 2);
    pctx.fill();
    pctx.beginPath();
    pctx.arc(x2, y2, 8.5, 0, Math.PI * 2);
    pctx.fill();
  }

  pctx.fillStyle = "#9da7b3";
  pctx.font = "13px system-ui";
  pctx.fillText(`Active runs: ${runs.length}`, 12, h - 14);
}

function readPhasePoint(mode, point) {
  switch (mode) {
    case "theta2-omega2":
      return { x: point.theta2, y: point.omega2, xLabel: "θ₂", yLabel: "ω₂" };
    case "theta1-theta2":
      return { x: point.theta1, y: point.theta2, xLabel: "θ₁", yLabel: "θ₂" };
    case "theta1-omega1":
    default:
      return { x: point.theta1, y: point.omega1, xLabel: "θ₁", yLabel: "ω₁" };
  }
}

function drawPhasePanel() {
  const w = phaseCanvas.width;
  const h = phaseCanvas.height;
  phctx.clearRect(0, 0, w, h);

  phctx.fillStyle = "#04070c";
  phctx.fillRect(0, 0, w, h);

  const padding = 42;
  const mode = controls.phaseMode.value;

  const points = [];
  for (const run of runs) {
    for (const point of run.phaseTrace) {
      points.push({ run, ...readPhasePoint(mode, point) });
    }
  }

  let xMin = -Math.PI;
  let xMax = Math.PI;
  let yMin = -10;
  let yMax = 10;
  let labels = { x: "θ₁", y: "ω₁" };

  if (points.length > 0) {
    xMin = Math.min(...points.map((p) => p.x));
    xMax = Math.max(...points.map((p) => p.x));
    yMin = Math.min(...points.map((p) => p.y));
    yMax = Math.max(...points.map((p) => p.y));
    labels = { x: points[0].xLabel, y: points[0].yLabel };
  }

  const xPad = (xMax - xMin) * 0.12 + 1e-6;
  const yPad = (yMax - yMin) * 0.12 + 1e-6;
  xMin -= xPad;
  xMax += xPad;
  yMin -= yPad;
  yMax += yPad;

  const plotW = w - 2 * padding;
  const plotH = h - 2 * padding;

  const toX = (x) => padding + ((x - xMin) / (xMax - xMin)) * plotW;
  const toY = (y) => h - padding - ((y - yMin) / (yMax - yMin)) * plotH;

  phctx.strokeStyle = "#27303b";
  phctx.lineWidth = 1;
  phctx.strokeRect(padding, padding, plotW, plotH);

  const x0Visible = xMin < 0 && xMax > 0;
  const y0Visible = yMin < 0 && yMax > 0;
  if (x0Visible) {
    phctx.beginPath();
    phctx.moveTo(toX(0), padding);
    phctx.lineTo(toX(0), h - padding);
    phctx.stroke();
  }
  if (y0Visible) {
    phctx.beginPath();
    phctx.moveTo(padding, toY(0));
    phctx.lineTo(w - padding, toY(0));
    phctx.stroke();
  }

  for (const run of runs) {
    if (run.phaseTrace.length < 2) continue;
    phctx.strokeStyle = `${run.color}b3`;
    phctx.lineWidth = 1.15;
    phctx.beginPath();
    for (let i = 0; i < run.phaseTrace.length; i += 1) {
      const mapped = readPhasePoint(mode, run.phaseTrace[i]);
      const x = toX(mapped.x);
      const y = toY(mapped.y);
      if (i === 0) phctx.moveTo(x, y);
      else phctx.lineTo(x, y);
    }
    phctx.stroke();
  }

  phctx.fillStyle = "#9da7b3";
  phctx.font = "13px system-ui";
  phctx.fillText(`${labels.x} (rad)`, w / 2 - 24, h - 10);

  phctx.save();
  phctx.translate(14, h / 2 + 24);
  phctx.rotate(-Math.PI / 2);
  phctx.fillText(`${labels.y} (${labels.y.includes("ω") ? "rad/s" : "rad"})`, 0, 0);
  phctx.restore();
}

function measuredDistance(a, b) {
  const dTheta1 = wrapAngle(a.theta1 - b.theta1);
  const dTheta2 = wrapAngle(a.theta2 - b.theta2);
  const dOmega1 = a.omega1 - b.omega1;
  const dOmega2 = a.omega2 - b.omega2;
  return Math.hypot(dTheta1, dTheta2, dOmega1 * 0.2, dOmega2 * 0.2);
}

function evaluateDivergence() {
  const baseline = runs[0];
  if (!baseline) return;

  for (let i = 1; i < runs.length; i += 1) {
    const run = runs[i];
    if (run.role !== "perturbation" || run.baselineId !== baseline.id || run.divergedAtTime !== null) {
      continue;
    }

    const distance = measuredDistance(run.state, baseline.state);
    run.divergenceDistance = distance;

    if (distance >= run.params.divergenceThreshold) {
      run.divergedAtTime = run.steps * run.params.dt;
      divergenceResults.push({
        perturbationDeg: run.perturbationDeg,
        divergenceTime: run.divergedAtTime,
        predictedTime: predictedDivergenceTime(run.perturbationDeg, run.params),
        color: run.color,
      });
    }
  }
}

function predictedDivergenceTime(perturbationDeg, params) {
  const delta0 = degToRad(Math.abs(perturbationDeg));
  if (delta0 <= 0) return 0;
  const threshold = params.divergenceThreshold;
  const lambda = params.lyapunov;
  return Math.max(0, Math.log(threshold / delta0) / lambda);
}

function drawDivergencePanel() {
  const w = divergenceCanvas.width;
  const h = divergenceCanvas.height;
  dctx.clearRect(0, 0, w, h);
  dctx.fillStyle = "#04070c";
  dctx.fillRect(0, 0, w, h);

  const padding = { left: 60, right: 20, top: 24, bottom: 46 };
  const plotW = w - padding.left - padding.right;
  const plotH = h - padding.top - padding.bottom;

  const active = [...divergenceResults].sort((a, b) => a.perturbationDeg - b.perturbationDeg);
  const xValues = active.map((d) => d.perturbationDeg);
  const yValues = active.flatMap((d) => [d.divergenceTime, d.predictedTime]);

  let xMin = 0;
  let xMax = Math.max(1, sanitize(controls.perturbation.value, 0.1, 0.0001));
  let yMin = 0;
  let yMax = 1;

  if (xValues.length > 0) {
    xMin = Math.min(...xValues) * 0.9;
    xMax = Math.max(...xValues) * 1.1;
    yMax = Math.max(...yValues) * 1.2;
  }

  const safeX = (xMax - xMin) || 1;
  const safeY = (yMax - yMin) || 1;
  const toX = (x) => padding.left + ((x - xMin) / safeX) * plotW;
  const toY = (y) => h - padding.bottom - ((y - yMin) / safeY) * plotH;

  dctx.strokeStyle = "#27303b";
  dctx.strokeRect(padding.left, padding.top, plotW, plotH);

  if (active.length > 1) {
    dctx.strokeStyle = "#58a6ff";
    dctx.lineWidth = 2;
    dctx.beginPath();
    active.forEach((point, idx) => {
      const x = toX(point.perturbationDeg);
      const y = toY(point.predictedTime);
      if (idx === 0) dctx.moveTo(x, y);
      else dctx.lineTo(x, y);
    });
    dctx.stroke();
  }

  active.forEach((point) => {
    dctx.fillStyle = point.color;
    dctx.beginPath();
    dctx.arc(toX(point.perturbationDeg), toY(point.divergenceTime), 4.5, 0, Math.PI * 2);
    dctx.fill();
  });

  dctx.fillStyle = "#9da7b3";
  dctx.font = "13px system-ui";
  dctx.fillText("Perturbation Δθ₁ (deg)", w / 2 - 70, h - 12);
  dctx.save();
  dctx.translate(18, h / 2 + 34);
  dctx.rotate(-Math.PI / 2);
  dctx.fillText("Time to divergence (s)", 0, 0);
  dctx.restore();

  dctx.fillText("Blue line: t ≈ (1/λ) ln(Δ*/Δ0)   Colored dots: measured divergence", padding.left + 4, 18);

  const baseline = runs[0];
  if (baseline) {
    dctx.fillText(
      `Baseline run id ${baseline.id} | threshold=${baseline.params.divergenceThreshold.toFixed(2)} | λ=${baseline.params.lyapunov.toFixed(2)} 1/s`,
      padding.left + 4,
      h - 28,
    );
  }
}

function stepSystem() {
  if (!isPaused) {
    const substeps = sanitize(controls.substeps.value, 3, 1, 30);
    for (let i = 0; i < substeps; i += 1) {
      for (const run of runs) {
        rk4Step(run);
        updateRunTrails(run);
      }
      evaluateDivergence();
    }
  }

  drawPendulumPanel();
  drawPhasePanel();
  drawDivergencePanel();
  requestAnimationFrame(stepSystem);
}

function addRun() {
  const run = createRunFromInputs({ role: runs.length === 0 ? "baseline" : "generic" });
  for (let i = 0; i < 4; i += 1) updateRunTrails(run);
  runs.push(run);
}

function addPerturbationRun() {
  if (runs.length === 0) {
    addRun();
    return;
  }

  const baseline = runs[0];
  const deltaDeg = sanitize(controls.perturbation.value, 0.1, 0.0001, 30);
  const deltaRad = degToRad(deltaDeg);

  const run = createRunFromInputs({
    theta1: baseline.initialState.theta1 + deltaRad,
    theta2: baseline.initialState.theta2,
    omega1: baseline.initialState.omega1,
    omega2: baseline.initialState.omega2,
    role: "perturbation",
    perturbationDeg: deltaDeg,
    baselineId: baseline.id,
    label: `Δθ₁=${deltaDeg.toFixed(3)}°`,
  });

  run.params.l1 = baseline.params.l1;
  run.params.l2 = baseline.params.l2;
  run.params.m1 = baseline.params.m1;
  run.params.m2 = baseline.params.m2;
  run.params.dt = baseline.params.dt;
  run.params.divergenceThreshold = baseline.params.divergenceThreshold;
  run.params.lyapunov = baseline.params.lyapunov;

  for (let i = 0; i < 4; i += 1) updateRunTrails(run);
  runs.push(run);
}

function clearAll() {
  runs.length = 0;
  divergenceResults.length = 0;
  nextColor = 0;
  nextRunId = 1;
}

document.getElementById("addRun").addEventListener("click", addRun);
document.getElementById("addPerturbation").addEventListener("click", addPerturbationRun);
document.getElementById("clearRuns").addEventListener("click", clearAll);
document.getElementById("pauseResume").addEventListener("click", (event) => {
  isPaused = !isPaused;
  event.currentTarget.textContent = isPaused ? "Resume" : "Pause";
});
controls.phaseMode.addEventListener("change", drawPhasePanel);

addRun();
stepSystem();
