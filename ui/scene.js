// ——— Base corridor ———
const scene = new THREE.Scene();

// STEP 8 — figure (after scene created)
const blackMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
const figureGroup = new THREE.Group();

const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), blackMat);
head.position.y = 1.6;
figureGroup.add(head);

const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });

const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), eyeMat);
leftEye.position.set(-0.08, 1.65, 0.21);
figureGroup.add(leftEye);

const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), eyeMat);
rightEye.position.set(0.08, 1.65, 0.21);
figureGroup.add(rightEye);

const eyeGlow = new THREE.PointLight(0xff0000, 0.4, 2);
eyeGlow.position.set(0, 1.65, 0.2);
figureGroup.add(eyeGlow);

const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.3), blackMat);
body.position.y = 1.0;
figureGroup.add(body);

const legL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.8, 0.25), blackMat);
legL.position.set(-0.15, 0.4, 0);
figureGroup.add(legL);

const legR = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.8, 0.25), blackMat);
legR.position.set(0.15, 0.4, 0);
figureGroup.add(legR);

figureGroup.position.set(0, 0, 6);
scene.add(figureGroup);

let figureStepAccum = 0;

const EYE_H = 0.85;
// Units per second (tuned to match prior 60fps feel at MOVE_SPEED 0.08/frame).
const MOVE_SPEED = 4.8;
const FIGURE_SPEED = 4.2;
const FIGURE_CATCHUP_SPEED = 4.92;
const FIGURE_FLEE_BOOST = 0.72;
const FIGURE_FOLLOW_DIST = 2.8;
const FIGURE_CATCHUP_DIST = 12;
const FIGURE_STEP_DISTANCE = 0.55;
const FIGURE_STEP_MIN_MS = 520;
let lastFigureStepTime = 0;

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  200
);
camera.position.set(0, EYE_H, -2);

