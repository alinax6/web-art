// What happens as you scroll:
//  0%: "2019" spelled out in floating trash particles
//  45%: "2019" fully scattered away, ocean filling with plastic
//  98%: trash sinks to the bottom, message assembles
//  

const canvas = document.getElementById('oceanCanvas');
const ctx = canvas.getContext('2d');

// W and H store the canvas size
let W = canvas.width  = window.innerWidth;
let H = canvas.height = window.innerHeight;

let resizeTimer = null;
let lastW = W;

window.addEventListener('resize', () => {
    const newW = window.innerWidth;
    const newH = window.innerHeight;

    // Ignore height-only changes — these are caused by the mobile browser
    // toolbar collapsing/expanding during scroll, not a real layout change
    if (newW === lastW && Math.abs(newH - H) < 150) return;

    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        lastW = newW;
        W = canvas.width = newW;
        H = canvas.height = newH;
        gradientCache = null;
        createPieces();
        create2019Text();
        createMessageText();
    }, 200);
});


// load data from json file
let totalTons = 0; // filled in from data.json

fetch('data.json')
    .then(r => r.json())
    .then(data => {
        for (const country of data.countries) totalTons += country.tons;
    })
    .catch(() => console.warn('Could not load data.json'));

// scroll functionality. It returns a number from 0 (top of page) to 1 (bottom of page)
function getScroll() {
    const pageHeight = document.body.scrollHeight;
    const windowHeight = window.innerHeight;
    const maxScroll = pageHeight - windowHeight;
    if (maxScroll <= 0) return 0;
    return Math.min(1, window.scrollY / maxScroll);
}

// color helper functions
// Mix between two values — t=0 gives a, t=1 gives b
function mix(a, b, t) {
    return Math.round(a + (b - a) * t);
}

// Build a CSS colour string by blending two RGB colours
function mixColor(r1,g1,b1,  r2,g2,b2,  t) {
    return `rgb(${mix(r1,r2,t)}, ${mix(g1,g2,t)}, ${mix(b1,b2,t)})`;
}


// background darken from brighter blue to darker blue blue as you scroll
let gradientCache     = null;
let gradientScrollBand = -1; // track last scroll value so we don't rebuild every frame

function drawBackground(scroll) {
    // Rebuild the gradient only when scroll changes enough to notice (~0.1%)
    const band = Math.round(scroll * 700);
    if (band !== gradientScrollBand) {
        gradientScrollBand = band;

        gradientCache = ctx.createLinearGradient(0, 0, 0, H);
        // top of the screen is bright blue
        gradientCache.addColorStop(0, mixColor(0,207,255,  13,37,53,  scroll));
        // bottom of the screen is dark blue
        gradientCache.addColorStop(1, mixColor(0, 92,128,   8,24,32,  scroll));
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle   = gradientCache;
    ctx.fillRect(0, 0, W, H);
}

// plastic piece colors
let lastColorScroll = -1;
let pieceColor = 'rgb(218,238,255)';
let glowColor  = 'rgb(168,216,255)';

function updatePieceColors(scroll) {
    // Only recalculate when scroll moves enough (saves a tiny bit of work)
    if (Math.abs(scroll - lastColorScroll) < 0.005) return;
    lastColorScroll = scroll;

    // Pale blue/white turns into grey
    pieceColor = mixColor(218,238,255,  122,140,145,  scroll);
    // Bright glow turns into dull glow
    glowColor  = mixColor(168,216,255,   58, 74, 80,  scroll);
}

// shape drawing. Each shape is function that draws on the canvas at position (0,0).
// The canvas is moved with ctx.setTransform()
const SHAPES = [
    // Rectangle represents bottle caps and packaging
    (size, sx, sy) =>
        ctx.fillRect(-size*sx*0.5, -size*sy*0.5, size*sx, size*sy),

    // Ellipse represents plastic bags 
    (size, sx, sy) => {
        ctx.beginPath();
        ctx.ellipse(0, 0, size*sx*0.55, size*sy*0.3, 0, 0, Math.PI*2);
        ctx.fill();
    },

    // Triangle represents broken plastic pieces
    // bp[] = pre-baked random offsets that make each triangle slightly different
    (size, sx, sy, bp) => {
        ctx.beginPath();
        ctx.moveTo(0, -size*(0.5  + bp[0]*0.3));
        ctx.lineTo( size*(0.45 + bp[1]*0.25), size*(0.35 + bp[2]*0.2));
        ctx.lineTo(-size*(0.4  + bp[3]*0.25), size*(0.3  + bp[4]*0.2));
        ctx.closePath();
        ctx.fill();
    },

    // Thin line represents straws and fishing line
    (size, sx) => {
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-size*sx*0.7, -size*0.08);
        ctx.lineTo( size*sx*0.7,  size*0.08);
        ctx.stroke();
    },

    // Blob polygon represents crumpled pieces
    (size, sx, sy, bp) => {
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const angle  = (i / 5) * Math.PI * 2;
            const radius = size * (0.35 + bp[i % 6] * 0.3);
            const px = Math.cos(angle) * radius * sx;
            const py = Math.sin(angle) * radius * sy;
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
    },

    // Ring represents bottle tops and plastic rings
    (size, sx) => {
        ctx.lineWidth = size * 0.15;
        ctx.beginPath();
        ctx.arc(0, 0, size*0.3*sx, 0, Math.PI*2);
        ctx.stroke();
    },
];

