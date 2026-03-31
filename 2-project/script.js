// Plastic Ocean
// scroll down and watch the plastic pile up

const canvas = document.getElementById('oceanCanvas');
const ctx = canvas.getContext('2d');

let W = canvas.width = window.innerWidth;
let H = canvas.height = window.innerHeight;

// load the data representing how much plastic each country dumps
let totalTons = 0;

fetch('data.json')
  .then(res => res.json())
  .then(data => {
    for (const c of data.countries) {
      totalTons += c.tons;
    }
  })
  .catch(() => console.warn('data.json missing'));

function getScroll() {
  const max = document.body.scrollHeight - window.innerHeight;
  if (max <= 0) {
    return 0;
  } 
  else {
    return Math.min(1, window.scrollY / max);
  }
}

// background gradient that darkens as you scroll down
let bgGradient = null;
let lastScroll = -1;

function drawBg(scroll) {
  const step = Math.round(scroll * 700);
  if (step !== lastScroll) {
    lastScroll = step;
    bgGradient = ctx.createLinearGradient(0, 0, 0, H);
    bgGradient.addColorStop(0, `rgb(${Math.round(0  + (13 -  0) * scroll)}, 
    ${Math.round(207 + (37  - 207) * scroll)}, ${Math.round(255 + (53  - 255) * scroll)})`);
    bgGradient.addColorStop(1, `rgb(${Math.round(0  + (8  -  0) * scroll)}, 
    ${Math.round(92  + (24  -  92) * scroll)}, ${Math.round(128 + (32  - 128) * scroll)})`);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0,0,W,H);
}

let plasticColor = 'rgb(218,238,255)';

function updatePlasticColor(scroll) {
  plasticColor = `rgb(${Math.round(218 + (122 - 218) * scroll)}, ${Math.round(238 + (140 - 238) * scroll)}, ${Math.round(255 + (145 - 255) * scroll)})`;
}

// shape definitions. Each draws at origin around (0,0)
const SHAPES = [
  // rectangle
  (sz, sx, sy) => {
    ctx.fillRect(-sz*sx*0.5, -sz*sy*0.5, sz*sx, sz*sy);
  },
  // ellipse
  (sz, sx, sy) => {
    ctx.beginPath();
    ctx.ellipse(0,0, sz*sx*0.55, sz*sy*0.3, 0,0,Math.PI*2);
    ctx.fill();
  },
  // weird triangle
  (sz, sx, sy, bp) => {
    ctx.beginPath();
    ctx.moveTo(0, -sz*(0.5 + bp[0]*0.3));
    ctx.lineTo( sz*(0.45 + bp[1]*0.25), sz*(0.35 + bp[2]*0.2));
    ctx.lineTo(-sz*(0.4 + bp[3]*0.25), sz*(0.3 + bp[4]*0.2));
    ctx.closePath();
    ctx.fill();
  },
  // line/straw thing
  (sz, sx) => {
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-sz*sx*0.7, -sz*0.08);
    ctx.lineTo(sz*sx*0.7, sz*0.08);
    ctx.stroke();
  },
  // blob with 5 randomish sides
  (sz, sx, sy, bp) => {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const ang = (i/5) * Math.PI * 2;
      const r = sz * (0.35 + bp[i%6]*0.3);
      const x = Math.cos(ang) * r * sx;
      const y = Math.sin(ang) * r * sy;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.fill();
  },
  // ring/donut
  (sz, sx) => {
    ctx.lineWidth = sz * 0.15;
    ctx.beginPath();
    ctx.arc(0,0, sz*0.3*sx, 0, Math.PI*2);
    ctx.stroke();
  },
];

// sinking math
function sinkProgress(global, delay) {
  return Math.max(0, (global - delay) / (1 - delay + 0.001));
}

function fallCurve(t) {
  if (t < 0.7) {
    return (t / 0.7) * (t / 0.7) * 0.85;
  }
  return 0.85 + (t - 0.7) / 0.3 * 0.15;
}

function restY(piece) {
  const edge = Math.abs(piece.restX - W/2) / (W/2);
  return H - piece.size * 0.5 - edge * H * 0.04;
}

// create all the plastic pieces by randomly generating their features
const MAX_PIECES = 1000;
const pieces = [];

function makePiece() {
  return {
    x: (Math.random() * W) % W, 
    y: (Math.random() * H) % H, 
    size: 5 + Math.random() * 30, 
    ax: 0.5 + Math.random(), 
    ay: 0.5 + Math.random(), 
    rot: Math.random() * Math.PI * 2,
    rotSpd: (Math.random() - 0.5) * 0.01,
    opacity: 0.3 + Math.random() * 0.7,
    dx: (Math.random() - 0.5) * 0.1,
    dy: (Math.random() - 0.5) * 0.03,
    wAmp: Math.random() * 4,
    wFreq: 0.001 + Math.random() * 0.002, 
    wOff: Math.random() * Math.PI * 2,
    shape: Math.floor(Math.random() * 6),
    bp: Array.from({ length: 6 }, () => Math.random() - 0.5),
    sinkDelay: Math.random(),  
    floater: Math.random() < 0.3, 
    sinkY: null,
    restX: Math.random() * W,
    restY: null,
    sunk: false,
  };
}

