// ============================================================
//  Reach The Target — app.js
//  Firebase Firestore multiplayer game logic
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ============================================================
//  FIREBASE CONFIGURATION
//  Replace every value below with your own Firebase project
//  settings. Find them at:
//  Firebase Console → Your Project → Project Settings → General
//  → Your apps → Web app → SDK setup and configuration
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyDGn0RMwA5AcY-x7ydsUx3MiRKfo_REHRY",
  authDomain: "mylesmathsgame.firebaseapp.com",
  projectId: "mylesmathsgame",
  storageBucket: "mylesmathsgame.firebasestorage.app",
  messagingSenderId: "806133739112",
  appId: "1:806133739112:web:c9b878e38e2d0d9e4b95dd",
  measurementId: "G-7GXK25J672"
};

// Firestore collection that holds all game rooms
const GAMES_COLLECTION = "reach_the_target_rooms";

// ============================================================
//  FIREBASE INIT
// ============================================================
let db;
try {
  const firebaseApp = initializeApp(firebaseConfig);
  db = getFirestore(firebaseApp);
} catch (err) {
  console.error("Firebase init failed:", err);
  alert(
    "Firebase is not configured yet.\n\n" +
    "Open app.js and replace the firebaseConfig values with your " +
    "own Firebase project credentials."
  );
}

// ============================================================
//  APPLICATION STATE
// ============================================================
const state = {
  playerName:  "",
  playerRole:  null,    // "creator" | "joiner"
  roomCode:    "",
  gameData:    null,
  unsubscribe: null,    // Firestore real-time listener teardown fn
  confettiId:  null,    // requestAnimationFrame id for confetti
  particles:   []
};

// ============================================================
//  DOM REFERENCES
// ============================================================
const $ = id => document.getElementById(id);

const dom = {
  // Home
  playerName:        $("player-name"),
  roomCodeInput:     $("room-code-input"),
  btnCreate:         $("btn-create"),
  btnJoin:           $("btn-join"),

  // Lobby
  lobbyWaiting:      $("lobby-waiting"),
  lobbySetTarget:    $("lobby-set-target"),
  lobbyWaitTarget:   $("lobby-waiting-target"),
  roomCodeDisplay:   $("room-code-display"),
  btnCopyCode:       $("btn-copy-code"),
  btnShareLink:      $("btn-share-link"),
  joinerNameDisplay: $("joiner-name-display"),
  targetInput:       $("target-input"),
  btnStart:          $("btn-start"),
  creatorNameDisplay:$("creator-name-display"),
  lobbyRoomCodeMini: $("lobby-room-code-mini"),

  // Game
  gameRoomCode:      $("game-room-code"),
  gameTarget:        $("game-target"),
  pillCreator:       $("pill-creator"),
  pillJoiner:        $("pill-joiner"),
  pillCreatorName:   $("pill-creator-name"),
  pillJoinerName:    $("pill-joiner-name"),
  dotCreator:        $("dot-creator"),
  dotJoiner:         $("dot-joiner"),
  currentTotal:      $("current-total"),
  progressBar:       $("progress-bar"),
  progressTargetLbl: $("progress-target-label"),
  turnIndicator:     $("turn-indicator"),
  moveGrid:          $("move-grid"),
  historyList:       $("history-list"),

  // Overlay
  winnerOverlay:     $("winner-overlay"),
  winnerEmoji:       $("winner-emoji"),
  winnerTitle:       $("winner-title"),
  winnerBody:        $("winner-body"),
  btnPlayAgain:      $("btn-play-again"),
  btnHome:           $("btn-home"),

  // Toast & confetti
  toast:             $("toast"),
  confettiCanvas:    $("confetti-canvas")
};

// ============================================================
//  SCREEN NAVIGATION
// ============================================================
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  $(id).classList.add("active");
}

function showLobbySection(id) {
  [dom.lobbyWaiting, dom.lobbySetTarget, dom.lobbyWaitTarget].forEach(el => {
    el.classList.add("hidden");
  });
  $(id).classList.remove("hidden");
}

// ============================================================
//  TOAST
// ============================================================
let toastTimer = null;
function showToast(msg, ms = 2500) {
  clearTimeout(toastTimer);
  dom.toast.textContent = msg;
  dom.toast.classList.remove("hidden");
  // Force reflow so animation replays
  void dom.toast.offsetWidth;
  dom.toast.classList.add("show");
  toastTimer = setTimeout(() => {
    dom.toast.classList.remove("show");
    setTimeout(() => dom.toast.classList.add("hidden"), 300);
  }, ms);
}

