// Original creatures, drawn procedurally on 2D canvas. None of these reproduce an existing character.
// They are fallbacks for the Spline scenes and the source of the jumpscare face.

const TAU = Math.PI * 2;
let noiseTile = null;

function getNoiseTile() {
  if (noiseTile) return noiseTile;
  noiseTile = document.createElement('canvas');
  noiseTile.width = noiseTile.height = 160;
  const nctx = noiseTile.getContext('2d');
  const img = nctx.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  nctx.putImageData(img, 0, 0);
  return noiseTile;
}

/** Overlay animated grain onto whatever is already drawn. */
export function grain(ctx, w, h, amount = 0.12) {
  const tile = getNoiseTile();
  ctx.save();
  ctx.globalAlpha = amount;
  ctx.globalCompositeOperation = 'overlay';
  const ox = -Math.random() * 160;
  const oy = -Math.random() * 160;
  for (let x = ox; x < w; x += 160) for (let y = oy; y < h; y += 160) ctx.drawImage(tile, x, y);
  ctx.restore();
}

/** Tear the frame: shift a few horizontal bands sideways (tape tracking damage). */
export function tear(ctx, w, h, bands = 4, maxShift = 40) {
  for (let i = 0; i < bands; i += 1) {
    const y = Math.random() * h;
    const bh = 4 + Math.random() * h * 0.06;
    const shift = (Math.random() - 0.5) * 2 * maxShift;
    ctx.drawImage(ctx.canvas, 0, y, w, bh, shift, y, w, bh);
  }
}