function initPieces() {
  pieces.length = 0;
  for (let i = 0; i < MAX_PIECES; i++) {
    pieces.push(makePiece());
  }
}
initPieces();

function drawPiece(p, now, globalSink) {
  let offX = 0;
  let offY = 0; 
  let spinBonus = 0;

  if (globalSink > 0 && !p.floater) {
    const sp = sinkProgress(globalSink, p.sinkDelay);
    if (sp > 0) {
      if (p.sinkY === null) {
        p.sinkY = p.y;
        p.restY = restY(p);
      }
      const fall = fallCurve(sp);
      offX = (p.restX - p.x) * fall;
      offY = (p.restY - p.sinkY) * fall;
      spinBonus = sp * Math.PI * (2 + p.sinkDelay * 3) * (1 - fall * 0.9);
      if (sp >= 0.999) p.sunk = true;
    }
  }

  p.rot += p.rotSpd;

  // sunk pieces just sit there
  if (p.sunk) {
    ctx.setTransform(1,0,0,1, p.restX, p.restY);
    ctx.rotate(p.rot);
    ctx.globalAlpha = p.opacity * 0.9;
    ctx.fillStyle = plasticColor;
    ctx.strokeStyle = plasticColor;
    SHAPES[p.shape](p.size, p.ax, p.ay, p.bp);
    return;
  }

  // makes plastic float around
  p.x = (p.x + p.dx + W) % W;
  p.y = Math.max(H * 0.02, Math.min(H * 0.97, p.y + p.dy));
  if (p.y >= H * 0.97 || p.y <= H * 0.02) p.dy *= -1;

  const bob = Math.sin(now * p.wFreq + p.wOff) * p.wAmp;
  const pulse = 0.85 + 0.15 * Math.sin(now * 0.002 + p.x * 0.01);

  ctx.setTransform(1,0,0,1, p.x + offX, p.y + bob + offY);
  ctx.rotate(p.rot + spinBonus);
  ctx.globalAlpha = p.opacity * pulse;
  ctx.fillStyle = plasticColor;
  ctx.strokeStyle = plasticColor;
  SHAPES[p.shape](p.size, p.ax, p.ay, p.bp);
}

// turn text into pixel positions. Used for "2019" and the message
function textToPixels(txt, font, maxPoints, step, minAlpha) {
  const tmp = document.createElement('canvas');
  tmp.width = W;
  tmp.height = Math.ceil(H * 0.4);
  const tctx = tmp.getContext('2d');
  tctx.font = font;
  tctx.fillStyle = '#fff';
  tctx.textBaseline = 'top';
  const w = tctx.measureText(txt).width;
  tctx.fillText(txt, (W - w)/2, 0);

  const data = tctx.getImageData(0,0, tmp.width, tmp.height).data;
  const points = [];

  for (let y = 0; y < tmp.height; y += step) {
    for (let x = 0; x < tmp.width; x += step) {
      if (data[(y * tmp.width + x) * 4 + 3] > minAlpha) {
        points.push([x, y]);
      }
    }
  }

  // shuffle so the plastic is not in grid order
  for (let i = points.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [points[i], points[j]] = [points[j], points[i]];
  }

  return points.slice(0, maxPoints);
}

function makeParticle(x, y, shapes, minSize, sizeRange, spinSpeed) {
  return {
    x, y,
    originX: x,
    originY: y,
    size: minSize + Math.random() * sizeRange,
    rot: Math.random() * Math.PI * 2,
    rotSpd: (Math.random() - 0.5) * spinSpeed,
    shape: Math.floor(Math.random() * shapes),
    ax: 0.4 + Math.random() * 1.2,
    ay: 0.4 + Math.random() * 1.2,
    bp: Array.from({ length: 6 }, () => (Math.random() - 0.5) * 0.7),
    wAmp: 0.5 + Math.random() * 2,
    wFreq: 0.001 + Math.random() * 0.003,
    wOff: Math.random() * Math.PI * 2,
  };
}

// "2019" text made of trash particles
let yearParticles = [];

function initYearText() {
  const fontSize = Math.min(W * 0.38, 300);
  const textH = Math.round(fontSize * 1.3);
  const topY = (H - textH) * 0.42;

  const pixels = textToPixels('2019', `900 ${fontSize}px Arial, sans-serif`, 700, 3, 128);

  yearParticles = pixels.map(([px, py]) => {
    const p = makeParticle(
      px + (Math.random() - 0.5) * 4,
      py + topY + (Math.random() - 0.5) * 4,
      4, 1.5, 5, 0.04
    );
    p.scatterX = (Math.random() - 0.5) * 2;
    p.scatterY = (Math.random() - 0.5) * 2;
    p.sinkDelay = Math.random();
    p.restX = 20 + Math.random() * (W - 40);
    p.restY = null;
    p.spinDir = Math.random() < 0.5 ? 1 : -1;
    return p;
  });
}
initYearText();