// ============================================================
//  HELPERS
// ============================================================
function generateRoomCode() {
  // Avoid visually-ambiguous characters (0/O, 1/I)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function bumpTotal() {
  dom.currentTotal.classList.remove("bump");
  void dom.currentTotal.offsetWidth;
  dom.currentTotal.classList.add("bump");
  setTimeout(() => dom.currentTotal.classList.remove("bump"), 150);
}

// ============================================================
//  INITIALISE ON PAGE LOAD
// ============================================================
window.addEventListener("DOMContentLoaded", init);

function init() {
  // ── Wire up buttons ──
  dom.btnCreate.addEventListener("click", handleCreate);
  dom.btnJoin.addEventListener("click", handleJoin);
  dom.btnCopyCode.addEventListener("click", copyRoomCode);
  dom.btnShareLink.addEventListener("click", shareLink);
  dom.btnStart.addEventListener("click", handleStartGame);
  dom.btnPlayAgain.addEventListener("click", handlePlayAgain);
  dom.btnHome.addEventListener("click", handleGoHome);

  // ── Move buttons (event delegation) ──
  dom.moveGrid.addEventListener("click", e => {
    const btn = e.target.closest(".move-btn");
    if (btn && !btn.disabled) {
      makeMove(parseInt(btn.dataset.value, 10));
    }
  });

  // ── Keyboard shortcuts ──
  dom.playerName.addEventListener("keypress", e => {
    if (e.key !== "Enter") return;
    if (dom.roomCodeInput.value.trim()) handleJoin(); else handleCreate();
  });
  dom.roomCodeInput.addEventListener("keypress", e => {
    if (e.key === "Enter") handleJoin();
  });
  dom.targetInput.addEventListener("keypress", e => {
    if (e.key === "Enter") handleStartGame();
  });

  // ── Auto-uppercase room code ──
  dom.roomCodeInput.addEventListener("input", e => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  });

  // ── Pre-fill from URL ──
  const params = new URLSearchParams(window.location.search);
  const urlCode = params.get("room");
  if (urlCode) {
    dom.roomCodeInput.value = urlCode.toUpperCase();
    dom.playerName.focus();
    showToast("Room code pre-filled — enter your name and click Join!", 4000);
  } else {
    dom.playerName.focus();
  }

  // ── Canvas resize ──
  window.addEventListener("resize", resizeCanvas);
}

// ============================================================
//  CREATE GAME
// ============================================================
async function handleCreate() {
  const name = dom.playerName.value.trim();
  if (!name) { showToast("Enter your name first!"); dom.playerName.focus(); return; }

  state.playerName = name;
  state.playerRole = "creator";
  state.roomCode   = generateRoomCode();

  try {
    await setDoc(doc(db, GAMES_COLLECTION, state.roomCode), {
      roomCode:     state.roomCode,
      creatorName:  name,
      joinerName:   null,
      targetNumber: null,
      currentTotal: 0,
      currentTurn:  "creator",
      status:       "waiting",       // waiting | set_target | playing | finished
      winner:       null,
      moves:        [],
      createdAt:    serverTimestamp()
    });

    pushRoomToURL(state.roomCode);
    showScreen("screen-lobby");
    showLobbySection("lobby-waiting");
    dom.roomCodeDisplay.textContent = state.roomCode;
    subscribeToGame(state.roomCode);

  } catch (err) {
    console.error("Create game error:", err);
    showToast("Couldn't create game — check your Firebase config.", 4000);
  }
}