// ---------------------------------------------------------------------------------------------
// The Grinner: a long, hairless, paper-pale face with mismatched hollow eyes and a smile that
// runs too far. Used for the jumpscare and as a faint presence hidden in photographs.
// ---------------------------------------------------------------------------------------------
export function drawGrinner(ctx, w, h, { t = 0, scale = 1, alpha = 1, cx = w / 2, cy = h * 0.52, dark = true } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  if (dark) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
  }
  const r = Math.min(w, h) * 0.3 * scale;
  const ry = r * 1.5;
  const twitch = Math.sin(t * 37) * Math.sin(t * 11) * r * 0.012;

  ctx.translate(cx + twitch, cy);
  ctx.rotate(Math.sin(t * 2.1) * 0.03 - 0.06);

  // Head: lit from below like a torch under the chin; the edges dissolve into the dark.
  const skin = ctx.createRadialGradient(0, ry * 0.25, r * 0.05, 0, 0, ry * 1.02);
  skin.addColorStop(0, '#f1ebdd');
  skin.addColorStop(0.45, '#cfc7b5');
  skin.addColorStop(0.72, '#6e685d');
  skin.addColorStop(0.9, 'rgba(30,27,24,0.6)');
  skin.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.08, ry * 1.05, 0, 0, TAU);
  ctx.fill();

  // Brow shadow and sunken cheeks, soft-edged
  const brow = ctx.createLinearGradient(0, -ry, 0, -ry * 0.1);
  brow.addColorStop(0, 'rgba(0,0,0,0.75)');
  brow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = brow;
  ctx.fillRect(-r * 1.1, -ry * 1.05, r * 2.2, ry * 0.95);
  [-1, 1].forEach((side) => {
    const hollow = ctx.createRadialGradient(side * r * 0.55, ry * 0.12, 0, side * r * 0.55, ry * 0.12, r * 0.38);
    hollow.addColorStop(0, 'rgba(25,20,18,0.45)');
    hollow.addColorStop(1, 'rgba(25,20,18,0)');
    ctx.fillStyle = hollow;
    ctx.beginPath();
    ctx.arc(side * r * 0.55, ry * 0.12, r * 0.38, 0, TAU);
    ctx.fill();
  });

  // Eyes: hollow, too big, not level. The left one sits higher and is larger.
  const eyes = [
    { x: -r * 0.38, y: -ry * 0.3, rx: r * 0.27, ry: r * 0.31 },
    { x: r * 0.36, y: -ry * 0.24, rx: r * 0.22, ry: r * 0.25 }
  ];
  eyes.forEach((eye, i) => {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = r * 0.25;
    ctx.fillStyle = '#050404';
    ctx.beginPath();
    ctx.ellipse(eye.x, eye.y, eye.rx, eye.ry, i ? 0.15 : -0.1, 0, TAU);
    ctx.fill();
    ctx.restore();
    // Pinprick pupils that stare straight out
    ctx.fillStyle = '#f4f1ea';
    ctx.beginPath();
    ctx.arc(eye.x + eye.rx * 0.08, eye.y + eye.ry * 0.05, r * 0.028, 0, TAU);
    ctx.fill();
  });

  // Nostrils: two slits, no nose
  ctx.fillStyle = '#1c1715';
  [-1, 1].forEach((side) => {
    ctx.beginPath();
    ctx.ellipse(side * r * 0.07, ry * 0.08, r * 0.025, r * 0.06, side * 0.3, 0, TAU);
    ctx.fill();
  });

  // Smile: runs almost to the ears, upper lip shallow, lower lip deep.
  const mw = r * 0.92;
  const top = ry * 0.22;
  const left = { x: -mw, y: top - ry * 0.12 };
  const right = { x: mw * 0.96, y: top - ry * 0.16 };
  ctx.beginPath();
  ctx.moveTo(left.x, left.y);
  ctx.quadraticCurveTo(0, top + ry * 0.2, right.x, right.y);
  ctx.quadraticCurveTo(0, top + ry * 0.62, left.x, left.y);
  ctx.closePath();
  ctx.fillStyle = '#140707';
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Gums
  ctx.fillStyle = '#3b1416';
  ctx.beginPath();
  ctx.moveTo(left.x, left.y);
  ctx.quadraticCurveTo(0, top + ry * 0.2, right.x, right.y);
  ctx.lineTo(right.x, right.y + ry * 0.05);
  ctx.quadraticCurveTo(0, top + ry * 0.27, left.x, left.y + ry * 0.05);
  ctx.fill();
  // Teeth: many, thin, long, slightly uneven
  const count = 26;
  for (let i = 0; i < count; i += 1) {
    const u = i / (count - 1);
    const x = left.x + (right.x - left.x) * u;
    const yTop = quadY(left.y, top + ry * 0.2, right.y, u) + ry * 0.02;
    const yBottom = quadY(left.y, top + ry * 0.62, right.y, u) - ry * 0.01;
    const tw = (r * 1.9) / count * 0.82;
    const lenTop = (yBottom - yTop) * (0.38 + 0.12 * Math.sin(i * 12.9898));
    const lenBottom = (yBottom - yTop) * (0.3 + 0.1 * Math.sin(i * 78.233));
    const toothShade = ctx.createLinearGradient(0, yTop, 0, yTop + lenTop);
    toothShade.addColorStop(0, '#d8d0bc');
    toothShade.addColorStop(1, '#8f8775');
    ctx.fillStyle = toothShade;
    ctx.beginPath();
    ctx.moveTo(x - tw / 2, yTop);
    ctx.lineTo(x + tw / 2, yTop);
    ctx.lineTo(x + tw * 0.1, yTop + lenTop);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#9d9583';
    ctx.beginPath();
    ctx.moveTo(x - tw / 2, yBottom);
    ctx.lineTo(x + tw / 2, yBottom);
    ctx.lineTo(x - tw * 0.1, yBottom - lenBottom);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Skin grain, only on the face
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.05, ry * 1.02, 0, 0, TAU);
  ctx.clip();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.55 * alpha;
  const tile = getNoiseTile();
  for (let gx = -r * 1.1; gx < r * 1.1; gx += 160) for (let gy = -ry * 1.1; gy < ry * 1.1; gy += 160) ctx.drawImage(tile, gx, gy);
  ctx.restore();

  // Smile creases that climb toward the eyes
  ctx.strokeStyle = 'rgba(50,42,36,0.55)';
  ctx.lineWidth = r * 0.018;
  [[left, -1], [right, 1]].forEach(([corner, side]) => {
    ctx.beginPath();
    ctx.moveTo(corner.x, corner.y);
    ctx.quadraticCurveTo(corner.x + side * r * 0.05, corner.y - ry * 0.25, side * r * 0.45, -ry * 0.06);
    ctx.stroke();
  });

  ctx.restore();
}