function drawYearText(scroll, now, globalSink) {
  const fade = Math.min(1, scroll / 0.45);
  const alpha = (1 - fade) * 0.55;
  if (alpha <= 0) return;

  const t = Math.min(1, scroll / 0.6);
  const color = `rgb(${Math.round(218 + (122 - 218) * t)}, 
  ${Math.round(238 + (140 - 238) * t)}, ${Math.round(255 + (145 - 255) * t)})`;
  ctx.setTransform(1,0,0,1,0,0);

  for (const p of yearParticles) {
    const scatter = fade * fade;
    let offX = p.scatterX * scatter * W * 0.35;
    let offY = p.scatterY * scatter * H * 0.35;
    let spin = 0;

    if (globalSink > 0) {
      const sp = sinkProgress(globalSink, p.sinkDelay);
      if (sp > 0) {
        if (!p.restY) {
          const edge = Math.abs(p.restX - W/2) / (W/2);
          p.restY = H - p.size * 1.5 - edge * H * 0.04;
        }
        const fall = fallCurve(sp);
        offX += (p.restX - p.originX) * fall;
        offY += (p.restY - p.originY) * fall;
        spin = sp * Math.PI * (2 + p.sinkDelay * 3) * (1 - fall * 0.9) * p.spinDir;
      }
    }

    let bob = 0;
    if (globalSink <= 0) {
      bob = Math.sin(now * p.wFreq + p.wOff) * p.wAmp;
    }
    p.rot += p.rotSpd;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.setTransform(p.ax,0,0,p.ay, p.x + offX, p.y + bob + offY);
    ctx.rotate(p.rot + spin);
    SHAPES[p.shape](p.size, p.ax, p.ay, p.bp);
  }
  ctx.globalAlpha = 1;
}

// end message that appears when you scroll to the bottom
let messageParticles = [];

function initMessage() {
  messageParticles = [];
  const lines = ["The ocean doesn't forget", "about what we throw away."];
  const fontSize = Math.max(28, Math.min(W * 0.075, 72));
  const lineH = fontSize * 1.45;
  const startY = H * 0.5 - lineH;

  lines.forEach((line, i) => {
    const pixels = textToPixels(line, `900 ${fontSize}px Arial, sans-serif`, 2000, 1, 80);
    const lineY = startY + i * lineH;
    for (const [px, py] of pixels) {
      const p = makeParticle(
        px + (Math.random() - 0.5) * 2,
        lineY + py + (Math.random() - 0.5) * 2,
        4, 2.2, 2, 0.015
      );
      p.ax = 0.8 + Math.random() * 0.3;
      p.ay = 0.8 + Math.random() * 0.3;
      p.revealAt = 0.55 + Math.random() * 0.45;
      messageParticles.push(p);
    }
  });
}
initMessage();

function drawMessage(globalSink, now) {
  if (globalSink < 0.55) return;

  const overall = Math.min(1, (globalSink - 0.55) / 0.20);
  if (overall <= 0) return;

  ctx.setTransform(1,0,0,1,0,0);

  for (const p of messageParticles) {
    const alpha = overall * Math.min(1, Math.max(0, (globalSink - p.revealAt) / 0.05));
    if (alpha < 0.02) continue;

    const bob = Math.sin(now * p.wFreq + p.wOff) * p.wAmp;
    p.rot += p.rotSpd;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#eef8ff';
    ctx.strokeStyle = '#c8e8f5';
    ctx.setTransform(p.ax,0,0,p.ay, p.x, p.y + bob);
    ctx.rotate(p.rot);
    SHAPES[p.shape](p.size, p.ax, p.ay, p.bp);
  }
  ctx.globalAlpha = 1;
}

// sink animation state
let globalSink = 0;

function updateSink(scroll) {
  let target = 0;
  if (scroll >= 0.98) {
    target = 1;
  }
  globalSink += (target - globalSink) * 0.004;

  if (globalSink < 0.01) {
    for (const p of pieces) {
      p.sunk = false;
      p.sinkY = null;
    }
  }
  return globalSink;
}

// main animation loop
function draw() {
  const scroll = getScroll();
  const now = Date.now();
  const sink = updateSink(scroll);

  document.getElementById('massLabel').innerText =
    Math.round(scroll * totalTons).toLocaleString() + ' tons';

  updatePlasticColor(scroll);
  drawBg(scroll);
  ctx.shadowBlur = 0;

  // show more pieces as you scroll. sqrt makes it fill faster at first
  const toShow = Math.floor(Math.sqrt(scroll) * MAX_PIECES);
  for (let i = 0; i < toShow; i++) {
    drawPiece(pieces[i], now, sink);
  }

  ctx.setTransform(1,0,0,1,0,0);
  ctx.globalAlpha = 1;

  drawYearText(scroll, now, sink);
  drawMessage(sink, now);

  requestAnimationFrame(draw);
}

requestAnimationFrame(draw);