// ============================================================
//  JOIN GAME
// ============================================================
async function handleJoin() {
  const name = dom.playerName.value.trim();
  const code = dom.roomCodeInput.value.trim().toUpperCase();

  if (!name) { showToast("Enter your name first!"); dom.playerName.focus(); return; }
  if (code.length !== 6) { showToast("Enter the 6-character room code!"); dom.roomCodeInput.focus(); return; }

  state.playerName = name;
  state.playerRole = "joiner";
  state.roomCode   = code;

  try {
    const snap = await getDoc(doc(db, GAMES_COLLECTION, code));

    if (!snap.exists()) {
      showToast("Room not found — double-check the code.", 3000); return;
    }

    const data = snap.data();

    if (data.joinerName) {
      showToast("This room is already full!", 3000); return;
    }
    if (data.status !== "waiting") {
      showToast("This game has already started or ended.", 3000); return;
    }

    await updateDoc(doc(db, GAMES_COLLECTION, code), {
      joinerName: name,
      status:     "set_target"
    });

    pushRoomToURL(code);
    showScreen("screen-lobby");
    showLobbySection("lobby-waiting-target");
    dom.creatorNameDisplay.textContent = data.creatorName;
    dom.lobbyRoomCodeMini.textContent  = code;
    subscribeToGame(code);

  } catch (err) {
    console.error("Join game error:", err);
    showToast("Couldn't join — try again.", 3000);
  }
}

// ============================================================
//  REAL-TIME LISTENER
// ============================================================
function subscribeToGame(roomCode) {
  if (state.unsubscribe) state.unsubscribe();

  state.unsubscribe = onSnapshot(
    doc(db, GAMES_COLLECTION, roomCode),
    snap => {
      if (!snap.exists()) return;
      state.gameData = snap.data();
      handleGameUpdate(state.gameData);
    },
    err => console.error("Firestore listener error:", err)
  );
}

// ============================================================
//  HANDLE INCOMING GAME STATE
// ============================================================
function handleGameUpdate(data) {
  const { status, creatorName, joinerName } = data;

  if (status === "set_target") {
    showScreen("screen-lobby");
    if (state.playerRole === "creator") {
      showLobbySection("lobby-set-target");
      dom.joinerNameDisplay.textContent = joinerName;
    } else {
      showLobbySection("lobby-waiting-target");
      dom.creatorNameDisplay.textContent = creatorName;
      dom.lobbyRoomCodeMini.textContent  = state.roomCode;
    }

  } else if (status === "playing") {
    showScreen("screen-game");
    dom.winnerOverlay.classList.add("hidden");
    stopConfetti();
    renderGame(data);

  } else if (status === "finished") {
    showScreen("screen-game");
    renderGame(data);
    showWinnerOverlay(data);
  }
}

// ============================================================
//  RENDER GAME UI
// ============================================================
function renderGame(data) {
  const { creatorName, joinerName, targetNumber, currentTotal, currentTurn, moves, status } = data;

  // Header
  dom.gameRoomCode.textContent = state.roomCode;
  dom.gameTarget.textContent   = targetNumber ?? "--";

  // Player pills
  dom.pillCreatorName.textContent = creatorName;
  dom.pillJoinerName.textContent  = joinerName ?? "Waiting…";

  const creatorActive = currentTurn === "creator" && status === "playing";
  const joinerActive  = currentTurn === "joiner"  && status === "playing";

  dom.pillCreator.classList.toggle("active-player", creatorActive);
  dom.pillJoiner.classList.toggle("active-player", joinerActive);
  dom.dotCreator.classList.toggle("active", creatorActive);
  dom.dotJoiner.classList.toggle("active", joinerActive);

  // Total
  const prevTotal = parseInt(dom.currentTotal.textContent, 10) || 0;
  dom.currentTotal.textContent = currentTotal;
  if (currentTotal !== prevTotal) bumpTotal();

  // Progress bar
  if (targetNumber) {
    const pct = Math.min((currentTotal / targetNumber) * 100, 100);
    dom.progressBar.style.width = pct + "%";
    dom.progressTargetLbl.textContent = targetNumber;
  }

  // Turn indicator
  renderTurnIndicator(data);

  // Move buttons
  renderMoveButtons(data);

  // History
  renderHistory(data);
}

function renderTurnIndicator(data) {
  const { status, currentTurn, creatorName, joinerName } = data;
  const el  = dom.turnIndicator;
  const isMe = currentTurn === state.playerRole;
  const currentName = currentTurn === "creator" ? creatorName : joinerName;

  if (status === "finished") {
    el.textContent  = "Game over!";
    el.className    = "turn-indicator game-over";
  } else if (isMe) {
    el.textContent  = "⚡ Your turn — pick a number to add!";
    el.className    = "turn-indicator my-turn";
  } else {
    el.textContent  = `⏳ ${currentName}'s turn…`;
    el.className    = "turn-indicator their-turn";
  }
}