function quadY(a, control, b, u) {
  return (1 - u) * (1 - u) * a + 2 * (1 - u) * u * control + u * u * b;
}

// ---------------------------------------------------------------------------------------------
// Eyes in the dark. Each pair opens at a point in the beat's progress, blinks, and tracks the pointer.
// ---------------------------------------------------------------------------------------------
export function createEyeField(count, seed = 7) {
  const rand = mulberry32(seed);
  return Array.from({ length: count }, (_, i) => ({
    x: 0.08 + rand() * 0.84,
    y: 0.08 + rand() * 0.84,
    size: 0.018 + rand() * 0.035 * (i === count - 1 ? 3.2 : 1),
    openAt: i / count,
    blinkSeed: rand() * 10,
    lag: 0.04 + rand() * 0.1,
    lookX: 0,
    lookY: 0
  }));
}

export function drawEyeField(ctx, w, h, eyes, { progress, pointer, t }) {
  ctx.fillStyle = '#020203';
  ctx.fillRect(0, 0, w, h);
  eyes.forEach((eye) => {
    const open = clamp01((progress - eye.openAt) * 6);
    if (open <= 0) return;
    const blink = Math.sin(t * 0.9 + eye.blinkSeed * 4.1) > 0.985 ? 0.08 : 1;
    const ex = eye.x * w;
    const ey = eye.y * h;
    const size = eye.size * Math.min(w, h) * 2.2;
    const dx = pointer.x - ex;
    const dy = pointer.y - ey;
    const dist = Math.hypot(dx, dy) || 1;
    eye.lookX += ((dx / dist) * Math.min(1, dist / (size * 6)) - eye.lookX) * eye.lag;
    eye.lookY += ((dy / dist) * Math.min(1, dist / (size * 6)) - eye.lookY) * eye.lag;
    [-1, 1].forEach((side) => {
      drawEye(ctx, ex + side * size * 1.25, ey, size, open * blink, eye.lookX, eye.lookY);
    });
  });
}