// Draw a shape by moving the canvas coordinate system to (x, y) first
function drawShapeAt(piece, x, y, alpha, fillColor, strokeColor) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = fillColor || pieceColor;
    ctx.strokeStyle = strokeColor || glowColor;
    ctx.setTransform(piece.ax, 0, 0, piece.ay, x, y);
    ctx.rotate(piece.rot);
    SHAPES[piece.shape](piece.size, piece.ax, piece.ay, piece.bp);
}

// sinking helper functions
// 0 represents the sinking has not started and 1 represents its fully sunken
// sinkDelay staggers the pieces so they fall one by one rather than all at once
function getSinkProgress(globalSink, sinkDelay) {
    return Math.max(0, (globalSink - sinkDelay) / (1 - sinkDelay + 0.001));
}

// The fall curve starts fast and slows down as the piece settles into the pile
function getFallAmount(progress) {
    if (progress < 0.7) {
        return Math.pow(progress / 0.7, 1.8) * 0.85;
    }

    return 0.85 + ((progress - 0.7) / 0.3) * 0.15;
}

// Allows pieces near the edge to pile lower
function calcRestY(piece) {
    const distFromCentre = Math.abs(piece.restX - W * 0.5) / (W * 0.5);
    return H - piece.size * (0.5 + piece.wAmp * 0.2) - distFromCentre * H * 0.04;
}

// floating plastic pieces
const MAX_PIECES = 1000;
const pieces     = [];

// randomly generates different plastic piece properties
function makePiece() {
    return {
        // Start at a random position, towards the upper part of the screen
        x: ((Math.random() * W) + (Math.random() - 0.5) * W * 0.2 + W) % W,
        y: H * 0.05 + Math.pow(Math.random(), 0.7) * H * 0.88,

        size: 3 + Math.pow(Math.random(), 1.8) * 32, // mostly small, some large
        ax: 0.3 + Math.random() * 1.4,   // x stretch (makes shapes varied)
        ay: 0.3 + Math.random() * 1.4,   // y stretch
        rot: Math.random() * Math.PI * 2,  // random starting angle
        rotSpd: (Math.random() < 0.15 ? 1 : 0.08) * (Math.random() - 0.5) * 0.06,
        opacity: 0.3 + Math.random() * 0.65,
        dx: (Math.random() - 0.5) * 0.22, // horizontal float speed
        dy: (Math.random() - 0.5) * 0.05, // vertical float speed
        wAmp: Math.random() * 6,             // how much it bobs up and down
        wFreq: 0.0008 + Math.random() * 0.003,// how fast it bobs
        wOff: Math.random() * Math.PI * 2,   // timing offset (so not all in sync)
        shape: Math.floor(Math.random() * 6),
        bp: Array.from({length: 6}, () => (Math.random() - 0.5) * 0.7),

        sinkDelay: Math.random(),       // delay before this piece starts sinking (0–1)
        floater: Math.random() < 0.3, // 30% of pieces never sink (always visible)
        sinkY: null,                // y position when sinking started
        restX: Math.random() * W,   // x position in the final pile
        restY: null,
        sunk: false,               // true once it has reached the bottom
    };
}

