/* ══════════════════════════════════════════════════════════════
   DIFFICULTY SETTINGS
   Each difficulty has: target size (px), round time (seconds),
   movement speed, points per hit, and number of targets.
══════════════════════════════════════════════════════════════ */
const DIFF = {
  easy:   { size: 30, time: 60,  speed: 1,   points: 10, count: 1 },
  medium: { size: 26, time: 45,  speed: 2,   points: 15, count: 2 },
  hard:   { size: 23, time: 30,  speed: 2.5, points: 25, count: 3 },
};

/* ══════════════════════════════════════════════════════════════
   GAME STATE VARIABLES
   Scorecards that track everything during a round.
══════════════════════════════════════════════════════════════ */
let diff    = null;  // Selected difficulty key ("easy" / "medium" / "hard")
let cfg     = null;  // The settings object for that difficulty

let score   = 0;
let hits    = 0;
let misses  = 0;
let streak  = 0;   // Current consecutive hit streak
let best    = 0;   // Highest streak of the round
let doubles = 0;   // How many 2x bonuses triggered

let x2      = false;  // Is 2x multiplier active right now?
let dead    = false;  // True when the round has ended — blocks stray clicks
let timeLeft = 0;
let clock   = null;

let targets = [];   // Array of target objects { el, cx, cy, gx, gy }
let raf = null;     // requestAnimationFrame reference

/* ══════════════════════════════════════════════════════════════
   DOM REFERENCES — grab the elements we'll update frequently
══════════════════════════════════════════════════════════════ */
const area   = document.getElementById('game-area');


/* ══════════════════════════════════════════════════════════════
   PICK DIFFICULTY
   Highlights the clicked button, stores the chosen settings,
   and unlocks the Start button.
══════════════════════════════════════════════════════════════ */
function pick(d, btn) {
  diff = d;
  cfg  = DIFF[d];
  document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const sb = document.getElementById('start-btn');
  sb.classList.add('ready');
  sb.textContent = 'Start — ' + d.charAt(0).toUpperCase() + d.slice(1);
}


/* ══════════════════════════════════════════════════════════════
   START GAME
   Resets everything, hides the menu, shows the game UI,
   creates multiple targets based on difficulty, and starts the timer.
══════════════════════════════════════════════════════════════ */
function startGame() {
  if (!diff) return;

  // Reset all counters for a fresh round
  score = 0; hits = 0; misses = 0; streak = 0; best = 0; doubles = 0;
  x2 = false; dead = false;
  timeLeft = cfg.time;

  // Clear any existing targets
  targets = [];
  area.innerHTML = '';

  // Hide menu and results; show in-game UI
  document.getElementById('menu-card').style.display  = 'none';
  document.getElementById('results').style.display    = 'none';
  document.getElementById('stats-bar').style.display  = 'flex';
  document.getElementById('streak-row').style.display = 'flex';
  document.getElementById('reset-btn').style.display  = 'inline-block';
  area.classList.add('active');

  // Create multiple target elements based on difficulty
  for (let i = 0; i < cfg.count; i++) {
    const target = document.createElement('div');
    target.id = 'target-' + i;
    target.className = 'game-target';
    target.style.width = cfg.size + 'px';
    target.style.height = cfg.size + 'px';
    target.style.borderRadius = '50%';
    target.addEventListener('click', onHit);
    area.appendChild(target);

    targets.push({
      el: target,
      cx: 0,
      cy: 0,
      gx: 0,
      gy: 0
    });
  }

  // Position and start all targets
  moveAllTargets();
  hudUpdate();
  clearInterval(clock);
  clock = setInterval(tick, 1000);
}


/* ══════════════════════════════════════════════════════════════
   COUNTDOWN TIMER
   Runs every second. Turns red and flashes under 10 seconds.
══════════════════════════════════════════════════════════════ */
function tick() {
  timeLeft--;
  const el = document.getElementById('s-time');
  el.textContent = timeLeft;
  // Danger state: red and flashing when under 10 seconds
  el.classList.toggle('danger', timeLeft <= 10);
  if (timeLeft <= 0) endGame();
}


/* ══════════════════════════════════════════════════════════════
   TARGET MOVEMENT
   All targets smoothly drift between random positions using
   requestAnimationFrame — this gives buttery-smooth 60fps motion.
══════════════════════════════════════════════════════════════ */
function moveAllTargets() {
  targets.forEach(target => {
    const W = area.clientWidth - cfg.size;
    const H = area.clientHeight - cfg.size;
    target.cx = Math.random() * W;
    target.cy = Math.random() * H;
    target.el.style.left = target.cx + 'px';
    target.el.style.top = target.cy + 'px';
    setNewGoal(target);
  });
  cancelAnimationFrame(raf);
  chaseLoop();
}

