const canvas = document.getElementById('oceanCanvas');
const ctx    = canvas.getContext('2d');

let W = canvas.width  = window.innerWidth;
let H = canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    _cachedBgBand = -1;
    initPieces();
    buildTrashText();
    buildMessageText();
});

// ── Data ─────────────────────────────────────────────────────────────────────
let totalTons = 0;
fetch('data.json')
    .then(r => r.json())
    .then(data => { for (const c of data.countries) totalTons += c.tons; })
    .catch(() => console.warn('Could not load data.json'));

// ── Scroll progress ───────────────────────────────────────────────────────────
function scrollProgress() {
    const max = document.body.scrollHeight - window.innerHeight;
    if (max <= 0) return 0;
    return Math.min(1, window.scrollY / max);
}

// ── Piece colour cache (only recalc when progress shifts noticeably) ──────────
let _lastPC = -1, _pieceColor = '', _glowColor = '';
function updatePieceColors(t) {
    if (Math.abs(t - _lastPC) < 0.005) return;
    _lastPC = t;
    const lerp = (a, b) => ((a + (b - a) * t + 0.5) | 0);
    _pieceColor = `rgb(${lerp(0xda,0x7a)},${lerp(0xee,0x8c)},${lerp(0xff,0x91)})`;
    _glowColor  = `rgb(${lerp(0xa8,0x3a)},${lerp(0xd8,0x4a)},${lerp(0xff,0x50)})`;
}