const canvas = document.getElementById("game-canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(0.5);
renderer.setSize(window.innerWidth, window.innerHeight);
canvas.style.imageRendering = "pixelated";

// STEP 10 — film grain + vignette
const vignette = document.createElement("div");
vignette.style.cssText = `
  position:fixed;top:0;left:0;
  width:100%;height:100%;
  pointer-events:none;
  background:radial-gradient(ellipse at center,
    transparent 50%, rgba(0,0,0,0.7) 100%);
  z-index:10;
`;
document.body.appendChild(vignette);

const grain = document.createElement("canvas");
grain.style.cssText = `
  position:fixed;top:0;left:0;
  width:100%;height:100%;
  pointer-events:none;
  opacity:0.04;
  mix-blend-mode:overlay;
  z-index:11;
`;
document.body.appendChild(grain);

const GRAIN_RES_SCALE = 0.2;
let grainTick = 0;

function updateGrain() {
  requestAnimationFrame(updateGrain);
  grainTick++;
  if (grainTick % 2 !== 0) return;

  const w = Math.max(64, Math.floor(window.innerWidth * GRAIN_RES_SCALE));
  const h = Math.max(64, Math.floor(window.innerHeight * GRAIN_RES_SCALE));
  if (grain.width !== w || grain.height !== h) {
    grain.width = w;
    grain.height = h;
  }

  const ctx = grain.getContext("2d", { alpha: false });
  const img = ctx.createImageData(w, h);
  const data = img.data;
  for (let i = 0; i < data.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    data[i] = data[i + 1] = data[i + 2] = v;
    data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}
updateGrain();

document.getElementById("load-veil")?.classList.add("is-hidden");
document.getElementById("intro-veil")?.classList.add("is-revealed");
const postFx = document.getElementById("post-fx");
if (postFx) postFx.style.display = "none";

function createCloudWallTexture() {
  const texCanvas = document.createElement("canvas");
  texCanvas.width = 512;
  texCanvas.height = 512;
  const ctx = texCanvas.getContext("2d");

  ctx.fillStyle = "#243868";
  ctx.fillRect(0, 0, 512, 512);

  function drawCloud(x, y, size) {
    ctx.fillStyle = "rgba(220, 230, 255, 0.8)";
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - size * 0.6, y + size * 0.2, size * 0.65, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + size * 0.6, y + size * 0.2, size * 0.65, 0, Math.PI * 2);
    ctx.fill();
  }

  drawCloud(70, 80, 40);
  drawCloud(250, 50, 38);
  drawCloud(420, 100, 45);
  drawCloud(140, 220, 35);
  drawCloud(370, 270, 42);
  drawCloud(60, 380, 44);
  drawCloud(460, 380, 36);
  drawCloud(220, 430, 41);
  drawCloud(320, 160, 37);
  drawCloud(180, 120, 39);
  drawCloud(90, 300, 43);
  drawCloud(400, 450, 35);

  for (let i = 0; i < 25; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const colors = [
      "rgba(255,220,80,0.4)",
      "rgba(100,160,255,0.4)",
      "rgba(255,255,255,0.3)",
    ];
    ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
    ctx.fillRect(x - 1, y - 3, 2, 6);
    ctx.fillRect(x - 3, y - 1, 6, 2);
  }

  const texture = new THREE.CanvasTexture(texCanvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 1);
  return texture;
}

function createCarpetTexture() {
  const texCanvas = document.createElement("canvas");
  texCanvas.width = 128;
  texCanvas.height = 128;
  const ctx = texCanvas.getContext("2d");

  ctx.fillStyle = "#3a2d4a";
  ctx.fillRect(0, 0, 128, 128);

  for (let i = 0; i < 1000; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`;
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 1, 1);
  }

  const t = new THREE.CanvasTexture(texCanvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(8, 30);
  return t;
}

function createStarCeilingTexture() {
  const texCanvas = document.createElement("canvas");
  texCanvas.width = 512;
  texCanvas.height = 512;
  const ctx = texCanvas.getContext("2d");

  ctx.fillStyle = "#06080f";
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 512; i += 128) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  function drawStickerGlow(x, y) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, 8);
    gradient.addColorStop(0, "rgba(255,255,150,0.15)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(x - 8, y - 8, 16, 16);
  }

  for (let i = 0; i < 150; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    drawStickerGlow(x, y);
    ctx.fillStyle = `rgba(255,255,240,${0.5 + Math.random() * 0.5})`;
    ctx.fillRect(x, y, 2.5, 2.5);
  }

  for (let i = 0; i < 30; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    drawStickerGlow(x, y);
    ctx.fillStyle = `rgba(255,220,80,${0.6 + Math.random() * 0.4})`;
    ctx.fillRect(x, y, 3, 3);
  }

  for (let i = 0; i < 30; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    drawStickerGlow(x, y);
    ctx.fillStyle = `rgba(100,160,255,${0.6 + Math.random() * 0.4})`;
    ctx.fillRect(x, y, 3, 3);
  }

  for (let i = 0; i < 20; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const colors = [
      "rgba(255,255,150,0.95)",
      "rgba(150,200,255,0.95)",
      "rgba(255,200,100,0.95)",
    ];
    drawStickerGlow(x, y);
    ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
    ctx.fillRect(x - 1, y - 5, 3, 10);
    ctx.fillRect(x - 5, y - 1, 10, 3);
    ctx.fillRect(x - 1, y - 1, 4, 4);
  }

  const texture = new THREE.CanvasTexture(texCanvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}

const cloudTexture = createCloudWallTexture();
const wallMat = new THREE.MeshLambertMaterial({
  map: cloudTexture,
  emissive: new THREE.Color(0x0a1030),
  emissiveIntensity: 0.4,
});
const floorMat = new THREE.MeshLambertMaterial({ map: createCarpetTexture() });
const ceilMat = new THREE.MeshLambertMaterial({
  color: 0x080c18,
  map: createStarCeilingTexture(),
  emissive: new THREE.Color(0x050a10),
  emissiveIntensity: 0.5,
});

const floor = new THREE.Mesh(new THREE.PlaneGeometry(4, 120), floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.set(0, 0, -60);
scene.add(floor);

const wallL = new THREE.Mesh(new THREE.PlaneGeometry(120, 3), wallMat);
wallL.position.set(-2, 1.5, -60);
wallL.rotation.y = Math.PI / 2;
scene.add(wallL);

const wallR = new THREE.Mesh(new THREE.PlaneGeometry(120, 3), wallMat);
wallR.position.set(2, 1.5, -60);
wallR.rotation.y = -Math.PI / 2;
scene.add(wallR);

const ceil = new THREE.Mesh(new THREE.PlaneGeometry(4, 120), ceilMat);
ceil.rotation.x = Math.PI / 2;
ceil.position.set(0, 3, -60);
scene.add(ceil);

function createStar(x, y, z, size, color) {
  const shape = new THREE.Shape();
  const points = 4;
  const outerR = size;
  const innerR = size * 0.4;

  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    if (i === 0) {
      shape.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
    } else {
      shape.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
    }
  }
  shape.closePath();

  const geometry = new THREE.ShapeGeometry(shape);
  const material = new THREE.MeshBasicMaterial({
    color: color,
    side: THREE.DoubleSide,
  });

  const star = new THREE.Mesh(geometry, material);
  star.rotation.x = Math.PI / 2;
  star.position.set(x, 2.95, z);
  scene.add(star);

  const light = new THREE.PointLight(color, 0.3, 8);
  light.position.set(x, 2.8, z);
  scene.add(light);
}

const ambient = new THREE.AmbientLight(0x050a15, 0.01);
scene.add(ambient);

createStar(-0.8, 0, -8, 0.12, 0xffee44);
createStar(0.5, 0, -15, 0.08, 0xffffaa);
createStar(-0.3, 0, -22, 0.14, 0xffdd33);
createStar(0.7, 0, -30, 0.09, 0xffee66);
createStar(-0.6, 0, -38, 0.11, 0xffdd44);
createStar(0.4, 0, -45, 0.13, 0xffffbb);
createStar(-0.8, 0, -52, 0.08, 0xffee44);
createStar(0.6, 0, -60, 0.12, 0xffdd33);
createStar(-0.4, 0, -68, 0.1, 0xffffaa);
createStar(0.3, 0, -75, 0.14, 0xffee66);
createStar(-0.7, 0, -82, 0.09, 0xffdd44);
createStar(0.5, 0, -90, 0.11, 0xffee44);
createStar(-0.3, 0, -98, 0.13, 0xffffbb);
createStar(0.8, 0, -105, 0.08, 0xffdd33);

createStar(0.3, 0, -12, 0.07, 0xaaccff);
createStar(-0.5, 0, -25, 0.09, 0xbbddff);
createStar(0.8, 0, -40, 0.07, 0xaaccff);
createStar(-0.2, 0, -55, 0.1, 0xbbddff);
createStar(0.6, 0, -70, 0.08, 0xaaccff);
createStar(-0.7, 0, -85, 0.09, 0xbbddff);
createStar(0.2, 0, -100, 0.07, 0xaaccff);

createStar(0.6, 0, -4, 0.09, 0xffee55);
createStar(-0.5, 0, -11, 0.1, 0xffffaa);
createStar(0.4, 0, -19, 0.11, 0xffdd44);
createStar(-0.7, 0, -26, 0.09, 0xffee66);
createStar(0.2, 0, -34, 0.12, 0xffffbb);
createStar(-0.4, 0, -41, 0.1, 0xffdd33);
createStar(0.7, 0, -49, 0.08, 0xffee44);
createStar(-0.6, 0, -56, 0.13, 0xffffaa);
createStar(0.5, 0, -64, 0.09, 0xffdd44);
createStar(-0.3, 0, -72, 0.11, 0xffee66);
createStar(0.8, 0, -79, 0.1, 0xffffbb);
createStar(-0.5, 0, -86, 0.12, 0xffdd33);
createStar(0.4, 0, -94, 0.08, 0xffee44);
createStar(-0.7, 0, -102, 0.1, 0xffffaa);
createStar(0.3, 0, -110, 0.09, 0xffdd44);

createStar(-0.6, 0, -18, 0.08, 0xbbddff);
createStar(0.5, 0, -32, 0.09, 0xaaccff);
createStar(-0.4, 0, -47, 0.07, 0xbbddff);
createStar(0.7, 0, -62, 0.1, 0xaaccff);
createStar(-0.8, 0, -77, 0.08, 0xbbddff);
createStar(0.4, 0, -92, 0.09, 0xaaccff);

createStar(0.0, 0, -5, 0.1, 0xffee44);
createStar(-0.4, 0, -19, 0.08, 0xaaccff);
createStar(0.6, 0, -33, 0.11, 0xffee44);
createStar(-0.3, 0, -47, 0.09, 0xaaccff);
createStar(0.5, 0, -61, 0.1, 0xffee44);
createStar(-0.6, 0, -74, 0.08, 0xaaccff);
createStar(0.2, 0, -88, 0.11, 0xffee44);
createStar(-0.5, 0, -95, 0.09, 0xaaccff);
createStar(0.7, 0, -110, 0.1, 0xffee44);
createStar(-0.1, 0, -116, 0.08, 0xaaccff);
createStar(0.4, 0, -27, 0.07, 0xffddaa);
createStar(-0.8, 0, -43, 0.09, 0xffee44);
createStar(0.1, 0, -65, 0.08, 0xaaccff);
createStar(-0.4, 0, -79, 0.1, 0xffddaa);
createStar(0.6, 0, -93, 0.07, 0xffee44);

// STEP 2 — fog
scene.fog = new THREE.FogExp2(0x000002, 0.04);
scene.background = new THREE.Color(0x0a1528);

// STEP 7 — loop
const MAX_LOOPS = 10;
let loopCount = 0;

function createWallSign() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#1a1520";
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = "#8a7a9a";
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, 496, 112);
  ctx.fillStyle = "#e8e0f0";
  ctx.font = "bold 36px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("face your fear", 256, 64);

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.85, 0.21),
    new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(canvas) })
  );
  sign.position.set(-1.99, 1.05, -48);
  sign.rotation.y = Math.PI / 2;
  sign.visible = false;
  scene.add(sign);
  return sign;
}

const fearSign = createWallSign();

const WIN_STARE_MS = 20000;
const WIN_STARE_MAX_DIST = 4.5;
let stareProgress = 0;
let gameWon = false;
let lastFrameTime = performance.now();

const loopCounterEl = document.getElementById("loop-counter");
const stareMeterEl = document.getElementById("stare-meter");
const stareFillEl = document.getElementById("stare-fill");
const winVeilEl = document.getElementById("win-veil");
const titleScreenEl = document.getElementById("title-screen");
const storyScreenEl = document.getElementById("story-screen");
const pauseMenuEl = document.getElementById("pause-menu");
const settingsMenuEl = document.getElementById("settings-menu");
const volumeSliderEl = document.getElementById("volume-slider");
const sensitivitySliderEl = document.getElementById("sensitivity-slider");
const settingsBackEl = document.getElementById("settings-back");

const IS_DEV_BUILD = new URLSearchParams(location.search).has("dev");
const IS_DESKTOP_APP = typeof window.nativeQuit === "function";
const settings = {
  masterVolume: parseFloat(localStorage.getItem("loop10_volume") ?? "1"),
  lookSensitivity: parseFloat(localStorage.getItem("loop10_sensitivity") ?? "1"),
};
window.LOOP10_LOOK_SENS = settings.lookSensitivity;

let introPhase = "title";
let gamePaused = false;
let settingsReturnTo = "title";
let masterGain = null;
let inputActive = false;
let useNativeLook = false;
let useFallbackLook = false;
const LOOK_BASE = 0.002;
const PI_2 = Math.PI / 2;
const lookEuler = new THREE.Euler(0, 0, 0, "YXZ");

function canControlPlayer() {
  return introPhase === "playing" && !gameWon && !gamePaused && inputActive;
}

function ensureAudioStarted() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  audioCtx.resume();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = settings.masterVolume;
  masterGain.connect(audioCtx.destination);
  sfxBus = audioCtx.createGain();
  sfxBus.gain.value = 1;
  sfxBus.connect(getAudioOutput(audioCtx));
  stockSfxGain = audioCtx.createGain();
  stockSfxGain.gain.value = STOCK_SOUND_MIX;
  stockSfxGain.connect(getAudioOutput(audioCtx));
  figureStepBus = audioCtx.createGain();
  figureStepBus.gain.value = FIGURE_STEP_BUS_MIX;
  figureStepBus.connect(getAudioOutput(audioCtx));
  startAmbientScore(audioCtx, loopCount);
  startProximitySound(audioCtx);
  startChildBreathing(audioCtx);
  startStockSoundTimer();
}

function activateInput() {
  if (introPhase !== "playing" || gameWon || gamePaused || inputActive) return;

  document.body.focus({ preventScroll: true });

  if (!IS_DESKTOP_APP) {
    controls.lock();
    window.setTimeout(() => {
      if (!controls.isLocked && !inputActive) enableFallbackInput();
    }, 120);
    return;
  }

  enableDesktopInput();
}

function enableDesktopInput() {
  if (inputActive) return;
  inputActive = true;
  useNativeLook = true;
  useFallbackLook = false;
  document.body.classList.add("pointer-locked");
  ensureAudioStarted();
  document.body.focus({ preventScroll: true });
  if (typeof window.nativeBeginPlay === "function") {
    window.nativeBeginPlay();
  } else if (typeof window.nativeCaptureMouse === "function") {
    window.nativeCaptureMouse();
  }
}

function enableFallbackInput() {
  if (inputActive) return;
  inputActive = true;
  useNativeLook = false;
  useFallbackLook = true;
  document.body.classList.add("pointer-locked");
  ensureAudioStarted();
}

function deactivateInput() {
  inputActive = false;
  useNativeLook = false;
  useFallbackLook = false;
  document.body.classList.remove("pointer-locked");
  if (typeof window.nativeReleaseMouse === "function") {
    window.nativeReleaseMouse();
  }
  if (controls.isLocked) controls.unlock();
}

function applyFallbackLook(dx, dy) {
  const sens = (window.LOOP10_LOOK_SENS || 1) * LOOK_BASE;
  lookEuler.setFromQuaternion(camera.quaternion);
  lookEuler.y -= dx * sens;
  lookEuler.x -= dy * sens;
  lookEuler.x = Math.max(-PI_2, Math.min(PI_2, lookEuler.x));
  camera.quaternion.setFromEuler(lookEuler);
}

function getAudioOutput(ctx) {
  return masterGain || ctx.destination;
}

function applyMasterVolume() {
  if (masterGain) {
    masterGain.gain.value = settings.masterVolume;
  }
}

function saveSettings() {
  localStorage.setItem("loop10_volume", String(settings.masterVolume));
  localStorage.setItem("loop10_sensitivity", String(settings.lookSensitivity));
}

function syncSettingsUi() {
  if (volumeSliderEl) {
    volumeSliderEl.value = String(Math.round(settings.masterVolume * 100));
  }
  if (sensitivitySliderEl) {
    sensitivitySliderEl.value = String(Math.round(settings.lookSensitivity * 100));
  }
}

function openSettings(from) {
  settingsReturnTo = from;
  pauseMenuEl?.classList.remove("is-visible");
  titleScreenEl?.classList.remove("is-visible");
  settingsMenuEl?.classList.add("is-visible");
  settingsMenuEl?.removeAttribute("aria-hidden");
  syncSettingsUi();
}

function closeSettings() {
  settingsMenuEl?.classList.remove("is-visible");
  settingsMenuEl?.setAttribute("aria-hidden", "true");
  if (settingsReturnTo === "pause") {
    pauseMenuEl?.classList.add("is-visible");
  } else if (settingsReturnTo === "title") {
    titleScreenEl?.classList.add("is-visible");
  }
}

function pauseGame() {
  if (introPhase !== "playing" || gameWon) return;
  gamePaused = true;
  deactivateInput();
  pauseMenuEl?.classList.add("is-visible");
  pauseMenuEl?.removeAttribute("aria-hidden");
}

function resumeGame() {
  gamePaused = false;
  pauseMenuEl?.classList.remove("is-visible");
  pauseMenuEl?.setAttribute("aria-hidden", "true");
  activateInput();
}

function exitApplication() {
  if (typeof window.nativeQuit === "function") {
    window.nativeQuit();
    return;
  }
  window.close();
}

function showStoryScreen() {
  introPhase = "story";
  titleScreenEl?.classList.remove("is-visible");
  storyScreenEl?.classList.add("is-visible");
  storyScreenEl?.removeAttribute("aria-hidden");
  titleScreenEl?.setAttribute("aria-hidden", "true");
}

function resetPlayerView() {
  camera.quaternion.set(0, 0, 0, 1);
  lookEuler.set(0, 0, 0, "YXZ");
}

function startGameplay() {
  introPhase = "playing";
  storyScreenEl?.classList.remove("is-visible");
  storyScreenEl?.setAttribute("aria-hidden", "true");
  loopCounterEl?.classList.add("is-visible");
  resetPlayerView();
  updateLoopCounter();
}

function resetAudio() {
  if (stockSoundTimeout) {
    clearTimeout(stockSoundTimeout);
    stockSoundTimeout = null;
  }
  if (breathing?.cycleTimer) {
    clearTimeout(breathing.cycleTimer);
    breathing.cycleTimer = null;
  }
  if (audioCtx) {
    audioCtx.close().catch(() => {});
    audioCtx = null;
    ambientLayers = null;
    proximitySound = null;
    breathing = null;
    sfxBus = null;
    stockSfxGain = null;
    figureStepBus = null;
  }
  stockSoundDeck = [];
  lastStockSoundIndex = -1;
  staringAtCreature = false;
}

function returnToMainMenu() {
  gameWon = false;
  gamePaused = false;
  loopCount = 0;
  stareProgress = 0;
  figureStepAccum = 0;
  lastFigureStepTime = 0;

  if (controls.isLocked) controls.unlock();

  figureGroup.position.set(0, 0, 6);
  controls.getObject().position.set(0, EYE_H, -2);
  resetPlayerView();
  fearSign.visible = false;

  if (winVeilEl) winVeilEl.classList.remove("is-visible");
  if (stareMeterEl) stareMeterEl.classList.remove("is-visible");
  if (stareFillEl) stareFillEl.style.width = "0%";
  loopCounterEl?.classList.remove("is-visible");
  pauseMenuEl?.classList.remove("is-visible");
  settingsMenuEl?.classList.remove("is-visible");
  deactivateInput();

  resetAudio();

  introPhase = "title";
  titleScreenEl?.classList.add("is-visible");
  titleScreenEl?.removeAttribute("aria-hidden");
  storyScreenEl?.classList.remove("is-visible");
  storyScreenEl?.setAttribute("aria-hidden", "true");

  updateLoopCounter();
}

function updateLoopCounter() {
  if (loopCounterEl) {
    loopCounterEl.textContent = `loop ${loopCount + 1}`;
  }
}

function skipToLoop10() {
  if (gameWon || introPhase !== "playing") return;
  loopCount = MAX_LOOPS - 1;
  fearSign.visible = true;
  shiftAmbientScore(loopCount);
  updateLoopCounter();
  controls.getObject().position.set(0, EYE_H, -2);
  figureGroup.position.set(0, 0, 6);
  resetPlayerView();
  stareProgress = 0;
  if (stareFillEl) stareFillEl.style.width = "0%";
}

function triggerWin() {
  if (gameWon) return;
  gameWon = true;
  resetPlayerView();
  if (controls.isLocked) controls.unlock();
  if (winVeilEl) winVeilEl.classList.add("is-visible");
  if (stareMeterEl) stareMeterEl.classList.remove("is-visible");
}

updateLoopCounter();

// STEP 9 — audio
let audioCtx = null;
let ambientLayers = null;
let proximitySound = null;
let breathing = null;
let sfxBus = null;
let stockSfxGain = null;
let figureStepBus = null;
let staringAtCreature = false;
let lastProximitySting = 0;
let lastStockSoundIndex = -1;
let stockSoundTimeout = null;
let stockSoundDeck = [];

const BREATH_MIX = 0.26;
const AMBIENT_MIX = 2.4;
const FIGURE_STEP_MIX = 2.1;
const FIGURE_STEP_BUS_MIX = 2.0;
const STOCK_SOUND_MIX = 2.5;
const STOCK_SOUND_INTERVAL_MS = 20000;
const STOCK_SOUND_FIRST_MS = 12000;

function makeDistortionCurve(amount) {
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = (i * 2) / 256 - 1;
    curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

const AMBIENT_PRESETS = [
  { root: 55, fifth: 82.5, pad: 110, whisper: 220, lfo: 0.06, filter: 380, noise: 0.028 },
  { root: 48, fifth: 72, pad: 96, whisper: 192, lfo: 0.1, filter: 300, noise: 0.038 },
  { root: 62, fifth: 93, pad: 124, whisper: 248, lfo: 0.04, filter: 460, noise: 0.022 },
  { root: 51, fifth: 76.5, pad: 102, whisper: 204, lfo: 0.14, filter: 340, noise: 0.045 },
  { root: 58, fifth: 87, pad: 116, whisper: 232, lfo: 0.08, filter: 420, noise: 0.032 },
];

document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement) {
    ensureAudioStarted();
  }
});

function startAmbientScore(ctx, loopIndex) {
  const preset = AMBIENT_PRESETS[loopIndex % AMBIENT_PRESETS.length];
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(getAudioOutput(ctx));

  const rootOsc = ctx.createOscillator();
  rootOsc.type = "sine";
  rootOsc.frequency.value = preset.root;
  const rootGain = ctx.createGain();
  rootGain.gain.value = 0.17;
  rootOsc.connect(rootGain);
  rootGain.connect(master);

  const fifthOsc = ctx.createOscillator();
  fifthOsc.type = "triangle";
  fifthOsc.frequency.value = preset.fifth;
  const fifthGain = ctx.createGain();
  fifthGain.gain.value = 0.085;
  fifthOsc.connect(fifthGain);
  fifthGain.connect(master);

  const padOsc = ctx.createOscillator();
  padOsc.type = "sine";
  padOsc.frequency.value = preset.pad;
  const padFilter = ctx.createBiquadFilter();
  padFilter.type = "lowpass";
  padFilter.frequency.value = preset.filter;
  const padGain = ctx.createGain();
  padGain.gain.value = 0.068;
  padOsc.connect(padFilter);
  padFilter.connect(padGain);
  padGain.connect(master);

  const whisperOsc = ctx.createOscillator();
  whisperOsc.type = "sine";
  whisperOsc.frequency.value = preset.whisper;
  const whisperGain = ctx.createGain();
  whisperGain.gain.value = 0.02;
  whisperOsc.connect(whisperGain);
  whisperGain.connect(master);

  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = preset.lfo;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = preset.filter * 0.35;
  lfo.connect(lfoGain);
  lfoGain.connect(padFilter.frequency);

  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const noiseData = noiseBuf.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) {
    noiseData[i] = (Math.random() * 2 - 1) * 0.5;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;
  noise.loop = true;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.value = 280;
  noiseFilter.Q.value = 0.8;
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = preset.noise;
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(master);

  rootOsc.start();
  fifthOsc.start();
  padOsc.start();
  whisperOsc.start();
  lfo.start();
  noise.start();

  master.gain.linearRampToValueAtTime(AMBIENT_MIX, ctx.currentTime + 4);

  ambientLayers = {
    master,
    rootOsc,
    fifthOsc,
    padOsc,
    whisperOsc,
    padFilter,
    noiseGain,
    lfo,
    lfoGain,
    preset,
  };
}

function shiftAmbientScore(loopIndex) {
  if (!audioCtx || !ambientLayers) return;

  const preset = AMBIENT_PRESETS[loopIndex % AMBIENT_PRESETS.length];
  const t = audioCtx.currentTime;
  const ramp = 5;

  ambientLayers.rootOsc.frequency.linearRampToValueAtTime(preset.root, t + ramp);
  ambientLayers.fifthOsc.frequency.linearRampToValueAtTime(preset.fifth, t + ramp);
  ambientLayers.padOsc.frequency.linearRampToValueAtTime(preset.pad, t + ramp);
  ambientLayers.whisperOsc.frequency.linearRampToValueAtTime(preset.whisper, t + ramp);
  ambientLayers.padFilter.frequency.linearRampToValueAtTime(preset.filter, t + ramp);
  ambientLayers.lfo.frequency.linearRampToValueAtTime(preset.lfo, t + ramp);
  ambientLayers.lfoGain.gain.linearRampToValueAtTime(preset.filter * 0.35, t + ramp);
  ambientLayers.noiseGain.gain.linearRampToValueAtTime(preset.noise, t + ramp);
  ambientLayers.preset = preset;
}

function startProximitySound(ctx) {
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(getAudioOutput(ctx));

  const rumbleBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const rumbleData = rumbleBuf.getChannelData(0);
  let pink = 0;
  for (let i = 0; i < rumbleData.length; i++) {
    const white = Math.random() * 2 - 1;
    pink = pink * 0.98 + white * 0.12;
    rumbleData[i] = pink;
  }
  const rumble = ctx.createBufferSource();
  rumble.buffer = rumbleBuf;
  rumble.loop = true;

  const rumbleFilter = ctx.createBiquadFilter();
  rumbleFilter.type = "lowpass";
  rumbleFilter.frequency.value = 90;
  rumbleFilter.Q.value = 0.5;
  const rumbleGain = ctx.createGain();
  rumbleGain.gain.value = 0.4;
  rumble.connect(rumbleFilter);
  rumbleFilter.connect(rumbleGain);
  rumbleGain.connect(master);
  rumble.start();

  proximitySound = { master };
}

function playProximitySting(ctx) {
  const t = ctx.currentTime;
  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(320, t);
  filter.frequency.exponentialRampToValueAtTime(140, t + 0.25);
  filter.Q.value = 2;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.06, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(sfxBus);
  noise.start(t);
  noise.stop(t + 0.35);
}

function smoothGainRamp(gainParam, target, durationSec, ctxTime) {
  gainParam.cancelScheduledValues(ctxTime);
  gainParam.setValueAtTime(gainParam.value, ctxTime);
  gainParam.linearRampToValueAtTime(target, ctxTime + durationSec);
}

function updateStareAudio(playerLooking) {
  if (!audioCtx || audioCtx.state !== "running") return;

  staringAtCreature = playerLooking;
  const t = audioCtx.currentTime;
  const fadeSec = playerLooking ? 0.22 : 0.32;

  if (ambientLayers?.master) {
    smoothGainRamp(
      ambientLayers.master.gain,
      playerLooking ? 0 : AMBIENT_MIX,
      fadeSec,
      t
    );
  }

  if (proximitySound?.master) {
    smoothGainRamp(proximitySound.master.gain, 0, fadeSec, t);
  }

  if (sfxBus) {
    smoothGainRamp(sfxBus.gain, playerLooking ? 0 : 1, fadeSec, t);
  }

  if (stockSfxGain) {
    smoothGainRamp(
      stockSfxGain.gain,
      playerLooking ? 0 : STOCK_SOUND_MIX,
      fadeSec,
      t
    );
  }

  if (figureStepBus) {
    smoothGainRamp(
      figureStepBus.gain,
      playerLooking ? 0 : FIGURE_STEP_BUS_MIX,
      fadeSec,
      t
    );
  }
}

function updateProximityAudio(dist, playerLooking) {
  if (!audioCtx || !proximitySound || audioCtx.state !== "running") return;
  if (playerLooking) return;

  const closeStart = 14;
  const closeFull = 3.5;
  const active = !playerLooking && dist < closeStart;
  const proximity = active
    ? 1 - THREE.MathUtils.clamp((dist - closeFull) / (closeStart - closeFull), 0, 1)
    : 0;

  const t = audioCtx.currentTime;
  smoothGainRamp(proximitySound.master.gain, proximity * 0.22, 0.2, t);

  if (active && dist < 8 && performance.now() - lastProximitySting > 8000) {
    lastProximitySting = performance.now();
    playProximitySting(audioCtx);
  }
}

function makeBreathNoiseBuffer(ctx, seconds) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let pink = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    pink = pink * 0.96 + white * 0.18;
    data[i] = pink;
  }
  return buf;
}

function startChildBreathing(ctx) {
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(getAudioOutput(ctx));

  const noise = ctx.createBufferSource();
  noise.buffer = makeBreathNoiseBuffer(ctx, 3);
  noise.loop = true;

  const inhaleFilter = ctx.createBiquadFilter();
  inhaleFilter.type = "bandpass";
  inhaleFilter.frequency.value = 1280;
  inhaleFilter.Q.value = 1.4;

  const exhaleFilter = ctx.createBiquadFilter();
  exhaleFilter.type = "bandpass";
  exhaleFilter.frequency.value = 420;
  exhaleFilter.Q.value = 0.9;

  const hissFilter = ctx.createBiquadFilter();
  hissFilter.type = "highpass";
  hissFilter.frequency.value = 1800;
  hissFilter.Q.value = 0.7;

  const inhaleGain = ctx.createGain();
  inhaleGain.gain.value = 0;
  const exhaleGain = ctx.createGain();
  exhaleGain.gain.value = 0;
  const hissGain = ctx.createGain();
  hissGain.gain.value = 0;

  const breathBus = ctx.createGain();
  const distorter = ctx.createWaveShaper();
  distorter.curve = makeDistortionCurve(14);
  distorter.oversample = "2x";
  const muffled = ctx.createBiquadFilter();
  muffled.type = "lowpass";
  muffled.frequency.value = 820;
  muffled.Q.value = 1.4;

  noise.connect(inhaleFilter);
  noise.connect(exhaleFilter);
  noise.connect(hissFilter);
  inhaleFilter.connect(inhaleGain);
  exhaleFilter.connect(exhaleGain);
  hissFilter.connect(hissGain);
  inhaleGain.connect(breathBus);
  exhaleGain.connect(breathBus);
  hissGain.connect(breathBus);
  breathBus.connect(distorter);
  distorter.connect(muffled);
  muffled.connect(master);

  noise.start();

  master.gain.linearRampToValueAtTime(BREATH_MIX, ctx.currentTime + 3);

  breathing = {
    master,
    inhaleGain,
    exhaleGain,
    hissGain,
    inhaleFilter,
    exhaleFilter,
    anxiety: 0,
    paused: false,
    cycleTimer: null,
  };
  queueBreathCycle(ctx);
}

function queueBreathCycle(ctx) {
  if (!breathing || !audioCtx || breathing.paused) return;

  const t = ctx.currentTime;
  const anxiety = breathing.anxiety;
  const rate = 1 + anxiety * 0.5;
  const inhale = (0.38 + Math.random() * 0.08) / rate;
  const pause = 0.06 + Math.random() * 0.05;
  const exhale = (0.72 + Math.random() * 0.18) / rate;
  const inhalePeak = 0.07 + anxiety * 0.04;
  const exhalePeak = 0.055 + anxiety * 0.035;

  breathing.inhaleGain.gain.cancelScheduledValues(t);
  breathing.inhaleGain.gain.setValueAtTime(0.0001, t);
  breathing.inhaleGain.gain.exponentialRampToValueAtTime(inhalePeak, t + 0.07);
  breathing.inhaleGain.gain.exponentialRampToValueAtTime(inhalePeak * 0.85, t + inhale * 0.75);
  breathing.inhaleGain.gain.exponentialRampToValueAtTime(0.0001, t + inhale);

  breathing.exhaleGain.gain.cancelScheduledValues(t);
  const exhaleStart = t + inhale + pause;
  breathing.exhaleGain.gain.setValueAtTime(0.0001, exhaleStart);
  breathing.exhaleGain.gain.exponentialRampToValueAtTime(exhalePeak, exhaleStart + 0.12);
  breathing.exhaleGain.gain.exponentialRampToValueAtTime(exhalePeak * 0.55, exhaleStart + exhale * 0.45);
  breathing.exhaleGain.gain.exponentialRampToValueAtTime(0.0001, exhaleStart + exhale);

  breathing.hissGain.gain.cancelScheduledValues(t);
  breathing.hissGain.gain.setValueAtTime(0.0001, exhaleStart);
  breathing.hissGain.gain.exponentialRampToValueAtTime(0.018 + anxiety * 0.01, exhaleStart + 0.08);
  breathing.hissGain.gain.exponentialRampToValueAtTime(0.0001, exhaleStart + exhale * 0.55);

  const nasalBase = 1180 + anxiety * 180;
  breathing.inhaleFilter.frequency.cancelScheduledValues(t);
  breathing.inhaleFilter.frequency.setValueAtTime(nasalBase * 0.85, t);
  breathing.inhaleFilter.frequency.exponentialRampToValueAtTime(nasalBase * 1.15, t + inhale * 0.5);
  breathing.inhaleFilter.frequency.exponentialRampToValueAtTime(nasalBase, t + inhale);

  const chestBase = 380 + anxiety * 60;
  breathing.exhaleFilter.frequency.cancelScheduledValues(t);
  breathing.exhaleFilter.frequency.setValueAtTime(chestBase, exhaleStart);
  breathing.exhaleFilter.frequency.exponentialRampToValueAtTime(chestBase * 0.8, exhaleStart + exhale);

  const totalMs = (inhale + pause + exhale + 0.15 + Math.random() * 0.25) * 1000;
  breathing.cycleTimer = setTimeout(() => queueBreathCycle(ctx), totalMs);
}

function updateChildBreathing(dist, playerLooking) {
  if (!breathing || !audioCtx || audioCtx.state !== "running") return;

  const t = audioCtx.currentTime;
  const wasPaused = breathing.paused;
  breathing.paused = playerLooking;

  if (playerLooking) {
    if (!wasPaused) {
      smoothGainRamp(breathing.master.gain, 0, 0.22, t);
      smoothGainRamp(breathing.inhaleGain.gain, 0.0001, 0.18, t);
      smoothGainRamp(breathing.exhaleGain.gain, 0.0001, 0.18, t);
      smoothGainRamp(breathing.hissGain.gain, 0.0001, 0.18, t);
    }
    if (breathing.cycleTimer) {
      clearTimeout(breathing.cycleTimer);
      breathing.cycleTimer = null;
    }
    return;
  }

  if (wasPaused) {
    smoothGainRamp(breathing.master.gain, BREATH_MIX, 0.32, t);
    queueBreathCycle(audioCtx);
  }

  let anxiety = 0;
  if (dist < 18) {
    anxiety += 1 - THREE.MathUtils.clamp((dist - 4) / 14, 0, 1);
  }
  breathing.anxiety = THREE.MathUtils.clamp(anxiety, 0, 1);
}

function playPhoneRing(ctx) {
  const t = ctx.currentTime;
  const t1 = ctx.createOscillator();
  const t2 = ctx.createOscillator();
  const g = ctx.createGain();
  t1.frequency.value = 480;
  t2.frequency.value = 620;
  t1.type = "sine";
  t2.type = "sine";
  t1.connect(g);
  t2.connect(g);
  g.connect(stockSfxGain);
  g.gain.value = 0.16;
  t1.start(t);
  t2.start(t);
  const dur = 0.6 + Math.random() * 0.4;
  t1.stop(t + dur);
  t2.stop(t + dur);
}

function playDoorCreak(ctx) {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(180, t);
  osc.frequency.exponentialRampToValueAtTime(90, t + 1.8);
  f.type = "bandpass";
  f.frequency.value = 220;
  f.Q.value = 1.2;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.24, t + 0.1);
  g.gain.exponentialRampToValueAtTime(0.001, t + 2);
  osc.connect(f);
  f.connect(g);
  g.connect(stockSfxGain);
  osc.start(t);
  osc.stop(t + 2.1);
}

function playDrip(ctx) {
  const t = ctx.currentTime;
  for (let i = 0; i < 3; i++) {
    const start = t + i * (0.35 + Math.random() * 0.25);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 900 + Math.random() * 200;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(0.12, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, start + 0.12);
    osc.connect(g);
    g.connect(stockSfxGain);
    osc.start(start);
    osc.stop(start + 0.15);
  }
}

function playThunder(ctx) {
  const t = ctx.currentTime;
  const len = Math.floor(ctx.sampleRate * 2.5);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let pink = 0;
  for (let i = 0; i < len; i++) {
    pink = pink * 0.98 + (Math.random() * 2 - 1) * 0.4;
    data[i] = pink;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 200;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.24, t + 0.3);
  g.gain.exponentialRampToValueAtTime(0.001, t + 2.5);
  src.connect(f);
  f.connect(g);
  g.connect(stockSfxGain);
  src.start(t);
  src.stop(t + 2.6);
}

function playWindGust(ctx) {
  const t = ctx.currentTime;
  const len = Math.floor(ctx.sampleRate * 1.2);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * (i / len);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.setValueAtTime(400, t);
  f.frequency.linearRampToValueAtTime(800, t + 0.6);
  f.Q.value = 0.5;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.18, t + 0.2);
  g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
  src.connect(f);
  f.connect(g);
  g.connect(stockSfxGain);
  src.start(t);
  src.stop(t + 1.3);
}

function playCabinetThump(ctx) {
  const t = ctx.currentTime;
  const len = Math.floor(ctx.sampleRate * 0.15);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 160;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.32, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  src.connect(f);
  f.connect(g);
  g.connect(stockSfxGain);
  src.start(t);
  src.stop(t + 0.16);
}

function playStaticBurst(ctx) {
  const t = ctx.currentTime;
  const len = Math.floor(ctx.sampleRate * 0.4);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = 2000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.18, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  src.connect(f);
  f.connect(g);
  g.connect(stockSfxGain);
  src.start(t);
  src.stop(t + 0.45);
}

function playDistantKnock(ctx) {
  const t = ctx.currentTime;
  for (let i = 0; i < 4; i++) {
    const start = t + i * 0.45;
    const len = Math.floor(ctx.sampleRate * 0.08);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let j = 0; j < len; j++) {
      data[j] = (Math.random() * 2 - 1) * (1 - j / len);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 280;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.2, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + 0.08);
    src.connect(f);
    f.connect(g);
    g.connect(stockSfxGain);
    src.start(start);
    src.stop(start + 0.1);
  }
}

function playDistantMoan(ctx) {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(140, t);
  osc.frequency.exponentialRampToValueAtTime(95, t + 2.2);
  f.type = "bandpass";
  f.frequency.value = 180;
  f.Q.value = 2;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.26, t + 0.35);
  g.gain.setValueAtTime(0.22, t + 1.2);
  g.gain.exponentialRampToValueAtTime(0.001, t + 2.4);
  osc.connect(f);
  f.connect(g);
  g.connect(stockSfxGain);
  osc.start(t);
  osc.stop(t + 2.5);
}

function playFloorSqueak(ctx) {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(320, t);
  osc.frequency.exponentialRampToValueAtTime(210, t + 0.7);
  f.type = "bandpass";
  f.frequency.value = 350;
  f.Q.value = 3;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.28, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
  osc.connect(f);
  f.connect(g);
  g.connect(stockSfxGain);
  osc.start(t);
  osc.stop(t + 0.85);
}

function playPipeClang(ctx) {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  osc.type = "sine";
  osc.frequency.setValueAtTime(520, t);
  osc.frequency.exponentialRampToValueAtTime(280, t + 0.5);
  f.type = "bandpass";
  f.frequency.value = 600;
  f.Q.value = 8;
  g.gain.setValueAtTime(0.3, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
  osc.connect(f);
  f.connect(g);
  g.connect(stockSfxGain);
  osc.start(t);
  osc.stop(t + 0.6);
}

function playClockTick(ctx) {
  const t = ctx.currentTime;
  for (let i = 0; i < 2; i++) {
    const start = t + i * 0.9;
    const len = Math.floor(ctx.sampleRate * 0.04);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let j = 0; j < len; j++) {
      data[j] = (Math.random() * 2 - 1) * (1 - j / len);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 1200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.24, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + 0.04);
    src.connect(f);
    f.connect(g);
    g.connect(stockSfxGain);
    src.start(start);
    src.stop(start + 0.05);
  }
}

function playHvacRumble(ctx) {
  const t = ctx.currentTime;
  const len = Math.floor(ctx.sampleRate * 1.8);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let pink = 0;
  for (let i = 0; i < len; i++) {
    pink = pink * 0.99 + (Math.random() * 2 - 1) * 0.35;
    data[i] = pink;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 90;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.22, t + 0.4);
  g.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
  src.connect(f);
  f.connect(g);
  g.connect(stockSfxGain);
  src.start(t);
  src.stop(t + 1.9);
}

function playDistantLaugh(ctx) {
  const t = ctx.currentTime;
  const bursts = [0, 0.2, 0.42, 0.68, 0.95];
  bursts.forEach((offset, i) => {
    const start = t + offset;
    const len = Math.floor(ctx.sampleRate * 0.14);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let j = 0; j < len; j++) {
      data[j] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 320 + i * 55 + Math.random() * 60;
    f.Q.value = 2.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(0.28 + (i % 2) * 0.08, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, start + 0.13);
    src.connect(f);
    f.connect(g);
    g.connect(stockSfxGain);
    src.start(start);
    src.stop(start + 0.14);
  });
}

function playRadioBurst(ctx) {
  const t = ctx.currentTime;
  const len = Math.floor(ctx.sampleRate * 0.9);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.setValueAtTime(300, t);
  f.frequency.linearRampToValueAtTime(900, t + 0.5);
  f.Q.value = 1.2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.22, t + 0.08);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
  src.connect(f);
  f.connect(g);
  g.connect(stockSfxGain);
  src.start(t);
  src.stop(t + 0.95);
}

function playGlassClink(ctx) {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(1800, t);
  osc.frequency.exponentialRampToValueAtTime(1200, t + 0.25);
  g.gain.setValueAtTime(0.2, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  osc.connect(g);
  g.connect(stockSfxGain);
  osc.start(t);
  osc.stop(t + 0.32);
}

const LOOP_STOCK_SOUNDS = [
  playPhoneRing,
  playDoorCreak,
  playDrip,
  playThunder,
  playWindGust,
  playCabinetThump,
  playStaticBurst,
  playDistantKnock,
  playDistantMoan,
  playFloorSqueak,
  playPipeClang,
  playClockTick,
  playHvacRumble,
  playDistantLaugh,
  playRadioBurst,
  playGlassClink,
];

function refillStockSoundDeck() {
  stockSoundDeck = LOOP_STOCK_SOUNDS.map((_, i) => i);
  for (let i = stockSoundDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [stockSoundDeck[i], stockSoundDeck[j]] = [stockSoundDeck[j], stockSoundDeck[i]];
  }
}

function playRandomStockSound() {
  if (!audioCtx || !stockSfxGain) return;
  if (stockSoundDeck.length === 0) refillStockSoundDeck();

  const playSound = () => {
    if (!audioCtx || audioCtx.state !== "running" || stockSoundDeck.length === 0) return;
    const idx = stockSoundDeck.pop();
    lastStockSoundIndex = idx;
    LOOP_STOCK_SOUNDS[idx](audioCtx);
  };

  if (audioCtx.state === "running") {
    playSound();
  } else {
    audioCtx.resume().then(playSound).catch(playSound);
  }
}

function scheduleNextStockSound(delayMs) {
  if (stockSoundTimeout) clearTimeout(stockSoundTimeout);
  stockSoundTimeout = setTimeout(() => {
    playRandomStockSound();
    scheduleNextStockSound(STOCK_SOUND_INTERVAL_MS);
  }, delayMs);
}

function startStockSoundTimer() {
  if (stockSoundTimeout) clearTimeout(stockSoundTimeout);
  stockSoundDeck = [];
  scheduleNextStockSound(STOCK_SOUND_FIRST_MS);
}

function playFigureFootstep(ctx, vol, t) {
  const master = ctx.createGain();
  master.gain.setValueAtTime(vol, t);
  master.connect(figureStepBus || sfxBus);

  const heelFreq = 58 + Math.random() * 14;
  const heel = ctx.createOscillator();
  heel.type = "sine";
  heel.frequency.setValueAtTime(heelFreq, t);
  heel.frequency.exponentialRampToValueAtTime(heelFreq * 0.65, t + 0.14);
  const heelGain = ctx.createGain();
  heelGain.gain.setValueAtTime(0.0001, t);
  heelGain.gain.linearRampToValueAtTime(0.72, t + 0.006);
  heelGain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
  heel.connect(heelGain);
  heelGain.connect(master);
  heel.start(t);
  heel.stop(t + 0.26);

  const len = Math.floor(ctx.sampleRate * 0.58);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let pink = 0;
  for (let i = 0; i < len; i++) {
    const env = Math.exp(-i / (ctx.sampleRate * 0.09));
    pink = pink * 0.955 + (Math.random() * 2 - 1) * 0.32;
    data[i] = pink * env;
  }
  const stomp = ctx.createBufferSource();
  stomp.buffer = buf;
  const stompFilter = ctx.createBiquadFilter();
  stompFilter.type = "lowpass";
  stompFilter.frequency.setValueAtTime(155, t);
  stompFilter.frequency.exponentialRampToValueAtTime(48, t + 0.4);
  stompFilter.Q.value = 0.9;
  const stompGain = ctx.createGain();
  stompGain.gain.setValueAtTime(0.0001, t);
  stompGain.gain.linearRampToValueAtTime(0.95, t + 0.01);
  stompGain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
  stomp.connect(stompFilter);
  stompFilter.connect(stompGain);
  stompGain.connect(master);
  stomp.start(t);
  stomp.stop(t + 0.58);

  const knockLen = Math.floor(ctx.sampleRate * 0.2);
  const knockBuf = ctx.createBuffer(1, knockLen, ctx.sampleRate);
  const knockData = knockBuf.getChannelData(0);
  for (let i = 0; i < knockLen; i++) {
    knockData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / knockLen, 1.4);
  }
  const knock = ctx.createBufferSource();
  knock.buffer = knockBuf;
  const knockFilter = ctx.createBiquadFilter();
  knockFilter.type = "bandpass";
  knockFilter.frequency.value = 88 + Math.random() * 30;
  knockFilter.Q.value = 1.4;
  const knockGain = ctx.createGain();
  knockGain.gain.setValueAtTime(0.42, t);
  knockGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  knock.connect(knockFilter);
  knockFilter.connect(knockGain);
  knockGain.connect(master);
  knock.start(t);
  knock.stop(t + 0.2);

  const roll = ctx.createOscillator();
  roll.type = "triangle";
  roll.frequency.setValueAtTime(38 + Math.random() * 8, t + 0.05);
  roll.frequency.exponentialRampToValueAtTime(28, t + 0.35);
  const rollGain = ctx.createGain();
  rollGain.gain.setValueAtTime(0.0001, t + 0.05);
  rollGain.gain.linearRampToValueAtTime(0.28, t + 0.07);
  rollGain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
  roll.connect(rollGain);
  rollGain.connect(master);
  roll.start(t + 0.05);
  roll.stop(t + 0.4);
}

// ——— Controls ———
const controls = new THREE.PointerLockControls(camera, document.body);

controls.addEventListener("lock", () => {
  inputActive = true;
  useFallbackLook = false;
  document.body.classList.add("pointer-locked");
  ensureAudioStarted();
});

controls.addEventListener("unlock", () => {
  if (gamePaused || gameWon || introPhase !== "playing") return;
  deactivateInput();
});

window.onNativeMouseDelta = (dx, dy) => {
  if (!useNativeLook || !inputActive || gamePaused) return;
  applyFallbackLook(dx, dy);
};

document.addEventListener("mousemove", (e) => {
  if (!useFallbackLook || useNativeLook || !inputActive || gamePaused) return;
  if (e.movementX || e.movementY) {
    applyFallbackLook(e.movementX, e.movementY);
  }
});

scene.add(controls.getObject());

const keys = {};

function handleKeyEvent(key, isDown) {
  key = key.toLowerCase();

  if (!isDown) {
    keys[key] = false;
    return;
  }

  if (key === "escape") {
    if (settingsMenuEl?.classList.contains("is-visible")) {
      closeSettings();
      return;
    }
    if (introPhase === "playing" && !gameWon) {
      if (gamePaused) {
        resumeGame();
      } else {
        pauseGame();
      }
      return;
    }
  }

  if (key === "s" && introPhase === "title" && !settingsMenuEl?.classList.contains("is-visible")) {
    openSettings("title");
    return;
  }

  if (key === "l") {
    if (introPhase === "title") {
      showStoryScreen();
      return;
    }
    if (introPhase === "story") {
      startGameplay();
      activateInput();
      return;
    }
  }

  if (gameWon && key === "x") {
    returnToMainMenu();
    return;
  }

  if (IS_DEV_BUILD && key === " ") {
    const t = performance.now();
    if (!window._lastSpaceTime) window._lastSpaceTime = 0;
    if (t - window._lastSpaceTime < 400) {
      skipToLoop10();
      window._lastSpaceTime = 0;
      return;
    }
    window._lastSpaceTime = t;
  }

  keys[key] = true;
}

if (IS_DESKTOP_APP) {
  window.onNativeKey = (key, isDown) => handleKeyEvent(key, isDown);
} else {
  document.addEventListener("keydown", (e) => {
    handleKeyEvent(e.key.toLowerCase(), true);
    if (canControlPlayer() && "wasd".includes(e.key.toLowerCase())) {
      e.preventDefault();
    }
  });
  document.addEventListener("keyup", (e) => {
    handleKeyEvent(e.key.toLowerCase(), false);
  });
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt = Math.min(now - lastFrameTime, 50);
  lastFrameTime = now;
  const dtSec = dt / 1000;

  if (introPhase !== "playing" || gamePaused) {
    renderer.render(scene, camera);
    return;
  }

  if (canControlPlayer()) {
    if (keys["w"]) controls.moveForward(MOVE_SPEED * dtSec);
    if (keys["s"]) controls.moveForward(-MOVE_SPEED * dtSec);
    if (keys["a"]) controls.moveRight(-MOVE_SPEED * dtSec);
    if (keys["d"]) controls.moveRight(MOVE_SPEED * dtSec);
  }

  const p = controls.getObject().position;
  p.y = EYE_H;
  p.x = THREE.MathUtils.clamp(p.x, -1.8, 1.8);
  if (p.z < -118) {
    p.z = -2;
    loopCount++;
    shiftAmbientScore(loopCount);
    figureGroup.position.set(0, 0, 6);
    updateLoopCounter();
    if (loopCount >= MAX_LOOPS - 1) {
      fearSign.visible = true;
    }
  }
  if (p.z > 0) p.z = -0.5;

  const fPos = figureGroup.position;
  const cPos = controls.getObject().position;
  const fDist = fPos.distanceTo(cPos);
  const camDir = new THREE.Vector3();
  camera.getWorldDirection(camDir);
  const toFig = new THREE.Vector3(fPos.x - cPos.x, 0, fPos.z - cPos.z).normalize();
  const dot = camDir.dot(toFig);
  const playerLooking = dot > 0.2;

  const prevFigX = fPos.x;
  const prevFigZ = fPos.z;

  if (!gameWon && !playerLooking && fDist > FIGURE_FOLLOW_DIST) {
    const moveDir = new THREE.Vector3(cPos.x - fPos.x, 0, cPos.z - fPos.z).normalize();
    const distT = THREE.MathUtils.clamp(
      (fDist - FIGURE_FOLLOW_DIST) / (FIGURE_CATCHUP_DIST - FIGURE_FOLLOW_DIST),
      0,
      1
    );
    let speed = THREE.MathUtils.lerp(FIGURE_SPEED, FIGURE_CATCHUP_SPEED, distT);
    if (inputActive && keys["w"]) speed += FIGURE_FLEE_BOOST;
    const closeT = THREE.MathUtils.clamp((FIGURE_FOLLOW_DIST + 2.5 - fDist) / 2.5, 0, 1);
    speed *= 1 - closeT * 0.6;
    speed *= dtSec;
    figureGroup.position.x += moveDir.x * speed;
    figureGroup.position.z += moveDir.z * speed;
  }

  const figMoved = Math.hypot(
    figureGroup.position.x - prevFigX,
    figureGroup.position.z - prevFigZ
  );
  const playerMoving =
    keys["w"] || keys["s"] || keys["a"] || keys["d"];
  if (
    !gameWon &&
    !playerLooking &&
    figMoved > 0.001 &&
    fDist > FIGURE_FOLLOW_DIST &&
    fDist < 55 &&
    audioCtx &&
    audioCtx.state === "running"
  ) {
    figureStepAccum += figMoved;
    while (figureStepAccum >= FIGURE_STEP_DISTANCE) {
      figureStepAccum -= FIGURE_STEP_DISTANCE;
      if (now - lastFigureStepTime < FIGURE_STEP_MIN_MS) break;
      lastFigureStepTime = now;
      const stepNear = FIGURE_FOLLOW_DIST + 0.5;
      const stepFar = 20;
      const stepProximity =
        1 -
        THREE.MathUtils.clamp((fDist - stepNear) / (stepFar - stepNear), 0, 1);
      const moveDuck = playerMoving ? 0.25 : 1;
      const vol = (0.45 + stepProximity * 1.55) * FIGURE_STEP_MIX * moveDuck;
      playFigureFootstep(audioCtx, vol, audioCtx.currentTime);
    }
  } else if (playerLooking || fDist <= FIGURE_FOLLOW_DIST) {
    figureStepAccum = 0;
  }

  figureGroup.rotation.y = Math.atan2(cPos.x - fPos.x, cPos.z - fPos.z);

  updateStareAudio(playerLooking);
  updateProximityAudio(fDist, playerLooking);

  updateChildBreathing(fDist, playerLooking);

  if (!gameWon && loopCount >= MAX_LOOPS - 1 && playerLooking) {
    if (stareMeterEl) stareMeterEl.classList.add("is-visible");
    if (fDist <= WIN_STARE_MAX_DIST) {
      stareProgress += dt;
      if (stareFillEl) {
        stareFillEl.style.width = `${Math.min(100, (stareProgress / WIN_STARE_MS) * 100)}%`;
      }
      if (stareProgress >= WIN_STARE_MS) {
        triggerWin();
      }
    } else {
      stareProgress = 0;
      if (stareFillEl) stareFillEl.style.width = "0%";
    }
  } else {
    stareProgress = 0;
    if (stareFillEl) stareFillEl.style.width = "0%";
    if (stareMeterEl) stareMeterEl.classList.remove("is-visible");
  }

  renderer.render(scene, camera);
}
animate();

volumeSliderEl?.addEventListener("input", () => {
  settings.masterVolume = Number(volumeSliderEl.value) / 100;
  applyMasterVolume();
  saveSettings();
});

sensitivitySliderEl?.addEventListener("input", () => {
  settings.lookSensitivity = Number(sensitivitySliderEl.value) / 100;
  window.LOOP10_LOOK_SENS = settings.lookSensitivity;
  saveSettings();
});

settingsBackEl?.addEventListener("click", () => closeSettings());

pauseMenuEl?.querySelectorAll("[data-action]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const action = btn.getAttribute("data-action");
    if (action === "resume") resumeGame();
    if (action === "settings") openSettings("pause");
    if (action === "main-menu") {
      resumeGame();
      returnToMainMenu();
    }
    if (action === "quit") exitApplication();
  });
});

syncSettingsUi();
