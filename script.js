const DIFF = {
  easy:   { size: 30, time: 60, speed: 1, points: 10 },
  medium: { size: 26, time: 45, speed: 2, points: 15 },
  hard:   { size: 23, time: 30, speed: 2, points: 25 },
};

let diff = null, cfg = null;
let score = 0, hits = 0, misses = 0, streak = 0, best = 0, doubles = 0;
let x2 = false, dead = false, timeLeft = 0, clock = null;
let cx = 0, cy = 0, gx = 0, gy = 0, raf = null;

const area   = document.getElementById('game-area');
const target = document.getElementById('target');

// ── Pick difficulty
function pick(d, btn) {
  diff = d;
  cfg = DIFF[d];
  document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const sb = document.getElementById('start-btn');
  sb.classList.add('ready');
  sb.textContent = 'Start — ' + d.charAt(0).toUpperCase() + d.slice(1);
}

// ── Start game
function startGame() {                                                      
  if (!diff) return;
  score = 0; hits = 0; misses = 0; streak = 0; best = 0; doubles = 0;
  x2 = false; dead = false; timeLeft = cfg.time;

  document.getElementById('menu').style.display       = 'none';
  document.getElementById('results').style.display    = 'none';
  document.getElementById('stats-bar').style.display  = 'flex';
  document.getElementById('streak-row').style.display = 'flex';
  document.getElementById('reset-btn').style.display  = 'inline-block';
  area.classList.add('active');  

  target.style.width        = cfg.size + 'px';          // these are set here to allow dynamic resizing based on difficulty 
  target.style.height       = cfg.size + 'px';          // we do this because the target element is reused across games and needs to be updated when a new difficulty is selected
  target.style.borderRadius = '50%';                  // this is set here to ensure the target remains circular even if the size changes
  target.style.background   = '#4a9eff';            // the default color for the target, which can change during 2x mode

  moveTarget();                     // move the target to a random position at the start of the game
  hudUpdate();                      // this updates the score, streak, and accuracy display at the start of the game
  clearInterval(clock);             // make sure to reset the clock in case a game was already in progress
  clock = setInterval(tick, 1000);  // this tick function updates the timer every second and checks for game end when time runs out 
}

// ── Timer
function tick() {
  timeLeft--;
  document.getElementById('s-time').textContent = timeLeft;
  if (timeLeft <= 0) endGame();
}

// ── Target movement
function moveTarget() {
  const W = area.clientWidth  - cfg.size;
  const H = area.clientHeight - cfg.size;
  cx = Math.random() * W;
  cy = Math.random() * H;
  target.style.left = cx + 'px';
  target.style.top  = cy + 'px';
  newGoal();
  cancelAnimationFrame(raf);
  chaseLoop();
}

function newGoal() {
  const W = area.clientWidth  - cfg.size;
  const H = area.clientHeight - cfg.size;
  gx = Math.random() * W;
  gy = Math.random() * H;
}

function chaseLoop() {
  if (dead) return;
  const dx = gx - cx, dy = gy - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < cfg.speed + 1) {
    cx = gx; cy = gy;
    newGoal();
  } else {
    cx += dx / dist * cfg.speed;
    cy += dy / dist * cfg.speed;
  }
  target.style.left = cx + 'px';
  target.style.top  = cy + 'px';
  raf = requestAnimationFrame(chaseLoop);
}

// ── Hit
function onHit(e) {
  e.stopPropagation();
  if (dead) return;

  const pts = x2 ? cfg.points * 2 : cfg.points;
  score += pts; hits++; streak++;
  if (streak > best) best = streak;

  const tr = target.getBoundingClientRect();
  const ar = area.getBoundingClientRect();
  const ox = tr.left - ar.left + cfg.size / 2;
  const oy = tr.top  - ar.top  + cfg.size / 2;
  spawnRipple(ox, oy, '#4a9eff');
  spawnPop(ox, oy, '+' + pts, x2 ? '#f0a500' : '#4a9eff');

  checkStreak();
  moveTarget();
  hudUpdate();
}