// ── Background gradient cache ─────────────────────────────────────────────────
let _cachedBgBand = -1, _gradBg = null;
function drawBackground(t) {
    const band = (t * 200 + 0.5) | 0;
    if (band !== _cachedBgBand) {
        _cachedBgBand = band;
        const l = (a, b) => ((a + (b - a) * t + 0.5) | 0);
        _gradBg = ctx.createLinearGradient(0, 0, 0, H);
        _gradBg.addColorStop(0, `rgb(${l(0x00,0x0d)},${l(0xcf,0x25)},${l(0xff,0x35)})`);
        _gradBg.addColorStop(1, `rgb(${l(0x00,0x08)},${l(0x5c,0x18)},${l(0x80,0x20)})`);
    }
    ctx.setTransform(1,0,0,1,0,0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = _gradBg;
    ctx.fillRect(0, 0, W, H);
}

// ── Plastic pieces ────────────────────────────────────────────────────────────
const MAX_PIECES = 1000;
const pieces = [];

function initPieces() {
    pieces.length = 0;
    for (let i = 0; i < MAX_PIECES; i++) {
        const s = 3 + Math.pow(Math.random(), 1.8) * 32;
        pieces.push({
            x:        ((Math.random() * W) + (Math.random() - 0.5) * W * 0.2 + W) % W,
            y:        H * 0.05 + Math.pow(Math.random(), 0.7) * H * 0.88,
            size:     s,
            ax:       0.3 + Math.random() * 1.4,
            ay:       0.3 + Math.random() * 1.4,
            rot:      Math.random() * Math.PI * 2,
            rotSpd:   (Math.random() < 0.15 ? 1 : 0.08) * (Math.random() - 0.5) * 0.06,
            opacity:  0.3 + Math.random() * 0.65,
            dx:       (Math.random() - 0.5) * 0.22,
            dy:       (Math.random() - 0.5) * 0.05,
            wAmp:     Math.random() * 6,
            wFreq:    0.0008 + Math.random() * 0.003,
            wOff:     Math.random() * Math.PI * 2,
            shape:    Math.floor(Math.random() * 6),
            bp:       Array.from({length:6}, () => (Math.random()-0.5)*0.7),
            sinkDelay:Math.random(),
            floater:  Math.random() < 0.30,
            sinkY:    null,
            restX:    Math.random() * W,
            restY:    null,
            sunk:     false,
        });
    }
}
initPieces();

// Each entry draws one shape type given (size, ax, ay, bp).
// Stored as functions so shape selection is a simple array lookup — no switch needed.
const SHAPE_DRAWERS = [
    // 0: rectangle
    (sz, ax, ay) => ctx.fillRect(-sz*ax*0.5, -sz*ay*0.5, sz*ax, sz*ay),
    // 1: ellipse
    (sz, ax, ay) => { ctx.beginPath(); ctx.ellipse(0,0,sz*ax*0.55,sz*ay*0.3,0,0,Math.PI*2); ctx.fill(); },
    // 2: irregular triangle
    (sz, ax, ay, bp) => {
        ctx.beginPath();
        ctx.moveTo(0,               -sz*(0.5+bp[0]*0.3));
        ctx.lineTo( sz*(0.45+bp[1]*0.25),  sz*(0.35+bp[2]*0.2));
        ctx.lineTo(-sz*(0.4 +bp[3]*0.25),  sz*(0.3 +bp[4]*0.2));
        ctx.closePath(); ctx.fill();
    },
    // 3: line / straw
    (sz, ax) => { ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(-sz*ax*0.7,-sz*0.08); ctx.lineTo(sz*ax*0.7,sz*0.08); ctx.stroke(); },
    // 4: blob polygon
    (sz, ax, ay, bp) => {
        ctx.beginPath();
        for (let j=0;j<5;j++) {
            const a=j/5*Math.PI*2, r=sz*(0.35+bp[j%6]*0.3);
            j ? ctx.lineTo(Math.cos(a)*r*ax, Math.sin(a)*r*ay)
              : ctx.moveTo(Math.cos(a)*r*ax, Math.sin(a)*r*ay);
        }
        ctx.closePath(); ctx.fill();
    },
    // 5: ring
    (sz, ax) => { ctx.lineWidth=sz*0.15; ctx.beginPath(); ctx.arc(0,0,sz*0.3*ax,0,Math.PI*2); ctx.stroke(); },
];

function drawShape(p) {
    SHAPE_DRAWERS[p.shape](p.size, p.ax, p.ay, p.bp);
}

function drawPiece(p, time, sinkProgress) {
    let sx=0, sy=0, sRot=0;

    if (sinkProgress > 0 && !p.floater) {
        const lp = Math.max(0, (sinkProgress - p.sinkDelay) / (1 - p.sinkDelay + 0.001));
        if (lp > 0) {
            if (p.sinkY === null) {
                p.sinkY = p.y;
                p.restY = H - p.size*(0.5+p.wAmp*0.2) - Math.abs(p.restX-W*0.5)/(W*0.5)*H*0.04;
            }
            const fall = lp<0.7 ? Math.pow(lp/0.7,1.8)*0.85 : 0.85+(lp-0.7)/0.3*0.15;
            sx   = (p.restX - p.x) * fall;
            sy   = (p.restY - p.sinkY) * fall;
            sRot = lp * Math.PI * (2+p.sinkDelay*3) * (1-fall*0.9);
            if (lp >= 0.999) p.sunk = true;
        }
    }

    if (p.sunk) {
        ctx.globalAlpha = p.opacity * 0.9;
        ctx.fillStyle = _pieceColor; ctx.strokeStyle = _glowColor;
        ctx.setTransform(1,0,0,1,p.restX,p.restY);
        ctx.rotate(p.rot);
        drawShape(p);
        return;
    }

    p.x = (p.x + p.dx + W) % W;
    p.y = Math.max(H*0.02, Math.min(H*0.97, p.y + p.dy));
    if (p.y >= H*0.97 || p.y <= H*0.02) p.dy *= -1;

    const wobble = Math.sin(time * p.wFreq + p.wOff) * p.wAmp;
    p.rot += p.rotSpd;

    ctx.globalAlpha = p.opacity * (0.85 + 0.15*Math.sin(time*0.0018 + p.x*0.01));
    ctx.fillStyle = _pieceColor; ctx.strokeStyle = _glowColor;
    ctx.setTransform(1,0,0,1, p.x+sx, p.y+wobble+sy);
    ctx.rotate(p.rot + sRot);
    drawShape(p);
}

// ── Pixel-mask text builder (shared by both text systems) ─────────────────────
function buildTextPieces(text, fontStr, maxCount, stride, threshold) {
    const oc = document.createElement('canvas');
    oc.width = W; oc.height = Math.ceil(H * 0.4);
    const ox = oc.getContext('2d');
    ox.clearRect(0,0,oc.width,oc.height);
    ox.font = fontStr; ox.fillStyle='#fff'; ox.textBaseline='top';
    const tw = ox.measureText(text).width;
    ox.fillText(text, (W-tw)/2, 0);
    const px = ox.getImageData(0,0,oc.width,oc.height).data;
    const hits = [];
    for (let y=0; y<oc.height; y+=stride)
        for (let x=0; x<oc.width; x+=stride)
            if (px[(y*oc.width+x)*4+3] > threshold) hits.push([x,y]);
    for (let i=hits.length-1;i>0;i--){const j=(Math.random()*(i+1))|0;[hits[i],hits[j]]=[hits[j],hits[i]];}
    return hits.slice(0, maxCount);
}

// ── "2019" trash text ─────────────────────────────────────────────────────────
let _trashPieces = [], _trashReady = false;
function buildTrashText() {
    const fontSize = Math.min(W*0.38, 300);
    const glyphH   = Math.round(fontSize*1.3);
    const offsetY  = (H - glyphH) * 0.42;
    const hits     = buildTextPieces('2019', `900 ${fontSize}px Arial,sans-serif`, 700, 3, 128);
    _trashPieces = hits.map(([cx,cy]) => {
        const ox=cx+(Math.random()-0.5)*4, oy=cy+offsetY+(Math.random()-0.5)*4;
        return {
            x:ox, y:oy, ox, oy,
            size: 1.5+Math.random()*5,
            rot:  Math.random()*Math.PI*2,
            rotSpd:(Math.random()-0.5)*0.04,
            shape:Math.floor(Math.random()*4),
            ax:0.4+Math.random()*1.2, ay:0.4+Math.random()*1.2,
            bp: Array.from({length:6},()=>(Math.random()-0.5)*0.7),
            dx:(Math.random()-0.5)*2, dy:(Math.random()-0.5)*2,
            wAmp:1+Math.random()*3, wFreq:0.001+Math.random()*0.003, wOff:Math.random()*Math.PI*2,
            sinkDelay:Math.random(),
            restX:20+Math.random()*(W-40), restY:null,
            spinDir:Math.random()<0.5?1:-1,
        };
    });
    _trashReady = true;
}
buildTrashText();

function drawTrashText(progress, time, sinkProgress) {
    const fadeT = Math.min(1, progress/0.45);
    const alpha = (1-fadeT)*0.55;
    if (alpha <= 0 || !_trashReady) return;
    const colT = Math.min(1, progress/0.6);
    const l=(a,b)=>((a+(b-a)*colT+0.5)|0);
    const col = `rgb(${l(0xda,0x7a)},${l(0xee,0x8c)},${l(0xff,0x91)})`;
    ctx.setTransform(1,0,0,1,0,0);
    for (const p of _trashPieces) {
        const scX = p.dx*fadeT*fadeT*W*0.35, scY = p.dy*fadeT*fadeT*H*0.35;
        let sox=0,soy=0,spin=0;
        if (sinkProgress > 0) {
            const lp = Math.max(0,(sinkProgress-p.sinkDelay)/(1-p.sinkDelay+0.001));
            if (lp > 0) {
                if (!p.restY) {
                    p.restY = H - p.size*1.5 - Math.abs(p.restX-W*0.5)/(W*0.5)*H*0.04;
                }
                const fall = lp<0.7 ? Math.pow(lp/0.7,1.8)*0.85 : 0.85+(lp-0.7)/0.3*0.15;
                sox=(p.restX-p.ox)*fall; soy=(p.restY-p.oy)*fall;
                spin=lp*Math.PI*(2+p.sinkDelay*3)*(1-fall*0.9)*p.spinDir;
            }
        }
        const wob = sinkProgress>0 ? 0 : Math.sin(time*p.wFreq+p.wOff)*p.wAmp;
        p.rot += p.rotSpd;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = ctx.strokeStyle = col;
        ctx.setTransform(p.ax,0,0,p.ay, p.x+sox+scX, p.y+wob+soy+scY);
        ctx.rotate(p.rot+spin);
        SHAPE_DRAWERS[p.shape](p.size, p.ax, p.ay, p.bp);
    }
    ctx.globalAlpha=1;
}

// ── End message ───────────────────────────────────────────────────────────────
let _msgPieces=[], _msgReady=false;
function buildMessageText() {
    _msgPieces=[];
    const lines = ["The ocean doesn't forget", "about what we throw away."];
    const fs    = Math.max(28, Math.min(W*0.075, 72));
    const lineH = fs*1.45;
    const topY  = H*0.5 - lineH;
    lines.forEach((line, li) => {
        const hits = buildTextPieces(line, `700 ${fs}px Arial,sans-serif`, 2000, 2, 80);
        const screenY = topY + li*lineH;
        for (const [cx,cy] of hits) {
            _msgPieces.push({
                x:cx+(Math.random()-0.5)*3, y:screenY+cy+(Math.random()-0.5)*3,
                size:2.5+Math.random()*3,
                rot:Math.random()*Math.PI*2, rotSpd:(Math.random()-0.5)*0.025,
                shape:Math.floor(Math.random()*4),
                ax:0.7+Math.random()*0.5, ay:0.7+Math.random()*0.5,
                bp:Array.from({length:6},()=>(Math.random()-0.5)*0.7),
                wAmp:0.3+Math.random()*1, wFreq:0.0008+Math.random()*0.002, wOff:Math.random()*Math.PI*2,
                revealAt:0.55+Math.random()*0.45,
            });
        }
    });
    _msgReady=true;
}
buildMessageText();

function drawMessageText(sinkProgress, time) {
    if (!_msgReady || sinkProgress < 0.55) return;
    const msgA = Math.min(1,(sinkProgress-0.55)/0.20);
    if (msgA <= 0) return;
    ctx.setTransform(1,0,0,1,0,0);
    for (const p of _msgPieces) {
        const pa = msgA * Math.min(1,Math.max(0,(sinkProgress-p.revealAt)/0.05));
        if (pa < 0.02) continue;
        const wob = Math.sin(time*p.wFreq+p.wOff)*p.wAmp;
        p.rot += p.rotSpd;
        ctx.globalAlpha = pa*0.98;
        ctx.fillStyle='#d8eef5'; ctx.strokeStyle='#aaced8';
        ctx.setTransform(p.ax,0,0,p.ay,p.x,p.y+wob);
        ctx.rotate(p.rot);
        SHAPE_DRAWERS[p.shape](p.size, p.ax, p.ay, p.bp);
    }
    ctx.globalAlpha=1;
}

// ── Sink progress ─────────────────────────────────────────────────────────────
let _sinkSmoothed=0;
function getSinkProgress(p) {
    _sinkSmoothed += ((p>=0.98?1:0) - _sinkSmoothed)*0.004;
    if (_sinkSmoothed < 0.01) {
        for (const pc of pieces) { pc.sunk=false; pc.sinkY=null; }
    }
    return _sinkSmoothed;
}

// ── Main loop ─────────────────────────────────────────────────────────────────
function draw() {
    const progress = scrollProgress();
    const time     = Date.now();
    const sink     = getSinkProgress(progress);

    document.getElementById('massLabel').innerText =
        Math.round(progress*totalTons).toLocaleString()+' tons';

    updatePieceColors(progress);
    drawBackground(progress);

    ctx.shadowBlur=0;
    const count = Math.floor(progress*MAX_PIECES);
    for (let i=0;i<count;i++) drawPiece(pieces[i], time, sink);

    ctx.setTransform(1,0,0,1,0,0); ctx.globalAlpha=1;
    drawTrashText(progress, time, sink);
    drawMessageText(sink, time);

    requestAnimationFrame(draw);
}

document.body.style.minHeight='400vh';
document.getElementById('yearLabel').style.display='none';
requestAnimationFrame(draw);