// creates the plastic pieces based off their random properties from makePiece
function createPieces() {
    pieces.length = 0;
    for (let i = 0; i < MAX_PIECES; i++) {
        pieces.push(makePiece());
    }
}
createPieces();

function drawPiece(p, time, globalSink) {
    let offsetX = 0, offsetY = 0, extraSpin = 0;

    // Calculate sinking offset if this piece should be falling
    if (globalSink > 0 && !p.floater) {
        const sinkProgress = getSinkProgress(globalSink, p.sinkDelay);

        if (sinkProgress > 0) {
            // Remember where it started falling so it can compute the offset
            if (p.sinkY === null) {
                p.sinkY = p.y;
                p.restY = calcRestY(p);
            }

            const fall = getFallAmount(sinkProgress);
            offsetX = (p.restX - p.x) * fall;
            offsetY = (p.restY - p.sinkY) * fall;
            extraSpin = sinkProgress * Math.PI * (2 + p.sinkDelay * 3) * (1 - fall * 0.9);

            if (sinkProgress >= 0.999) {
                p.sunk = true;
            }
        }
    }

    // spin plastic a little each frame
    p.rot += p.rotSpd; 

    // Once plastic sinks, keep it frozen in place at the bottom pile
    if (p.sunk) {
        ctx.setTransform(1, 0, 0, 1, p.restX, p.restY);
        ctx.rotate(p.rot);
        ctx.globalAlpha = p.opacity * 0.9;
        ctx.fillStyle = pieceColor;
        ctx.strokeStyle = glowColor;
        SHAPES[p.shape](p.size, p.ax, p.ay, p.bp);
        return;
    }

    // Plastic floats around the screen
    // drift left/right, wrap edges
    p.x = (p.x + p.dx + W) % W;
    // drift up/down, clamp to screen
    p.y = Math.max(H*0.02, Math.min(H*0.97, p.y + p.dy));
    // reverse direction at edges
    if (p.y >= H*0.97 || p.y <= H*0.02) p.dy *= -1;

    const bob = Math.sin(time * p.wFreq + p.wOff) * p.wAmp;   // gentle bobbing
    const pulse  = 0.85 + 0.15 * Math.sin(time * 0.0018 + p.x * 0.01); // slow opacity shimmer

    ctx.setTransform(1, 0, 0, 1, p.x + offsetX, p.y + bob + offsetY);
    ctx.rotate(p.rot + extraSpin);
    ctx.globalAlpha = p.opacity * pulse;
    ctx.fillStyle   = pieceColor;
    ctx.strokeStyle = glowColor;
    SHAPES[p.shape](p.size, p.ax, p.ay, p.bp);
}


// =============================================================================
// TEXT PIXEL SAMPLER
// To make text out of particles, we:
//   1. Draw the text onto a hidden canvas
//   2. Check every pixel — if it's filled, save its position
//   3. Shuffle those positions randomly
//   4. Return as many as we need
// =============================================================================

function sampleTextPixels(text, font, maxParticles, pixelStep, minAlpha) {
    // Create a hidden canvas just for measuring the text
    const offscreen = document.createElement('canvas');
    offscreen.width  = W;
    offscreen.height = Math.ceil(H * 0.4);

    const offCtx = offscreen.getContext('2d');
    offCtx.font          = font;
    offCtx.fillStyle     = '#fff';
    offCtx.textBaseline  = 'top';

    // Centre the text horizontally
    const textWidth = offCtx.measureText(text).width;
    offCtx.fillText(text, (W - textWidth) / 2, 0);

    // Read back all the pixel data and find which ones are filled
    const pixels       = offCtx.getImageData(0, 0, offscreen.width, offscreen.height).data;
    const filledPixels = [];

    for (let y = 0; y < offscreen.height; y += pixelStep) {
        for (let x = 0; x < offscreen.width; x += pixelStep) {
            const alphaChannel = pixels[(y * offscreen.width + x) * 4 + 3]; // 0=transparent, 255=opaque
            if (alphaChannel > minAlpha) filledPixels.push([x, y]);
        }
    }

    // Shuffle so particles are distributed randomly across the letters
    for (let i = filledPixels.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [filledPixels[i], filledPixels[j]] = [filledPixels[j], filledPixels[i]];
    }

    return filledPixels.slice(0, maxParticles);
}