// ── Miss
function onMiss(e) {
  if (dead) return;
  if (e.target === target) return;
  misses++; streak = 0;
  const ar = area.getBoundingClientRect();
  spawnRipple(e.clientX - ar.left, e.clientY - ar.top, '#cc4444');
  barUpdate();
  hudUpdate();
}

// ── Streak / 2x
function checkStreak() {
  barUpdate();
  if (streak > 0 && streak % 5 === 0) {
    doubles++; x2 = true;
    target.style.background = '#f0a500';
    setTimeout(() => {
      x2 = false;
      target.style.background = '#4a9eff';
    }, 5000);
  }
}

function barUpdate() {
  const pct = Math.min((streak % 5) / 5 * 100, 100);
  document.getElementById('streak-fill').style.width = pct + '%';
}

// ── Visual effects
function spawnRipple(x, y, color) {
  const r = document.createElement('div');
  r.className = 'ripple';
  r.style.cssText = `left:${x}px;top:${y}px;background:${color};`;
  area.appendChild(r);
  setTimeout(() => r.remove(), 380);
}

function spawnPop(x, y, txt, color) {
  const p = document.createElement('div');
  p.className = 'pop';
  p.textContent = txt;
  p.style.cssText = `left:${x}px;top:${y}px;color:${color};`;
  area.appendChild(p);
  setTimeout(() => p.remove(), 580);
}

// ── HUD update
function hudUpdate() {
  document.getElementById('s-score').textContent  = score;
  document.getElementById('s-streak').textContent = streak;
  const tot = hits + misses;
  document.getElementById('s-acc').textContent = tot > 0
    ? Math.round(hits / tot * 100) + '%'
    : '--%';
}

// ── End game
function endGame() {
  dead = true;
  clearInterval(clock);
  cancelAnimationFrame(raf);
  setTimeout(showResults, 200);
}

function showResults() {
  area.classList.remove('active');
  document.getElementById('stats-bar').style.display  = 'none';
  document.getElementById('streak-row').style.display = 'none';
  document.getElementById('reset-btn').style.display  = 'none';
  document.getElementById('results').style.display    = 'flex';

  const tot = hits + misses;
  const acc = tot > 0 ? Math.round(hits / tot * 100) : 0;
  const g = calcGrade(acc);

  document.getElementById('r-score').textContent   = score;
  document.getElementById('r-hits').textContent    = hits;
  document.getElementById('r-miss').textContent    = misses;
  document.getElementById('r-acc').textContent     = acc + '%';
  document.getElementById('r-streak').textContent  = best;
  document.getElementById('r-doubles').textContent = doubles;

  const gradeEl = document.getElementById('grade');
  gradeEl.textContent = g.letter;
  gradeEl.style.color = g.color;
  document.getElementById('feedback').textContent = g.msg;
}

function calcGrade(acc) {
  if (acc >= 90) return { letter: 'S', color: '#f0a500', msg: "Incredible accuracy. You're a natural." };
  if (acc >= 78) return { letter: 'A', color: '#4a9eff', msg: 'Great shooting. Clean and consistent.' };
  if (acc >= 64) return { letter: 'B', color: '#66cc88', msg: 'Solid effort. Work on cutting those misses.' };
  if (acc >= 50) return { letter: 'C', color: '#cc99ff', msg: 'Average. Slow down and aim before clicking.' };
  if (acc >= 35) return { letter: 'D', color: '#ff9944', msg: 'Keep practicing — patience pays off.' };
                  return { letter: 'F', color: '#cc4444', msg: "Don't give up. Every pro starts here." };
}

// ── Reset / Menu
function reset() {
  endGame();
}

function goMenu() {
  dead = true;
  clearInterval(clock);
  cancelAnimationFrame(raf);
  area.classList.remove('active');
  document.getElementById('results').style.display    = 'none';
  document.getElementById('stats-bar').style.display  = 'none';
  document.getElementById('streak-row').style.display = 'none';
  document.getElementById('reset-btn').style.display  = 'none';
  document.getElementById('menu').style.display       = 'flex';
}