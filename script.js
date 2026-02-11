const g = 9.81;
const pendulumCanvas = document.getElementById("pendulumCanvas");
const phaseCanvas = document.getElementById("phaseCanvas");
const pctx = pendulumCanvas.getContext("2d");
const phctx = phaseCanvas.getContext("2d");

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
};

const runs = [];
let isPaused = false;
let nextColor = 0;

function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

function sanitize(value, fallback, min = -Infinity, max = Infinity) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function createRunFromInputs() {
  const l1 = sanitize(controls.l1.value, 1, 0.05);
  const l2 = sanitize(controls.l2.value, 1, 0.05);
  const m1 = sanitize(controls.m1.value, 1, 0.05);
  const m2 = sanitize(controls.m2.value, 1, 0.05);
  const initialState = {
    theta1: degToRad(sanitize(controls.theta1.value, 120)),
    theta2: degToRad(sanitize(controls.theta2.value, -10)),
    omega1: sanitize(controls.omega1.value, 0),
    omega2: sanitize(controls.omega2.value, 0),
  };

  return {
    params: {
      l1,
      l2,
      m1,
      m2,
      dt: sanitize(controls.dt.value, 0.01, 0.001, 0.05),
    },
    state: { ...initialState },
    initialState,
    phaseTrace: [],
    pendulumTrace: [],
    color: palette[nextColor++ % palette.length],
    steps: 0,
  };
}

function seedRunTraces(run) {
  run.phaseTrace.length = 0;
  run.pendulumTrace.length = 0;
  for (let i = 0; i < 4; i += 1) {
    updateRunTrails(run);
  }
}

function resetRunToInitial(run) {
  run.state = { ...run.initialState };
  run.steps = 0;
  seedRunTraces(run);
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

function stepSystem() {
  if (!isPaused) {
    const substeps = sanitize(controls.substeps.value, 3, 1, 30);
    for (let i = 0; i < substeps; i += 1) {
      for (const run of runs) {
        rk4Step(run);
        updateRunTrails(run);
      }
    }
  }

  drawPendulumPanel();
  drawPhasePanel();
  requestAnimationFrame(stepSystem);
}

function addRun() {
  const run = createRunFromInputs();
  runs.push(run);

  for (const activeRun of runs) {
    resetRunToInitial(activeRun);
  }
}

document.getElementById("addRun").addEventListener("click", addRun);
document.getElementById("clearRuns").addEventListener("click", () => {
  runs.length = 0;
});
document.getElementById("pauseResume").addEventListener("click", (event) => {
  isPaused = !isPaused;
  event.currentTarget.textContent = isPaused ? "Resume" : "Pause";
});
controls.phaseMode.addEventListener("change", drawPhasePanel);

addRun();
stepSystem();