/* Pick a new random destination for a target */
function setNewGoal(target) {
  const W = area.clientWidth - cfg.size;
  const H = area.clientHeight - cfg.size;
  target.gx = Math.random() * W;
  target.gy = Math.random() * H;
}

/* Move all targets one step toward their goals, 60 times per second */
function chaseLoop() {
  if (dead) return;
  
  targets.forEach(target => {
    const dx = target.gx - target.cx;
    const dy = target.gy - target.cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < cfg.speed + 1) {
      target.cx = target.gx;
      target.cy = target.gy;
      setNewGoal(target);
    } else {
      target.cx += dx / dist * cfg.speed;
      target.cy += dy / dist * cfg.speed;
    }
    
    target.el.style.left = target.cx + 'px';
    target.el.style.top = target.cy + 'px';
  });
  
  raf = requestAnimationFrame(chaseLoop);
}


/* ══════════════════════════════════════════════════════════════
   ON HIT — player clicked a target
══════════════════════════════════════════════════════════════ */
function onHit(e) {
  e.stopPropagation(); // Prevent the click also triggering onMiss
  if (dead) return;

  // Find which target was clicked
  const clickedTarget = targets.find(t => t.el === e.target);
  if (!clickedTarget) return; // Safety check

  const pts = x2 ? cfg.points * 2 : cfg.points;
  score += pts; hits++; streak++;
  if (streak > best) best = streak;

  // Find the centre of the clicked target relative to the game area
  const tr = clickedTarget.el.getBoundingClientRect();
  const ar = area.getBoundingClientRect();
  const ox = tr.left - ar.left + cfg.size / 2;
  const oy = tr.top  - ar.top  + cfg.size / 2;

  spawnRipple(ox, oy, x2 ? 'rgba(255,204,0,0.7)' : 'rgba(0,210,255,0.7)');
  spawnPop(ox, oy, '+' + pts, x2 ? '#ffcc00' : '#00d2ff');

  checkStreak();
  
  // Move the clicked target to a new position
  const W = area.clientWidth - cfg.size;
  const H = area.clientHeight - cfg.size;
  clickedTarget.cx = Math.random() * W;
  clickedTarget.cy = Math.random() * H;
  clickedTarget.el.style.left = clickedTarget.cx + 'px';
  clickedTarget.el.style.top = clickedTarget.cy + 'px';
  setNewGoal(clickedTarget);
  
  hudUpdate();
}


/* ══════════════════════════════════════════════════════════════
   ON MISS — player clicked the game area but not the target
══════════════════════════════════════════════════════════════ */
function onMiss(e) {
  if (dead) return;
  
  // Check if clicked element is one of the targets
  const isTarget = targets.some(t => t.el === e.target);
  if (isTarget) return;
  
  misses++; streak = 0;
  const ar = area.getBoundingClientRect();
  spawnRipple(e.clientX - ar.left, e.clientY - ar.top, 'rgba(255,45,85,0.7)');
  barUpdate();
  hudUpdate();
}


/* ══════════════════════════════════════════════════════════════
   STREAK & 2X BONUS
   Every 5 consecutive hits triggers a 5-second double-points window.
══════════════════════════════════════════════════════════════ */
function checkStreak() {
  barUpdate();
  if (streak > 0 && streak % 5 === 0) {
    doubles++;
    x2 = true;
    targets.forEach(t => t.el.classList.add('x2-active'));

    // Big floating "2X!" in the centre of the game area
    spawnPop(area.clientWidth / 2, area.clientHeight / 2 - 30, '// 2X ACTIVE', '#ffcc00', true);

    setTimeout(() => {
      x2 = false;
      targets.forEach(t => t.el.classList.remove('x2-active'));
    }, 5000);
  }
}

/* Update the streak progress bar and the x/5 counter label */
function barUpdate() {
  const progress = streak % 5;
  const pct = Math.min(progress / 5 * 100, 100);
  const fill = document.getElementById('streak-fill');
  fill.style.width = pct + '%';
  fill.classList.toggle('has-progress', progress > 0);
  document.getElementById('streak-count').textContent = progress + '/5';
}


