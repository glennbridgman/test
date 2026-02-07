const boardEl = document.getElementById("board");
const statusEl = document.getElementById("status");
const restartBtn = document.getElementById("restartBtn");

const UNICORNS = "unicorn";
const GOBLINS = "goblin";

const symbols = {
  [UNICORNS]: {
    king: "🦄K",
    queen: "🦄Q",
    rook: "🦄R",
    bishop: "🦄B",
    knight: "🦄N",
    pawn: "🦄P",
  },
  [GOBLINS]: {
    king: "👺K",
    queen: "👺Q",
    rook: "👺R",
    bishop: "👺B",
    knight: "👺N",
    pawn: "👺P",
  },
};

let board = [];
let selected = null;
let legalTargets = [];
let currentTurn = UNICORNS;
let gameOver = false;

function makePiece(team, type) {
  return { team, type };
}

function setupBoard() {
  board = Array.from({ length: 8 }, () => Array(8).fill(null));

  board[0] = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"].map((t) => makePiece(GOBLINS, t));
  board[1] = Array(8).fill(null).map(() => makePiece(GOBLINS, "pawn"));
  board[6] = Array(8).fill(null).map(() => makePiece(UNICORNS, "pawn"));
  board[7] = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"].map((t) => makePiece(UNICORNS, t));

  selected = null;
  legalTargets = [];
  currentTurn = UNICORNS;
  gameOver = false;
  render();
  setStatus("Your turn (Unicorns)");
}

function isInside(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function isEmpty(r, c) {
  return isInside(r, c) && board[r][c] === null;
}

function enemyAt(r, c, team) {
  return isInside(r, c) && board[r][c] && board[r][c].team !== team;
}

function pushSlidingMoves(moves, r, c, dr, dc, team) {
  let nr = r + dr;
  let nc = c + dc;
  while (isInside(nr, nc)) {
    if (!board[nr][nc]) {
      moves.push([nr, nc]);
    } else {
      if (board[nr][nc].team !== team) {
        moves.push([nr, nc]);
      }
      break;
    }
    nr += dr;
    nc += dc;
  }
}

function getMoves(r, c) {
  const piece = board[r][c];
  if (!piece) return [];

  const moves = [];
  const dir = piece.team === UNICORNS ? -1 : 1;

  switch (piece.type) {
    case "pawn": {
      const startRow = piece.team === UNICORNS ? 6 : 1;
      if (isEmpty(r + dir, c)) {
        moves.push([r + dir, c]);
        if (r === startRow && isEmpty(r + dir * 2, c)) {
          moves.push([r + dir * 2, c]);
        }
      }
      for (const dc of [-1, 1]) {
        const tr = r + dir;
        const tc = c + dc;
        if (enemyAt(tr, tc, piece.team)) {
          moves.push([tr, tc]);
        }
      }
      break;
    }
    case "knight": {
      const jumps = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1],
      ];
      for (const [dr, dc] of jumps) {
        const nr = r + dr;
        const nc = c + dc;
        if (!isInside(nr, nc)) continue;
        if (!board[nr][nc] || board[nr][nc].team !== piece.team) {
          moves.push([nr, nc]);
        }
      }
      break;
    }
    case "bishop":
      pushSlidingMoves(moves, r, c, -1, -1, piece.team);
      pushSlidingMoves(moves, r, c, -1, 1, piece.team);
      pushSlidingMoves(moves, r, c, 1, -1, piece.team);
      pushSlidingMoves(moves, r, c, 1, 1, piece.team);
      break;
    case "rook":
      pushSlidingMoves(moves, r, c, -1, 0, piece.team);
      pushSlidingMoves(moves, r, c, 1, 0, piece.team);
      pushSlidingMoves(moves, r, c, 0, -1, piece.team);
      pushSlidingMoves(moves, r, c, 0, 1, piece.team);
      break;
    case "queen":
      pushSlidingMoves(moves, r, c, -1, -1, piece.team);
      pushSlidingMoves(moves, r, c, -1, 1, piece.team);
      pushSlidingMoves(moves, r, c, 1, -1, piece.team);
      pushSlidingMoves(moves, r, c, 1, 1, piece.team);
      pushSlidingMoves(moves, r, c, -1, 0, piece.team);
      pushSlidingMoves(moves, r, c, 1, 0, piece.team);
      pushSlidingMoves(moves, r, c, 0, -1, piece.team);
      pushSlidingMoves(moves, r, c, 0, 1, piece.team);
      break;
    case "king": {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (!isInside(nr, nc)) continue;
          if (!board[nr][nc] || board[nr][nc].team !== piece.team) {
            moves.push([nr, nc]);
          }
        }
      }
      break;
    }
  }
  return moves;
}

