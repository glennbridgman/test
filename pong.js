const canvas = document.getElementById('pong');
const ctx = canvas.getContext('2d');

const paddleWidth = 15;
const paddleHeight = 100;
const paddleSpeed = 5;

const leftPaddle = {
  x: 40,
  y: canvas.height / 2 - paddleHeight / 2,
  width: paddleWidth,
  height: paddleHeight,
};

const rightPaddle = {
  x: canvas.width - 55,
  y: canvas.height / 2 - paddleHeight / 2,
  width: paddleWidth,
  height: paddleHeight,
};

const ball = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  size: 16,
  dx: 6,
  dy: 6,
};

let playerScore = 0;
let aiScore = 0;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function resetBall(direction = 1) {
  ball.x = canvas.width / 2;
  ball.y = canvas.height / 2;
  ball.dx = 6 * direction;
  ball.dy = (Math.random() > 0.5 ? 1 : -1) * 6;
}

canvas.addEventListener('mousemove', (event) => {
  const rect = canvas.getBoundingClientRect();
  const mouseY = event.clientY - rect.top;
  leftPaddle.y = clamp(mouseY - leftPaddle.height / 2, 0, canvas.height - leftPaddle.height);
});

function update() {
  // AI paddle follows ball
  const targetY = ball.y - rightPaddle.height / 2;
  if (rightPaddle.y < targetY) {
    rightPaddle.y += paddleSpeed;
  } else if (rightPaddle.y > targetY) {
    rightPaddle.y -= paddleSpeed;
  }
  rightPaddle.y = clamp(rightPaddle.y, 0, canvas.height - rightPaddle.height);

  // Ball movement
  ball.x += ball.dx;
  ball.y += ball.dy;

  // Top / bottom collision
  if (ball.y - ball.size / 2 <= 0 || ball.y + ball.size / 2 >= canvas.height) {
    ball.dy *= -1;
  }

  // Paddle collision helper
  const ballRect = {
    left: ball.x - ball.size / 2,
    right: ball.x + ball.size / 2,
    top: ball.y - ball.size / 2,
    bottom: ball.y + ball.size / 2,
  };

  function collides(paddle) {
    return (
      ballRect.right >= paddle.x &&
      ballRect.left <= paddle.x + paddle.width &&
      ballRect.bottom >= paddle.y &&
      ballRect.top <= paddle.y + paddle.height
    );
  }

  if (collides(leftPaddle) && ball.dx < 0) {
    ball.dx *= -1;
    ball.x = leftPaddle.x + leftPaddle.width + ball.size / 2;
  }

  if (collides(rightPaddle) && ball.dx > 0) {
    ball.dx *= -1;
    ball.x = rightPaddle.x - ball.size / 2;
  }

  // Score & reset
  if (ball.x + ball.size / 2 < 0) {
    aiScore += 1;
    resetBall(1);
  }
  if (ball.x - ball.size / 2 > canvas.width) {
    playerScore += 1;
    resetBall(-1);
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Middle line
  ctx.strokeStyle = '#fff';
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, 0);
  ctx.lineTo(canvas.width / 2, canvas.height);
  ctx.stroke();
  ctx.setLineDash([]);

  // Paddles
  ctx.fillStyle = '#fff';
  ctx.fillRect(leftPaddle.x, leftPaddle.y, leftPaddle.width, leftPaddle.height);
  ctx.fillRect(rightPaddle.x, rightPaddle.y, rightPaddle.width, rightPaddle.height);

  // Ball
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.size / 2, 0, Math.PI * 2);
  ctx.fill();

  // Score
  ctx.font = '32px Arial';
  ctx.fillText(String(playerScore), canvas.width / 2 - 60, 50);
  ctx.fillText(String(aiScore), canvas.width / 2 + 40, 50);
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

resetBall(Math.random() > 0.5 ? 1 : -1);
gameLoop();