// Create a particle object at a given (x, y) position
// Used by both the 2019 text and the end message
function makeParticle(x, y, shapeCount, minSize, maxSizeRange, rotSpeed) {
    return {
        x, y,
        originX: x, originY: y, // remember the starting position for sinking
        size:    minSize + Math.random() * maxSizeRange,
        rot:     Math.random() * Math.PI * 2,
        rotSpd:  (Math.random() - 0.5) * rotSpeed,
        shape:   Math.floor(Math.random() * shapeCount),
        ax:      0.4 + Math.random() * 1.2,
        ay:      0.4 + Math.random() * 1.2,
        bp:      Array.from({length: 6}, () => (Math.random() - 0.5) * 0.7),
        wAmp:    0.5 + Math.random() * 2,
        wFreq:   0.001 + Math.random() * 0.003,
        wOff:    Math.random() * Math.PI * 2,
    };
}


// =============================================================================
// "2019" TRASH TEXT — visible at the start, scatters as you scroll
// =============================================================================

let yearParticles = [];
let yearReady     = false;

function create2019Text() {
    const fontSize     = Math.min(W * 0.38, 300);
    const textHeight   = Math.round(fontSize * 1.3);
    const verticalPos  = (H - textHeight) * 0.42; // slightly above centre

    const pixelPositions = sampleTextPixels('2019', `900 ${fontSize}px Arial, sans-serif`, 700, 3, 128);

    yearParticles = pixelPositions.map(([px, py]) => ({
        ...makeParticle(
            px + (Math.random() - 0.5) * 4,
            py + verticalPos + (Math.random() - 0.5) * 4,
            4, 1.5, 5, 0.04
        ),
        scatterDirX: (Math.random() - 0.5) * 2, // direction to scatter when fading
        scatterDirY: (Math.random() - 0.5) * 2,
        sinkDelay:   Math.random(),
        restX:       20 + Math.random() * (W - 40),
        restY:       null,
        spinDir:     Math.random() < 0.5 ? 1 : -1,
    }));

    yearReady = true;
}
create2019Text();

function draw2019Text(scroll, time, globalSink) {
    // Fade out as you scroll — gone by 45% scroll
    const fadeProgress = Math.min(1, scroll / 0.45);
    const alpha        = (1 - fadeProgress) * 0.55;
    if (alpha <= 0 || !yearReady) return;

    // Colour fades from pale blue toward grey as particles scatter
    const color = mixColor(218,238,255,  122,140,145,  Math.min(1, scroll / 0.6));

    ctx.setTransform(1, 0, 0, 1, 0, 0);

    for (const p of yearParticles) {
        // Scatter quadratically so movement accelerates as they fade
        const scatter = fadeProgress * fadeProgress;
        let shiftX = p.scatterDirX * scatter * W * 0.35;
        let shiftY = p.scatterDirY * scatter * H * 0.35;
        let spin   = 0;

        // Also sink at the bottom (same logic as regular pieces)
        if (globalSink > 0) {
            const sp = getSinkProgress(globalSink, p.sinkDelay);
            if (sp > 0) {
                if (!p.restY) p.restY = H - p.size * 1.5 - Math.abs(p.restX - W*0.5) / (W*0.5) * H * 0.04;
                const fall = getFallAmount(sp);
                shiftX += (p.restX - p.originX) * fall;
                shiftY += (p.restY - p.originY) * fall;
                spin    = sp * Math.PI * (2 + p.sinkDelay * 3) * (1 - fall * 0.9) * p.spinDir;
            }
        }

        const bob = globalSink > 0 ? 0 : Math.sin(time * p.wFreq + p.wOff) * p.wAmp;
        p.rot += p.rotSpd;

        ctx.globalAlpha = alpha;
        ctx.fillStyle   = color;
        ctx.strokeStyle = color;
        ctx.setTransform(p.ax, 0, 0, p.ay, p.x + shiftX, p.y + bob + shiftY);
        ctx.rotate(p.rot + spin);
        SHAPES[p.shape](p.size, p.ax, p.ay, p.bp);
    }

    ctx.globalAlpha = 1;
}


// =============================================================================
// END MESSAGE — assembles from particles when trash has sunk to the bottom
// =============================================================================

let messageParticles = [];
let messageReady     = false;