function setStatus(text) {
  statusEl.textContent = text;
}

function render() {
  boardEl.innerHTML = "";
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = document.createElement("button");
      sq.type = "button";
      sq.className = `square ${(r + c) % 2 === 0 ? "light" : "dark"}`;
      sq.dataset.row = String(r);
      sq.dataset.col = String(c);

      const piece = board[r][c];
      if (piece) {
        sq.textContent = symbols[piece.team][piece.type];
        sq.classList.add(piece.team);
      }

      if (selected && selected[0] === r && selected[1] === c) {
        sq.classList.add("selected");
      }
      if (legalTargets.some(([lr, lc]) => lr === r && lc === c)) {
        sq.classList.add("legal");
      }

      sq.addEventListener("click", onSquareClick);
      boardEl.appendChild(sq);
    }
  }
}

function onSquareClick(event) {
  if (gameOver || currentTurn !== UNICORNS) return;

  const r = Number(event.currentTarget.dataset.row);
  const c = Number(event.currentTarget.dataset.col);
  const clickedPiece = board[r][c];

  if (selected) {
    const isLegal = legalTargets.some(([lr, lc]) => lr === r && lc === c);
    if (isLegal) {
      makeMove(selected[0], selected[1], r, c);
      return;
    }
  }

  if (clickedPiece && clickedPiece.team === UNICORNS) {
    selected = [r, c];
    legalTargets = getMoves(r, c);
  } else {
    selected = null;
    legalTargets = [];
  }
  render();
}

function makeMove(fr, fc, tr, tc) {
  const mover = board[fr][fc];
  const captured = board[tr][tc];

  board[tr][tc] = mover;
  board[fr][fc] = null;

  if (mover.type === "pawn" && (tr === 0 || tr === 7)) {
    mover.type = "queen";
  }

  selected = null;
  legalTargets = [];
  render();

  if (captured?.type === "king") {
    gameOver = true;
    const winner = mover.team === UNICORNS ? "Unicorns" : "Goblins";
    setStatus(`🏆 ${winner} win by capturing the monarch!`);
    return;
  }

  currentTurn = currentTurn === UNICORNS ? GOBLINS : UNICORNS;

  if (currentTurn === GOBLINS) {
    setStatus("Goblins are plotting their move...");
    setTimeout(makeGoblinMove, 450);
  } else {
    setStatus("Your turn (Unicorns)");
  }
}

function collectMoves(team) {
  const all = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece || piece.team !== team) continue;
      const moves = getMoves(r, c);
      for (const [tr, tc] of moves) {
        all.push({ fr: r, fc: c, tr, tc, capture: Boolean(board[tr][tc]) });
      }
    }
  }
  return all;
}

function makeGoblinMove() {
  if (gameOver || currentTurn !== GOBLINS) return;

  const options = collectMoves(GOBLINS);
  if (options.length === 0) {
    gameOver = true;
    setStatus("🏆 Unicorns win! Goblins have no legal moves.");
    return;
  }

  const captures = options.filter((m) => m.capture);
  const pool = captures.length ? captures : options;
  const move = pool[Math.floor(Math.random() * pool.length)];
  makeMove(move.fr, move.fc, move.tr, move.tc);
}

restartBtn.addEventListener("click", setupBoard);
setupBoard();
