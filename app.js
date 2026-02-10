const canvas = document.getElementById('plot');
const ctx = canvas.getContext('2d');

const totalPointsInput = document.getElementById('totalPoints');
const batchSizeInput = document.getElementById('batchSize');
const frameDelayInput = document.getElementById('frameDelay');
const frameDelayValue = document.getElementById('frameDelayValue');

const startButton = document.getElementById('startButton');
const pauseButton = document.getElementById('pauseButton');
const resetButton = document.getElementById('resetButton');

const samplesEl = document.getElementById('samples');
const insideEl = document.getElementById('inside');
const estimateEl = document.getElementById('estimate');
const errorEl = document.getElementById('error');

const state = {
  totalSamples: Number(totalPointsInput.value),
  batchSize: Number(batchSizeInput.value),
  frameDelay: Number(frameDelayInput.value),
  samples: 0,
  inside: 0,
  timer: null,
  running: false,
};

const PADDING = 30;
const PLOT_SIZE = canvas.width - PADDING * 2;

function drawBase() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#f8fbff';
  ctx.fillRect(PADDING, PADDING, PLOT_SIZE, PLOT_SIZE);

  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  ctx.strokeRect(PADDING, PADDING, PLOT_SIZE, PLOT_SIZE);

  ctx.beginPath();
  ctx.arc(PADDING, canvas.height - PADDING, PLOT_SIZE, Math.PI * 1.5, Math.PI * 2);
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#334155';
  ctx.font = '14px sans-serif';
  ctx.fillText('(0,0)', PADDING - 20, canvas.height - PADDING + 18);
  ctx.fillText('(1,1)', canvas.width - PADDING - 24, PADDING - 8);
}

function updateStats() {
  const estimate = state.samples === 0 ? 0 : (4 * state.inside) / state.samples;
  const error = Math.abs(Math.PI - estimate);

  samplesEl.textContent = state.samples.toLocaleString();
  insideEl.textContent = state.inside.toLocaleString();
  estimateEl.textContent = estimate.toFixed(6);
  errorEl.textContent = error.toFixed(6);
}

function plotPoint(x, y, inside) {
  const px = PADDING + x * PLOT_SIZE;
  const py = canvas.height - PADDING - y * PLOT_SIZE;

  ctx.fillStyle = inside ? 'rgba(22, 163, 74, 0.65)' : 'rgba(220, 38, 38, 0.65)';
  ctx.fillRect(px, py, 2, 2);
}

function sampleBatch() {
  const remaining = state.totalSamples - state.samples;
  if (remaining <= 0) {
    stopSimulation();
    return;
  }

  const count = Math.min(state.batchSize, remaining);

  for (let i = 0; i < count; i++) {
    const x = Math.random();
    const y = Math.random();
    const inCircle = x * x + y * y <= 1;

    state.samples += 1;
    if (inCircle) state.inside += 1;
    plotPoint(x, y, inCircle);
  }

  updateStats();

  if (state.samples >= state.totalSamples) {
    stopSimulation();
  }
}

function runLoop() {
  if (!state.running) return;
  sampleBatch();
  if (!state.running) return;
  state.timer = setTimeout(runLoop, state.frameDelay);
}

function stopSimulation() {
  state.running = false;
  clearTimeout(state.timer);
  state.timer = null;
  startButton.disabled = false;
  pauseButton.disabled = true;
  pauseButton.textContent = 'Pause';
}

function startSimulation() {
  if (state.running) return;
  if (state.samples >= state.totalSamples) return;

  state.running = true;
  startButton.disabled = true;
  pauseButton.disabled = false;
  runLoop();
}

function pauseSimulation() {
  if (!state.running) return;
  state.running = false;
  clearTimeout(state.timer);
  state.timer = null;
  startButton.disabled = false;
  pauseButton.textContent = 'Resume';
}

function resetSimulation() {
  state.totalSamples = Math.max(100, Number(totalPointsInput.value) || 50000);
  state.batchSize = Math.max(1, Number(batchSizeInput.value) || 300);
  state.frameDelay = Math.max(0, Number(frameDelayInput.value) || 16);
  state.samples = 0;
  state.inside = 0;
  stopSimulation();
  drawBase();
  updateStats();
}

startButton.addEventListener('click', () => {
  state.totalSamples = Math.max(100, Number(totalPointsInput.value) || 50000);
  state.batchSize = Math.max(1, Number(batchSizeInput.value) || 300);
  startSimulation();
});

pauseButton.addEventListener('click', () => {
  if (state.running) {
    pauseSimulation();
  } else {
    pauseButton.textContent = 'Pause';
    startSimulation();
  }
});

resetButton.addEventListener('click', resetSimulation);

frameDelayInput.addEventListener('input', () => {
  state.frameDelay = Number(frameDelayInput.value);
  frameDelayValue.value = String(state.frameDelay);
});

batchSizeInput.addEventListener('change', () => {
  state.batchSize = Math.max(1, Number(batchSizeInput.value) || 300);
});

totalPointsInput.addEventListener('change', () => {
  state.totalSamples = Math.max(100, Number(totalPointsInput.value) || 50000);
});

resetSimulation();