function createMessageText() {
    messageParticles = [];

    const lines    = ["The ocean doesn't forget", "about what we throw away."];
    const fontSize = Math.max(28, Math.min(W * 0.075, 72));
    const lineH    = fontSize * 1.45;
    const startY   = H * 0.5 - lineH; // centre both lines on screen

    lines.forEach((line, lineIndex) => {
        const positions = sampleTextPixels(line, `900 ${fontSize}px Arial, sans-serif`, 2000, 1, 80);
        const lineY     = startY + lineIndex * lineH;

        for (const [px, py] of positions) {
            messageParticles.push({
                ...makeParticle(
                    px + (Math.random() - 0.5) * 2,
                    lineY + py + (Math.random() - 0.5) * 2,
                    4, 2.2, 2, 0.015
                ),
                ax:       0.8 + Math.random() * 0.3, // override ax/ay for tighter look
                ay:       0.8 + Math.random() * 0.3,
                // stagger each particle's reveal so the text assembles gradually
                revealAt: 0.55 + Math.random() * 0.45,
            });
        }
    });

    messageReady = true;
}
createMessageText();

function drawMessageText(globalSink, time) {
    if (!messageReady || globalSink < 0.55) return;

    // Fade in the whole message over sinkProgress 0.55 → 0.75
    const overallAlpha = Math.min(1, (globalSink - 0.55) / 0.20);
    if (overallAlpha <= 0) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);

    for (const p of messageParticles) {
        // Each particle fades in once globalSink passes its personal revealAt value
        const alpha = overallAlpha * Math.min(1, Math.max(0, (globalSink - p.revealAt) / 0.05));
        if (alpha < 0.02) continue;

        const bob = Math.sin(time * p.wFreq + p.wOff) * p.wAmp;
        p.rot += p.rotSpd;

        ctx.globalAlpha = alpha;
        ctx.fillStyle   = '#eef8ff'; // pale icy white
        ctx.strokeStyle = '#c8e8f5';
        ctx.setTransform(p.ax, 0, 0, p.ay, p.x, p.y + bob);
        ctx.rotate(p.rot);
        SHAPES[p.shape](p.size, p.ax, p.ay, p.bp);
    }

    ctx.globalAlpha = 1;
}


// =============================================================================
// SINK PROGRESS — smoothly increases when user reaches the bottom of the page
// =============================================================================

let globalSink = 0;

function updateSink(scroll) {
    const target = scroll >= 0.98 ? 1 : 0; // 1 = at bottom, 0 = not at bottom
    globalSink  += (target - globalSink) * 0.004; // ease toward target (lerp)

    // If user scrolled back up, un-sink all the pieces
    if (globalSink < 0.01) {
        for (const p of pieces) {
            p.sunk  = false;
            p.sinkY = null;
        }
    }

    return globalSink;
}


// =============================================================================
// MAIN ANIMATION LOOP — runs 60 times per second via requestAnimationFrame
// =============================================================================

// Cache the instruction and mass label elements so we don't look them up every frame
const instructionEl = document.querySelector('.instruction');
const massEl = document.getElementById('massLabel');

function draw() {
    const scroll = getScroll();
    const time   = Date.now();  // milliseconds since page load, used for animation timing
    const sink   = updateSink(scroll);

    // Update the "X tons" counter in the corner only when the value changes
    const newMass = Math.round(scroll * totalTons).toLocaleString() + ' tons';
    if (massEl.innerText !== newMass) massEl.innerText = newMass;

    // Fade the "↓ scroll down" hint out in the first 15% of scroll
    if (instructionEl) instructionEl.style.opacity = Math.max(0, 1 - scroll / 0.15);

    // Draw everything back-to-front (painter's algorithm)
    updatePieceColors(scroll);
    drawBackground(scroll);

    ctx.shadowBlur = 0; // shadows are expensive — keep them off

    // Show pieces using a square-root curve so the ocean fills up fast at first
    const numVisible = Math.floor(Math.sqrt(scroll) * MAX_PIECES);
    for (let i = 0; i < numVisible; i++) drawPiece(pieces[i], time, sink);

    // Reset the canvas transform after piece drawing
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;

    draw2019Text(scroll, time, sink);
    drawMessageText(sink, time);

    requestAnimationFrame(draw); // schedule the next frame
}

// Make the page tall enough to scroll through (4 screen heights)
document.body.style.minHeight = '400vh';

// Hide the HTML year label — we draw "2019" on the canvas instead
document.getElementById('yearLabel').style.display = 'none';

// Start the animation
requestAnimationFrame(draw);