function renderMoveButtons(data) {
  const { status, currentTurn, currentTotal, targetNumber } = data;
  const isMyTurn   = currentTurn === state.playerRole;
  const isFinished = status === "finished";

  dom.moveGrid.querySelectorAll(".move-btn").forEach(btn => {
    const val         = parseInt(btn.dataset.value, 10);
    const wouldExceed = targetNumber && (currentTotal + val) > targetNumber;
    const disabled    = !isMyTurn || isFinished || wouldExceed;

    btn.disabled = disabled;
    btn.classList.toggle("over-limit", wouldExceed && isMyTurn && !isFinished);
  });
}

function renderHistory(data) {
  const { moves, creatorName, joinerName } = data;

  if (!moves || moves.length === 0) {
    dom.historyList.innerHTML = '<div class="history-empty">Game starting — make the first move!</div>';
    return;
  }

  const shown = moves.slice(-12); // show last 12 moves
  dom.historyList.innerHTML = shown.map(m => {
    const pName = m.by === "creator" ? creatorName : joinerName;
    const isMe  = m.by === state.playerRole;
    return `<div class="history-entry ${isMe ? "my-move" : "their-move"}">
      <span class="history-player">${escHtml(pName)}</span>
      <span class="history-added">+${m.val}</span>
      <span class="history-result">→ ${m.total}</span>
    </div>`;
  }).join("");

  dom.historyList.scrollTop = dom.historyList.scrollHeight;
}

function escHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// ============================================================
//  MAKE A MOVE
// ============================================================
async function makeMove(value) {
  if (!state.gameData) return;
  const { status, currentTurn, currentTotal, targetNumber, moves } = state.gameData;

  if (status !== "playing") return;
  if (currentTurn !== state.playerRole) { showToast("It's not your turn!"); return; }
  if (currentTotal + value > targetNumber) { showToast("That would exceed the target!"); return; }

  const newTotal  = currentTotal + value;
  const newMove   = { by: state.playerRole, val: value, total: newTotal };
  const newMoves  = [...(moves ?? []), newMove];
  const nextTurn  = state.playerRole === "creator" ? "joiner" : "creator";
  const isWin     = newTotal === targetNumber;

  try {
    await updateDoc(doc(db, GAMES_COLLECTION, state.roomCode), {
      currentTotal: newTotal,
      moves:        newMoves,
      currentTurn:  nextTurn,
      ...(isWin ? { status: "finished", winner: state.playerRole } : {})
    });
  } catch (err) {
    console.error("Move error:", err);
    showToast("Couldn't register move — try again.", 2000);
  }
}

// ============================================================
//  START GAME (creator sets target)
// ============================================================
async function handleStartGame() {
  const raw = parseInt(dom.targetInput.value, 10);

  if (!raw || raw < 5 || raw > 100) {
    showToast("Pick a target between 5 and 100!");
    dom.targetInput.focus();
    return;
  }

  try {
    await updateDoc(doc(db, GAMES_COLLECTION, state.roomCode), {
      targetNumber: raw,
      status:       "playing"
    });
  } catch (err) {
    console.error("Start game error:", err);
    showToast("Couldn't start game — try again.", 2000);
  }
}

// ============================================================
//  PLAY AGAIN (rematch in same room)
// ============================================================
async function handlePlayAgain() {
  // Both players can request rematch; whoever clicks first resets the game.
  // Creator sets the new target; joiner waits.
  try {
    await updateDoc(doc(db, GAMES_COLLECTION, state.roomCode), {
      targetNumber: null,
      currentTotal: 0,
      currentTurn:  "creator",
      status:       "set_target",
      winner:       null,
      moves:        []
    });
    dom.targetInput.value = "";
  } catch (err) {
    console.error("Play-again error:", err);
    showToast("Couldn't start rematch — try again.", 2000);
  }
}

// ============================================================
//  GO HOME
// ============================================================
function handleGoHome() {
  if (state.unsubscribe) { state.unsubscribe(); state.unsubscribe = null; }
  stopConfetti();

  state.playerName = "";
  state.playerRole = null;
  state.roomCode   = "";
  state.gameData   = null;

  dom.winnerOverlay.classList.add("hidden");
  dom.targetInput.value    = "";
  dom.roomCodeInput.value  = "";
  dom.playerName.value     = "";

  clearRoomFromURL();
  showScreen("screen-home");
  dom.playerName.focus();
}