/* ══════════════════════════════════════════════════════════════
   VISUAL EFFECTS — ripples and floating score text
══════════════════════════════════════════════════════════════ */
function spawnRipple(x, y, color) {
  const r = document.createElement('div');
  r.className = 'ripple';
  r.style.cssText = `left:${x}px;top:${y}px;background:${color};width:10px;height:10px;`;
  area.appendChild(r);
  setTimeout(() => r.remove(), 420);
}

function spawnPop(x, y, txt, color, big = false) {
  const p = document.createElement('div');
  p.className = 'pop';
  p.textContent = txt;
  p.style.cssText = `left:${x}px;top:${y}px;color:${color};${big ? 'font-size:1rem;' : ''}`;
  area.appendChild(p);
  setTimeout(() => p.remove(), 620);
}


/* ══════════════════════════════════════════════════════════════
   HUD UPDATE — refreshes the live stats display
══════════════════════════════════════════════════════════════ */
function hudUpdate() {
  document.getElementById('s-score').textContent  = score;
  document.getElementById('s-streak').textContent = streak;
  const tot = hits + misses;
  document.getElementById('s-acc').textContent = tot > 0
    ? Math.round(hits / tot * 100) + '%'
    : '--%';
}


/* ══════════════════════════════════════════════════════════════
   END GAME — stop timers and show results after a brief delay
══════════════════════════════════════════════════════════════ */
function endGame() {
  dead = true;
  clearInterval(clock);
  cancelAnimationFrame(raf);
  setTimeout(showResults, 220);
}

function showResults() {
  area.classList.remove('active');
  document.getElementById('stats-bar').style.display  = 'none';
  document.getElementById('streak-row').style.display = 'none';
  document.getElementById('reset-btn').style.display  = 'none';
  document.getElementById('results').style.display    = 'flex';

  const tot = hits + misses;
  const acc = tot > 0 ? Math.round(hits / tot * 100) : 0;
  const g   = calcGrade(acc);

  document.getElementById('r-score').textContent   = score;
  document.getElementById('r-hits').textContent    = hits;
  document.getElementById('r-miss').textContent    = misses;
  document.getElementById('r-acc').textContent     = acc + '%';
  document.getElementById('r-streak').textContent  = best;
  document.getElementById('r-doubles').textContent = doubles;

  const gradeEl = document.getElementById('grade');
  gradeEl.textContent      = g.letter;
  gradeEl.style.color      = g.color;
  gradeEl.style.textShadow = `0 0 30px ${g.color}`;

  document.getElementById('feedback').textContent = g.msg;
}


/* ══════════════════════════════════════════════════════════════
   GRADE CALCULATION — maps accuracy % to a letter grade
══════════════════════════════════════════════════════════════ */
function calcGrade(acc) {
  if (acc >= 90) return { letter: 'S', color: '#ffcc00', msg: '// incredible accuracy — you\'re a natural' };
  if (acc >= 78) return { letter: 'A', color: '#00d2ff', msg: '// great shooting — clean and consistent' };
  if (acc >= 64) return { letter: 'B', color: '#00ff88', msg: '// solid effort — cut those misses' };
  if (acc >= 50) return { letter: 'C', color: '#cc99ff', msg: '// average — slow down and aim first' };
  if (acc >= 35) return { letter: 'D', color: '#ff9944', msg: '// keep practicing — patience pays off' };
                 return { letter: 'F', color: '#ff2d55', msg: '// don\'t quit — every pro starts here' };
}


/* ══════════════════════════════════════════════════════════════
   RESET — ends the round and goes straight to results
══════════════════════════════════════════════════════════════ */
function reset() {
  endGame();
}


/* ══════════════════════════════════════════════════════════════
   GO TO MENU — stops everything and returns to the start screen
══════════════════════════════════════════════════════════════ */
function goMenu() {
  dead = true;
  clearInterval(clock);
  cancelAnimationFrame(raf);
  area.classList.remove('active');

  document.getElementById('results').style.display    = 'none';
  document.getElementById('stats-bar').style.display  = 'none';
  document.getElementById('streak-row').style.display = 'none';
  document.getElementById('reset-btn').style.display  = 'none';
  document.getElementById('menu-card').style.display  = 'flex';

  // Reset the Start button to its locked state
  const sb = document.getElementById('start-btn');
  sb.classList.remove('ready');
  sb.textContent = 'Select Difficulty';

  // Clear the active difficulty highlight
  document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
  diff = null;
  cfg  = null;
}