function drawEye(ctx, x, y, size, open, lookX, lookY) {
  const height = size * 0.48 * open;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x - size, y);
  ctx.quadraticCurveTo(x, y - height * 2, x + size, y);
  ctx.quadraticCurveTo(x, y + height * 2, x - size, y);
  ctx.closePath();
  ctx.shadowColor = 'rgba(200,190,160,0.25)';
  ctx.shadowBlur = size * 0.8;
  const sclera = ctx.createRadialGradient(x, y, 0, x, y, size);
  sclera.addColorStop(0, '#bdb6a3');
  sclera.addColorStop(1, '#4b463c');
  ctx.fillStyle = sclera;
  ctx.fill();
  ctx.clip();
  const ix = x + lookX * size * 0.45;
  const iy = y + lookY * size * 0.3;
  ctx.fillStyle = '#17110c';
  ctx.beginPath();
  ctx.arc(ix, iy, size * 0.42, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(ix, iy, size * 0.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.arc(ix - size * 0.12, iy - size * 0.12, size * 0.06, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// Corridor with a figure. `near` runs 0 (far end) to 1 (filling the frame).
// ---------------------------------------------------------------------------------------------
export function drawCorridor(ctx, w, h, { near = 0, flicker = 1, figure = true, t = 0 } = {}) {
  ctx.fillStyle = '#030303';
  ctx.fillRect(0, 0, w, h);
  const vx = w / 2;
  const vy = h * 0.46;
  const endW = w * 0.09;
  const endH = h * 0.2;

  // Far light
  const glow = ctx.createRadialGradient(vx, vy, 0, vx, vy, w * 0.5);
  glow.addColorStop(0, `rgba(196,180,140,${0.32 * flicker})`);
  glow.addColorStop(0.3, `rgba(70,62,48,${0.18 * flicker})`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // Walls, ceiling, and floor as perspective planes
  ctx.strokeStyle = `rgba(120,110,90,${0.16 * flicker})`;
  ctx.lineWidth = 1;
  [[0, 0], [w, 0], [0, h], [w, h]].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(vx + Math.sign(x - vx || 1) * endW / 2, vy + Math.sign(y - vy || 1) * endH / 2);
    ctx.stroke();
  });
  for (let i = 1; i < 9; i += 1) {
    const d = (i / 9) ** 1.8;
    const rw = endW + (w - endW) * d;
    const rh = endH + (h - endH) * d;
    ctx.strokeStyle = `rgba(110,100,80,${0.05 + 0.06 * d * flicker})`;
    ctx.strokeRect(vx - rw / 2, vy - rh / 2, rw, rh);
  }
  ctx.fillStyle = `rgba(210,195,150,${0.5 * flicker})`;
  ctx.fillRect(vx - endW / 2, vy - endH / 2, endW, endH);

  if (figure) drawFigure(ctx, vx, vy + endH / 2, near, h, t, flicker);

  // Fog
  const fog = ctx.createLinearGradient(0, 0, 0, h);
  fog.addColorStop(0, 'rgba(0,0,0,0.75)');
  fog.addColorStop(0.5, 'rgba(10,10,10,0.1)');
  fog.addColorStop(1, 'rgba(0,0,0,0.85)');
  ctx.fillStyle = fog;
  ctx.fillRect(0, 0, w, h);
}

function drawFigure(ctx, x, floorY, near, h, t, flicker) {
  const depth = near * near;
  const height = h * (0.18 + depth * 1.35);
  const baseY = floorY + depth * h * 0.55;
  const top = baseY - height;
  const unit = height / 8;
  const sway = Math.sin(t * 0.7) * unit * 0.05;
  ctx.save();
  ctx.translate(x + sway, 0);
  ctx.fillStyle = '#000';
  ctx.strokeStyle = '#000';
  ctx.lineCap = 'round';
  // Legs
  ctx.lineWidth = unit * 0.32;
  [-1, 1].forEach((side) => {
    ctx.beginPath();
    ctx.moveTo(side * unit * 0.25, top + unit * 4.4);
    ctx.lineTo(side * unit * 0.32, baseY);
    ctx.stroke();
  });
  // Torso: narrow, too long
  ctx.beginPath();
  ctx.moveTo(-unit * 0.55, top + unit * 1.45);
  ctx.lineTo(unit * 0.55, top + unit * 1.5);
  ctx.lineTo(unit * 0.35, top + unit * 4.6);
  ctx.lineTo(-unit * 0.35, top + unit * 4.6);
  ctx.closePath();
  ctx.fill();
  // Arms: reach below the knees, fingers splayed
  ctx.lineWidth = unit * 0.18;
  [-1, 1].forEach((side) => {
    const handX = side * unit * 0.85;
    const handY = top + unit * 6.4;
    ctx.beginPath();
    ctx.moveTo(side * unit * 0.5, top + unit * 1.55);
    ctx.quadraticCurveTo(side * unit * 0.95, top + unit * 3.6, handX, handY);
    ctx.stroke();
    ctx.lineWidth = unit * 0.06;
    for (let f = 0; f < 4; f += 1) {
      ctx.beginPath();
      ctx.moveTo(handX, handY);
      ctx.lineTo(handX + side * unit * (0.05 + f * 0.08), handY + unit * (0.6 + f * 0.05));
      ctx.stroke();
    }
    ctx.lineWidth = unit * 0.18;
  });
  // Neck and tilted head
  ctx.lineWidth = unit * 0.16;
  ctx.beginPath();
  ctx.moveTo(0, top + unit * 1.5);
  ctx.lineTo(unit * 0.12, top + unit * 0.75);
  ctx.stroke();
  ctx.save();
  ctx.translate(unit * 0.18, top + unit * 0.45);
  ctx.rotate(0.5);
  ctx.beginPath();
  ctx.ellipse(0, 0, unit * 0.34, unit * 0.46, 0, 0, TAU);
  ctx.fill();
  // When close, two faint pinpoints where eyes should be
  if (near > 0.55) {
    ctx.fillStyle = `rgba(230,225,210,${(near - 0.55) * 2 * flicker})`;
    ctx.beginPath();
    ctx.arc(-unit * 0.12, -unit * 0.06, unit * 0.035, 0, TAU);
    ctx.arc(unit * 0.12, -unit * 0.04, unit * 0.035, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// A doorway, slightly open. With `peek`, a pale face and long fingers appear at the door's edge.
// ---------------------------------------------------------------------------------------------
export function drawDoorway(ctx, w, h, { open = 0.1, peek = 0, light = 1, t = 0, picture = null } = {}) {
  ctx.fillStyle = '#050403';
  ctx.fillRect(0, 0, w, h);
  const dw = Math.min(w * 0.34, h * 0.42);
  const dh = dw * 2.1;
  const dx = (w - dw) / 2;
  const dy = h * 0.5 - dh / 2;

  // Wallpaper wash from a bare bulb above
  const lamp = ctx.createRadialGradient(w / 2, dy - h * 0.05, 0, w / 2, dy, h * 0.9);
  lamp.addColorStop(0, `rgba(170,150,105,${0.35 * light})`);
  lamp.addColorStop(0.6, `rgba(40,34,24,${0.25 * light})`);
  lamp.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lamp;
  ctx.fillRect(0, 0, w, h);

  if (picture) drawWallPicture(ctx, dx - dw * 0.95, dy + dh * 0.12, dw * 0.55, picture, light, t);

  // Frame
  ctx.fillStyle = `rgba(52,44,34,${0.9 * light + 0.1})`;
  ctx.fillRect(dx - dw * 0.08, dy - dw * 0.08, dw * 1.16, dh + dw * 0.08);
  // Darkness beyond the door
  ctx.fillStyle = '#000';
  ctx.fillRect(dx, dy, dw, dh);

  // Door leaf hinged on the left, rotating away
  const leaf = dw * (1 - open * 0.85);
  const shade = ctx.createLinearGradient(dx, 0, dx + leaf, 0);
  shade.addColorStop(0, `rgba(96,82,64,${light})`);
  shade.addColorStop(1, `rgba(40,33,25,${light})`);
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.moveTo(dx, dy);
  ctx.lineTo(dx + leaf, dy + dh * 0.02 * open);
  ctx.lineTo(dx + leaf, dy + dh - dh * 0.02 * open);
  ctx.lineTo(dx, dy + dh);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = `rgba(150,130,90,${0.8 * light})`;
  ctx.beginPath();
  ctx.arc(dx + leaf - dw * 0.08, dy + dh * 0.52, dw * 0.025, 0, TAU);
  ctx.fill();

  if (peek > 0) {
    const edge = dx + leaf;
    const gap = dw - leaf;
    const fy = dy + dh * 0.22;
    const fr = dw * 0.16;
    ctx.save();
    ctx.beginPath();
    ctx.rect(edge, dy, gap, dh);
    ctx.clip();
    const shown = fr * 1.2 * peek;
    const fx = edge + shown - fr * 0.5;
    const face = ctx.createRadialGradient(fx - fr * 0.3, fy - fr * 0.3, fr * 0.1, fx, fy, fr * 1.4);
    face.addColorStop(0, `rgba(226,219,204,${light})`);
    face.addColorStop(0.7, `rgba(120,112,100,${light})`);
    face.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.ellipse(fx, fy + Math.sin(t * 0.5) * 2, fr, fr * 1.35, 0.12, 0, TAU);
    ctx.fill();
    // One wide eye, staring
    ctx.fillStyle = '#e9e4d8';
    ctx.beginPath();
    ctx.ellipse(fx - fr * 0.25, fy - fr * 0.15, fr * 0.26, fr * 0.2, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#050505';
    ctx.beginPath();
    ctx.arc(fx - fr * 0.33, fy - fr * 0.14, fr * 0.07, 0, TAU);
    ctx.fill();
    // Hair hanging past the face
    ctx.strokeStyle = 'rgba(5,4,4,0.9)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 26; i += 1) {
      const sx = fx - fr * 0.1 + i * fr * 0.05;
      ctx.beginPath();
      ctx.moveTo(sx, fy - fr * 1.3);
      ctx.quadraticCurveTo(sx + Math.sin(i + t) * 4, fy, sx + Math.sin(i * 3.1) * 8, fy + fr * (1.5 + (i % 5) * 0.25));
      ctx.stroke();
    }
    ctx.restore();
    // Fingers curled around the edge of the door
    ctx.fillStyle = `rgba(200,192,176,${light})`;
    for (let f = 0; f < 4; f += 1) {
      const y = dy + dh * 0.46 + f * dw * 0.06;
      ctx.beginPath();
      ctx.ellipse(edge - dw * 0.02, y, dw * 0.055 * peek, dw * 0.018, 0, 0, TAU);
      ctx.fill();
    }
  }
}

/** A framed picture hanging crooked beside the door. `picture` is an Image or 'grinner'. */
function drawWallPicture(ctx, x, y, width, picture, light, t) {
  const height = width * 1.3;
  ctx.save();
  ctx.translate(x + width / 2, y);
  ctx.rotate(0.05 + Math.sin(t * 0.3) * 0.004);
  ctx.fillStyle = `rgba(30,22,15,${light})`;
  ctx.fillRect(-width / 2 - width * 0.08, -width * 0.08, width * 1.16, height + width * 0.16);
  ctx.fillStyle = '#000';
  ctx.fillRect(-width / 2, 0, width, height);
  if (picture === 'grinner') {
    ctx.beginPath();
    ctx.rect(-width / 2, 0, width, height);
    ctx.clip();
    drawGrinner(ctx, width, height, { t, scale: 1.3, cx: 0, cy: height * 0.55, alpha: light, dark: false });
  } else if (picture?.complete && picture.naturalWidth) {
    const fit = Math.max(width / picture.naturalWidth, height / picture.naturalHeight);
    const sw = width / fit;
    const sh = height / fit;
    ctx.filter = `grayscale(1) sepia(0.4) contrast(1.2) brightness(${0.35 + light * 0.45})`;
    ctx.drawImage(picture, (picture.naturalWidth - sw) / 2, (picture.naturalHeight - sh) / 2, sw, sh, -width / 2, 0, width, height);
    ctx.filter = 'none';
  }
  ctx.restore();
}

/** One found photograph, harsh and torn, for single-frame flashes. */
export function drawFoundFrame(ctx, w, h, img, { alpha = 1 } = {}) {
  if (!img?.complete || !img.naturalWidth) return false;
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = alpha;
  const fit = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const iw = img.naturalWidth * fit;
  const ih = img.naturalHeight * fit;
  ctx.filter = 'grayscale(1) contrast(1.8) brightness(0.9)';
  ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
  ctx.restore();
  tear(ctx, w, h, 5, w * 0.08);
  return true;
}

// ---------------------------------------------------------------------------------------------
// "Enhance": zoom into a photograph's dark corner until something looks back.
// ---------------------------------------------------------------------------------------------
export function drawEnhance(ctx, w, h, img, { zoom = 1, tx = 0.8, ty = 0.3, reveal = 0, t = 0 } = {}) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  if (img?.complete && img.naturalWidth) {
    const fit = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const sw = w / (fit * zoom);
    const sh = h / (fit * zoom);
    const sx = clamp(img.naturalWidth * tx - sw / 2, 0, img.naturalWidth - sw);
    const sy = clamp(img.naturalHeight * ty - sh / 2, 0, img.naturalHeight - sh);
    ctx.save();
    ctx.imageSmoothingEnabled = zoom < 3;
    ctx.filter = `grayscale(1) contrast(${1.1 + zoom * 0.05}) brightness(${0.85 - zoom * 0.02})`;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
    ctx.restore();
  }
  if (reveal > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    drawGrinner(ctx, w, h, { t, scale: 0.55, alpha: reveal * 0.55, cx: w * 0.5, cy: h * 0.5, dark: false });
    ctx.restore();
  }
  grain(ctx, w, h, 0.1 + zoom * 0.02);
}

export function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
