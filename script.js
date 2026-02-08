const boardEl = document.getElementById("board");
const statusEl = document.getElementById("status");
const restartBtn = document.getElementById("restartBtn");
const checkWarningEl = document.getElementById("checkWarning");
const unicornCapturesEl = document.getElementById("unicornCaptures");
const goblinCapturesEl = document.getElementById("goblinCaptures");

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
let capturedByUnicorns = [];
let capturedByGoblins = [];

function makePiece(team, type) {
  return { team, type, hasMoved: false };
}

function cloneBoard(state) {
  return state.map((row) => row.map((piece) => (piece ? { ...piece } : null)));
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
  capturedByUnicorns = [];
  capturedByGoblins = [];
  updateCapturedTally();
  render();
  updateTurnStatus();
}

function isInside(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function pushSlidingMoves(state, moves, r, c, dr, dc, team) {
  let nr = r + dr;
  let nc = c + dc;
  while (isInside(nr, nc)) {
    if (!state[nr][nc]) {
      moves.push({ tr: nr, tc: nc });
    } else {
      if (state[nr][nc].team !== team) {
        moves.push({ tr: nr, tc: nc });
      }
      break;
    }
    nr += dr;
    nc += dc;
  }
}

function findKing(state, team) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = state[r][c];
      if (piece && piece.team === team && piece.type === "king") {
        return [r, c];
      }
    }
  }
  return null;
}

function isSquareAttacked(state, row, col, byTeam) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = state[r][c];
      if (!piece || piece.team !== byTeam) continue;
      const attacks = getPseudoMoves(state, r, c, { includeCastle: false, forAttack: true });
      if (attacks.some((m) => m.tr === row && m.tc === col)) {
        return true;
      }
    }
  }
  return false;
}

function isInCheck(state, team) {
  const kingPos = findKing(state, team);
  if (!kingPos) return false;
  const enemy = team === UNICORNS ? GOBLINS : UNICORNS;
  return isSquareAttacked(state, kingPos[0], kingPos[1], enemy);
}

function getPseudoMoves(state, r, c, opts = {}) {
  const { includeCastle = true, forAttack = false } = opts;
  const piece = state[r][c];
  if (!piece) return [];

  const moves = [];
  const dir = piece.team === UNICORNS ? -1 : 1;

  switch (piece.type) {
    case "pawn": {
      if (forAttack) {
        for (const dc of [-1, 1]) {
          const tr = r + dir;
          const tc = c + dc;
          if (isInside(tr, tc)) moves.push({ tr, tc });
        }
        break;
      }

      const step = r + dir;
      if (isInside(step, c) && !state[step][c]) {
        moves.push({ tr: step, tc: c });
        const startRow = piece.team === UNICORNS ? 6 : 1;
        const jump = r + dir * 2;
        if (r === startRow && isInside(jump, c) && !state[jump][c]) {
          moves.push({ tr: jump, tc: c });
        }
      }

      for (const dc of [-1, 1]) {
        const tr = r + dir;
        const tc = c + dc;
        if (isInside(tr, tc) && state[tr][tc] && state[tr][tc].team !== piece.team) {
          moves.push({ tr, tc });
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
        if (!state[nr][nc] || state[nr][nc].team !== piece.team) {
          moves.push({ tr: nr, tc: nc });
        }
      }
      break;
    }
    case "bishop":
      pushSlidingMoves(state, moves, r, c, -1, -1, piece.team);
      pushSlidingMoves(state, moves, r, c, -1, 1, piece.team);
      pushSlidingMoves(state, moves, r, c, 1, -1, piece.team);
      pushSlidingMoves(state, moves, r, c, 1, 1, piece.team);
      break;
    case "rook":
      pushSlidingMoves(state, moves, r, c, -1, 0, piece.team);
      pushSlidingMoves(state, moves, r, c, 1, 0, piece.team);
      pushSlidingMoves(state, moves, r, c, 0, -1, piece.team);
      pushSlidingMoves(state, moves, r, c, 0, 1, piece.team);
      break;
    case "queen":
      pushSlidingMoves(state, moves, r, c, -1, -1, piece.team);
      pushSlidingMoves(state, moves, r, c, -1, 1, piece.team);
      pushSlidingMoves(state, moves, r, c, 1, -1, piece.team);
      pushSlidingMoves(state, moves, r, c, 1, 1, piece.team);
      pushSlidingMoves(state, moves, r, c, -1, 0, piece.team);
      pushSlidingMoves(state, moves, r, c, 1, 0, piece.team);
      pushSlidingMoves(state, moves, r, c, 0, -1, piece.team);
      pushSlidingMoves(state, moves, r, c, 0, 1, piece.team);
      break;
    case "king": {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (!isInside(nr, nc)) continue;
          if (!state[nr][nc] || state[nr][nc].team !== piece.team) {
            moves.push({ tr: nr, tc: nc });
          }
        }
      }

      if (!forAttack && includeCastle && !piece.hasMoved && !isInCheck(state, piece.team)) {
        const enemy = piece.team === UNICORNS ? GOBLINS : UNICORNS;

        const kingSideRook = state[r][7];
        if (
          kingSideRook &&
          kingSideRook.type === "rook" &&
          kingSideRook.team === piece.team &&
          !kingSideRook.hasMoved &&
          !state[r][5] &&
          !state[r][6] &&
          !isSquareAttacked(state, r, 5, enemy) &&
          !isSquareAttacked(state, r, 6, enemy)
        ) {
          moves.push({ tr: r, tc: 6, castle: "king" });
        }

        const queenSideRook = state[r][0];
        if (
          queenSideRook &&
          queenSideRook.type === "rook" &&
          queenSideRook.team === piece.team &&
          !queenSideRook.hasMoved &&
          !state[r][1] &&
          !state[r][2] &&
          !state[r][3] &&
          !isSquareAttacked(state, r, 3, enemy) &&
          !isSquareAttacked(state, r, 2, enemy)
        ) {
          moves.push({ tr: r, tc: 2, castle: "queen" });
        }
      }
      break;
    }
  }

  return moves;
}