// ============================================================
//  WINNER OVERLAY
// ============================================================
function showWinnerOverlay(data) {
  const { winner, creatorName, joinerName } = data;
  const winnerName = winner === "creator" ? creatorName : joinerName;
  const iWon = winner === state.playerRole;

  dom.winnerEmoji.textContent = iWon ? "🏆" : "😔";
  dom.winnerTitle.textContent = iWon ? "You win!" : `${winnerName} wins!`;
  dom.winnerBody.textContent  = iWon
    ? "🎉 You reached the target exactly!"
    : "😅 Better strategy next time!";

  dom.winnerOverlay.classList.remove("hidden");

  if (iWon) startConfetti();
}

// ============================================================
//  COPY & SHARE
// ============================================================
async function copyRoomCode() {
  const code = state.roomCode || dom.roomCodeDisplay.textContent.trim();
  try {
    await navigator.clipboard.writeText(code);
    showToast("Room code copied! ✅");
  } catch {
    fallbackCopy(code);
  }
}

async function shareLink() {
  const url = buildShareURL();
  if (navigator.share) {
    try {
      await navigator.share({
        title: "Reach The Target",
        text: `Join my game! Room: ${state.roomCode}`,
        url
      });
      return;
    } catch (e) {
      if (e.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    showToast("Link copied to clipboard! 🔗");
  } catch {
    fallbackCopy(url);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.cssText = "position:fixed;opacity:0";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
  showToast("Copied! ✅");
}

function buildShareURL() {
  const u = new URL(window.location.href);
  u.searchParams.set("room", state.roomCode);
  return u.toString();
}

function pushRoomToURL(code) {
  const u = new URL(window.location.href);
  u.searchParams.set("room", code);
  window.history.replaceState({}, "", u);
}

function clearRoomFromURL() {
  const u = new URL(window.location.href);
  u.searchParams.delete("room");
  window.history.replaceState({}, "", u);
}

// ============================================================
//  CONFETTI
// ============================================================
const CONFETTI_COLORS = [
  "#8B5CF6", "#60A5FA", "#F59E0B", "#10B981",
  "#EF4444", "#EC4899", "#FBBF24", "#A78BFA", "#FFFFFF"
];

function resizeCanvas() {
  dom.confettiCanvas.width  = window.innerWidth;
  dom.confettiCanvas.height = window.innerHeight;
}

function startConfetti() {
  resizeCanvas();
  dom.confettiCanvas.classList.add("active");

  state.particles = Array.from({ length: 180 }, () => ({
    x:     Math.random() * dom.confettiCanvas.width,
    y:     Math.random() * dom.confettiCanvas.height - dom.confettiCanvas.height,
    w:     Math.random() * 12 + 5,
    h:     Math.random() * 6  + 3,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    speed: Math.random() * 3.5 + 1.5,
    angle: Math.random() * 360,
    spin:  Math.random() * 8 - 4,
    drift: Math.random() * 1.5 - 0.75,
    alpha: Math.random() * 0.5 + 0.5
  }));

  const ctx = dom.confettiCanvas.getContext("2d");

  function frame() {
    ctx.clearRect(0, 0, dom.confettiCanvas.width, dom.confettiCanvas.height);
    state.particles.forEach(p => {
      p.y      += p.speed;
      p.x      += p.drift;
      p.angle  += p.spin;
      if (p.y > dom.confettiCanvas.height + 20) {
        p.y = -p.h;
        p.x = Math.random() * dom.confettiCanvas.width;
      }
      ctx.save();
      ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
      ctx.rotate((p.angle * Math.PI) / 180);
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle   = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    state.confettiId = requestAnimationFrame(frame);
  }

  frame();
  setTimeout(stopConfetti, 5500); // auto-stop after 5.5s
}

function stopConfetti() {
  if (state.confettiId) {
    cancelAnimationFrame(state.confettiId);
    state.confettiId = null;
  }
  const ctx = dom.confettiCanvas.getContext("2d");
  ctx.clearRect(0, 0, dom.confettiCanvas.width, dom.confettiCanvas.height);
  dom.confettiCanvas.classList.remove("active");
  state.particles = [];
}
