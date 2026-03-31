const canvas = document.getElementById('oceanCanvas');
const ctx = canvas.getContext('2d');

let W = canvas.width = window.innerWidth;
let H = canvas.height = window.innerHeight;

// Helper functions
function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function interpolateRGB(start, end, t) {
  return `rgb(${Math.round(start[0] + (end[0] - start[0]) * t)},
               ${Math.round(start[1] + (end[1] - start[1]) * t)},
               ${Math.round(start[2] + (end[2] - start[2]) * t)})`;
}

// Handle window resize
window.addEventListener('resize', () => {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
  initPieces();
});

// Load plastic data
let totalTons = 0;

fetch('data.json')
  .then(res => res.json())
  .then(data => {
    for (const c of data.countries) {
      totalTons += c.tons;
    }
  })
  .catch(() => console.warn('data.json missing'));

// Scroll progress
function getScroll() {
  const max = document.body.scrollHeight - window.innerHeight;
  if (max <= 0) {
    return 0;
  } 
  else {
    return Math.min(1, window.scrollY / max);
  }
}

// Background gradient
let bgGradient = null;
let lastScroll = -1;

function drawBg(scroll) {
  const step = Math.round(scroll * 700);
  if (step !== lastScroll) {
    lastScroll = step;
    bgGradient = ctx.createLinearGradient(0, 0, 0, H);
    bgGradient.addColorStop(0, interpolateRGB([0, 207, 255], [13, 37, 53], scroll));
    bgGradient.addColorStop(1, interpolateRGB([0, 92, 128], [8, 24, 32], scroll));
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, W, H);
}

// Plastic color
let plasticColor = 'rgb(218,238,255)';

function updatePlasticColor(scroll) {
  plasticColor = interpolateRGB([218, 238, 255], [122, 140, 145], scroll);
}

// Simplified shapes (removed line and ring, kept 4 main shapes)
const SHAPES = [
  // rectangle
  (sz) => {
    ctx.fillRect(-sz * 0.5, -sz * 0.5, sz, sz);
  },
  // ellipse
  (sz) => {
    ctx.beginPath();
    ctx.ellipse(0, 0, sz * 0.55, sz * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  },
  // triangle
  (sz) => {
    ctx.beginPath();
    ctx.moveTo(0, -sz * 0.5);
    ctx.lineTo(sz * 0.45, sz * 0.35);
    ctx.lineTo(-sz * 0.4, sz * 0.3);
    ctx.closePath();
    ctx.fill();
  },
  // circle
  (sz) => {
    ctx.beginPath();
    ctx.arc(0, 0, sz * 0.4, 0, Math.PI * 2);
    ctx.fill();
  },
];

// Sinking math (simplified)
function sinkProgress(global, delay) {
  return Math.max(0, Math.min(1, (global - delay) / (1 - delay + 0.001)));
}

function restY(piece) {
  const edge = Math.abs(piece.restX - W/2) / (W/2);
  return H - piece.size * 0.5 - edge * H * 0.04;
}

// Plastic pieces
const MAX_PIECES = 1000;
const pieces = [];

function makePiece() {
  return {
    x: Math.random() * W,
    y: Math.random() * H,
    size: randomRange(5, 30),
    rot: Math.random() * Math.PI * 2,
    rotSpd: randomRange(-0.01, 0.01),
    opacity: randomRange(0.3, 1.0),
    dx: randomRange(-0.15, 0.15),
    dy: randomRange(-0.05, 0.05),
    shape: Math.floor(Math.random() * 4),
    sinkDelay: Math.random(),
    sinkY: null,
    restX: Math.random() * W,
    restY: null,
    sunk: false,
  };
}

function initPieces() {
  pieces.length = 0;
  for (let i = 0; i < MAX_PIECES; i++) pieces.push(makePiece());
}
initPieces();

function drawPiece(p, globalSink) {
  let offX = 0, offY = 0;

  // Sinking logic
  if (globalSink > 0) {
    const sp = sinkProgress(globalSink, p.sinkDelay);
    if (sp > 0) {
      if (p.sinkY === null) {
        p.sinkY = p.y;
        p.restY = restY(p);
      }
      // Linear fall
      offX = (p.restX - p.x) * sp;
      offY = (p.restY - p.sinkY) * sp;
      if (sp >= 0.999) p.sunk = true;
    }
  }

  p.rot += p.rotSpd;

  // Sunk pieces - just sit at bottom
  if (p.sunk) {
    ctx.setTransform(1, 0, 0, 1, p.restX, p.restY);
    ctx.rotate(p.rot);
    ctx.globalAlpha = p.opacity * 0.9;
    ctx.fillStyle = plasticColor;
    SHAPES[p.shape](p.size);
    return;
  }

  // Floating movement
  p.x = (p.x + p.dx + W) % W;
  p.y = Math.max(H * 0.02, Math.min(H * 0.97, p.y + p.dy));
  if (p.y >= H * 0.97 || p.y <= H * 0.02) p.dy *= -1;

  ctx.setTransform(1, 0, 0, 1, p.x + offX, p.y + offY);
  ctx.rotate(p.rot);
  ctx.globalAlpha = p.opacity;
  ctx.fillStyle = plasticColor;
  SHAPES[p.shape](p.size);
}

// text overlays using CSS
const yearOverlay = document.getElementById('yearOverlay');
const messageOverlay = document.getElementById('messageOverlay');

// Sink animation state
let globalSink = 0;

function updateSink(scroll) {
  let target = scroll >= 0.98 ? 1 : 0;
  globalSink += (target - globalSink) * 0.004;

  if (globalSink < 0.01) {
    for (const p of pieces) {
      p.sunk = false;
      p.sinkY = null;
    }
  }
  return globalSink;
}

// Main animation loop
function draw() {
  const scroll = getScroll();
  const sink = updateSink(scroll);

  // Update mass counter
  const massElement = document.getElementById('massLabel');
  if (massElement) {
    massElement.innerText = Math.round(scroll * totalTons).toLocaleString() + ' tons';
  }

  // Update text overlays with CSS
  if (yearOverlay) {
    const fade = Math.min(1, scroll / 0.45);
    yearOverlay.style.opacity = (1 - fade) * 0.55;
  }

  if (messageOverlay) {
    if (sink >= 0.55) {
      const messageFade = Math.min(1, (sink - 0.55) / 0.20);
      messageOverlay.style.opacity = messageFade;
    } else {
      messageOverlay.style.opacity = 0;
    }
  }

  updatePlasticColor(scroll);
  drawBg(scroll);
  ctx.shadowBlur = 0;

  // Show more pieces as you scroll (linear instead of sqrt)
  const toShow = Math.floor(scroll * MAX_PIECES);
  for (let i = 0; i < toShow; i++) {
    drawPiece(pieces[i], sink);
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;

  requestAnimationFrame(draw);
}

requestAnimationFrame(draw);