function applyMove(state, fr, fc, move) {
  const mover = state[fr][fc];
  const target = state[move.tr][move.tc];

  state[move.tr][move.tc] = mover;
  state[fr][fc] = null;

  if (move.castle && mover.type === "king") {
    if (move.castle === "king") {
      state[move.tr][5] = state[move.tr][7];
      state[move.tr][7] = null;
      state[move.tr][5].hasMoved = true;
    } else {
      state[move.tr][3] = state[move.tr][0];
      state[move.tr][0] = null;
      state[move.tr][3].hasMoved = true;
    }
  }

  mover.hasMoved = true;

  if (mover.type === "pawn" && (move.tr === 0 || move.tr === 7)) {
    mover.type = "queen";
  }

  return target;
}

function getLegalMoves(r, c) {
  const piece = board[r][c];
  if (!piece) return [];

  const pseudoMoves = getPseudoMoves(board, r, c);
  const legal = [];

  for (const move of pseudoMoves) {
    const simulation = cloneBoard(board);
    applyMove(simulation, r, c, move);
    if (!isInCheck(simulation, piece.team)) {
      legal.push(move);
    }
  }

  return legal;
}

function setStatus(text) {
  statusEl.textContent = text;
}

function updateCheckWarning() {
  if (gameOver) {
    checkWarningEl.textContent = "";
    return;
  }

  if (isInCheck(board, currentTurn)) {
    const side = currentTurn === UNICORNS ? "Unicorns" : "Goblins";
    checkWarningEl.textContent = `⚠️ ${side} are in check!`;
  } else {
    checkWarningEl.textContent = "";
  }
}

function updateCapturedTally() {
  unicornCapturesEl.textContent = capturedByUnicorns.join(" ") || "—";
  goblinCapturesEl.textContent = capturedByGoblins.join(" ") || "—";
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
      if (legalTargets.some((m) => m.tr === r && m.tc === c)) {
        sq.classList.add("legal");
      }

      sq.addEventListener("click", onSquareClick);
      boardEl.appendChild(sq);
    }
  }
}

function findAnyLegalMove(team) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece || piece.team !== team) continue;
      if (getLegalMoves(r, c).length > 0) {
        return true;
      }
    }
  }
  return false;
}

function updateTurnStatus() {
  const sideText = currentTurn === UNICORNS ? "Your turn (Unicorns)" : "Goblins are plotting their move...";
  setStatus(sideText);
  updateCheckWarning();
}

function onSquareClick(event) {
  if (gameOver || currentTurn !== UNICORNS) return;

  const r = Number(event.currentTarget.dataset.row);
  const c = Number(event.currentTarget.dataset.col);
  const clickedPiece = board[r][c];

  if (selected) {
    const move = legalTargets.find((m) => m.tr === r && m.tc === c);
    if (move) {
      makeMove(selected[0], selected[1], move);
      return;
    }
  }

  if (clickedPiece && clickedPiece.team === UNICORNS) {
    selected = [r, c];
    legalTargets = getLegalMoves(r, c);
  } else {
    selected = null;
    legalTargets = [];
  }
  render();
}

function makeMove(fr, fc, move) {
  const mover = board[fr][fc];
  const captured = applyMove(board, fr, fc, move);

  if (captured) {
    if (mover.team === UNICORNS) {
      capturedByUnicorns.push(symbols[captured.team][captured.type]);
    } else {
      capturedByGoblins.push(symbols[captured.team][captured.type]);
    }
    updateCapturedTally();
  }

  selected = null;
  legalTargets = [];
  render();

  if (captured?.type === "king") {
    gameOver = true;
    const winner = mover.team === UNICORNS ? "Unicorns" : "Goblins";
    setStatus(`🏆 ${winner} win by capturing the monarch!`);
    updateCheckWarning();
    return;
  }

  currentTurn = currentTurn === UNICORNS ? GOBLINS : UNICORNS;

  const hasMoves = findAnyLegalMove(currentTurn);
  const checked = isInCheck(board, currentTurn);
  if (!hasMoves) {
    gameOver = true;
    if (checked) {
      const winner = currentTurn === UNICORNS ? "Goblins" : "Unicorns";
      setStatus(`🏆 ${winner} win by checkmate!`);
    } else {
      setStatus("🤝 Stalemate! No legal moves remain.");
    }
    updateCheckWarning();
    return;
  }

  updateTurnStatus();

  if (currentTurn === GOBLINS) {
    setTimeout(makeGoblinMove, 450);
  }
}

function collectMoves(team) {
  const all = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece || piece.team !== team) continue;
      const moves = getLegalMoves(r, c);
      for (const move of moves) {
        all.push({
          fr: r,
          fc: c,
          ...move,
          capture: Boolean(board[move.tr][move.tc]),
          priority: board[move.tr][move.tc]?.type === "king" ? 100 : board[move.tr][move.tc] ? 10 : 0,
        });
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
    updateCheckWarning();
    return;
  }

  const maxPriority = Math.max(...options.map((m) => m.priority));
  const topMoves = options.filter((m) => m.priority === maxPriority);
  const move = topMoves[Math.floor(Math.random() * topMoves.length)];
  makeMove(move.fr, move.fc, move);
}

restartBtn.addEventListener("click", setupBoard);
setupBoard();
