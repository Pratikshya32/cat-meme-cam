const GESTURE_MAP = {
  thumbsup:  { img: MEMES.thumbsup,  label: "👍 Thumbs Up Cat" },
  fist:      { img: MEMES.fistcat,   label: "✊ Fist Cat" },
  oksign:    { img: MEMES.oksign,    label: "👌 OK Cat" },
  namaste:   { img: MEMES.namaste,   label: "🙏 Namaste Cat" },
  shutup:    { img: MEMES.shutup,    label: "🤫 Shh Cat" },
  smile:     { img: MEMES.smile,     label: "😊 Smiling Cat" },
  tongue:    { img: MEMES.tongue,    label: "😛 Tongue Cat" },
};

// ── DOM refs ──────────────────────────────────────────────────────────────────
const video      = document.getElementById("video");
const canvas     = document.getElementById("overlay");
const ctx        = canvas.getContext("2d");
const memeImg    = document.getElementById("meme-img");
const memeLabel  = document.getElementById("meme-label");
const noMeme     = document.getElementById("no-meme");
const loadDiv    = document.getElementById("loading");
const loadStatus = document.getElementById("load-status");
const debugEl    = document.getElementById("debug");

let currentGesture  = null;
let lastGestureTime = 0;
const GESTURE_TIMEOUT = 700;

// ── UI helpers ────────────────────────────────────────────────────────────────
function showMeme(key) {
  const m = GESTURE_MAP[key];
  if (!m) return;
  memeImg.src           = m.img;
  memeImg.style.display = "block";
  memeLabel.textContent = m.label;
  noMeme.style.display  = "none";
  Object.keys(GESTURE_MAP).forEach(k => {
    const el = document.getElementById("b-" + k);
    if (el) el.classList.toggle("active", k === key);
  });
}

function clearMeme() {
  memeImg.style.display = "none";
  memeLabel.textContent = "";
  noMeme.style.display  = "block";
  document.querySelectorAll(".badge").forEach(b => b.classList.remove("active"));
}

// ── Geometry helpers ──────────────────────────────────────────────────────────
function dist2D(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function fingerExtended(lm, tipIdx, mcpIdx) {
  return lm[tipIdx].y < lm[mcpIdx].y - 0.02;
}

function fingerCurled(lm, tipIdx, mcpIdx) {
  return lm[tipIdx].y > lm[mcpIdx].y;
}

// ── Hand gesture classifier ───────────────────────────────────────────────────
function classifyHand(lm) {
  const handSize = dist2D(lm[0], lm[9]);

  const indexExt   = fingerExtended(lm, 8,  5);
  const middleExt  = fingerExtended(lm, 12, 9);
  const ringExt    = fingerExtended(lm, 16, 13);
  const pinkyExt   = fingerExtended(lm, 20, 17);

  const indexCurl  = fingerCurled(lm, 8,  5);
  const middleCurl = fingerCurled(lm, 12, 9);
  const ringCurl   = fingerCurled(lm, 16, 13);
  const pinkyCurl  = fingerCurled(lm, 20, 17);

  const thumbUp  = lm[4].y < lm[0].y - handSize * 0.3;
  const thumbExt = dist2D(lm[4], lm[2]) > handSize * 0.4;

  debugEl.textContent =
    `I:${indexExt?'E':indexCurl?'C':'-'} ` +
    `M:${middleExt?'E':middleCurl?'C':'-'} ` +
    `R:${ringExt?'E':ringCurl?'C':'-'} ` +
    `P:${pinkyExt?'E':pinkyCurl?'C':'-'} ` +
    `T:${thumbUp?'UP':thumbExt?'ext':'-'}`;

  // Fist / Thumbs Up
  if (indexCurl && middleCurl && ringCurl && pinkyCurl) {
    if (thumbUp) return "thumbsup";
    return "fist";
  }

  // OK Sign
  const pinch = dist2D(lm[4], lm[8]);
  if (pinch < handSize * 0.4 && middleExt && ringExt && pinkyExt) return "oksign";

  // Shh — only index up
  if (indexExt && middleCurl && ringCurl && pinkyCurl) return "shutup";

  // Namaste — all fingers up, close together
  if (indexExt && middleExt && ringExt && pinkyExt) {
    const spread = dist2D(lm[8], lm[20]);
    if (spread / handSize < 0.65) return "namaste";
  }

  return null;
}

// ── Face expression classifier ────────────────────────────────────────────────
function classifyFace(lm) {
  const faceW      = dist2D(lm[234], lm[454]);
  const mouthGap   = dist2D(lm[13],  lm[14])  / faceW;
  const lipStretch = dist2D(lm[0],   lm[17])  / faceW;

  if (mouthGap > 0.06 && lipStretch > 0.14) return "tongue";

  const smileRatio = dist2D(lm[61], lm[291]) / faceW;
  if (smileRatio > 0.46) return "smile";

  return null;
}

// ── Detection loop ────────────────────────────────────────────────────────────
let handLandmarker, faceLandmarker, lastVideoTime = -1;

async function detect() {
  if (video.readyState < 2) { requestAnimationFrame(detect); return; }
  const now = performance.now();
  let detected = null;

  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;

    const handResult = handLandmarker.detectForVideo(video, now);
    canvas.width  = video.videoWidth  || 480;
    canvas.height = video.videoHeight || 360;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (handResult.landmarks?.length > 0) {
      for (const lm of handResult.landmarks) {
        drawHand(lm);
        const g = classifyHand(lm);
        if (g) { detected = g; break; }
      }
    }

    if (!detected) {
      const faceResult = faceLandmarker.detectForVideo(video, now);
      if (faceResult.faceLandmarks?.length > 0) {
        detected = classifyFace(faceResult.faceLandmarks[0]);
      }
    }
  }

  if (detected) {
    lastGestureTime = now;
    if (detected !== currentGesture) { currentGesture = detected; showMeme(detected); }
  } else if (currentGesture && now - lastGestureTime > GESTURE_TIMEOUT) {
    currentGesture = null; clearMeme();
  }

  requestAnimationFrame(detect);
}

// ── Hand skeleton renderer ────────────────────────────────────────────────────
const CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20],[0,17]
];

function drawHand(lm) {
  const W = canvas.width, H = canvas.height;
  ctx.strokeStyle = "#ffcc00"; ctx.lineWidth = 2; ctx.fillStyle = "#ff6ec7";
  for (const [a, b] of CONNECTIONS) {
    ctx.beginPath();
    ctx.moveTo(lm[a].x * W, lm[a].y * H);
    ctx.lineTo(lm[b].x * W, lm[b].y * H);
    ctx.stroke();
  }
  for (const p of lm) {
    ctx.beginPath(); ctx.arc(p.x * W, p.y * H, 4, 0, Math.PI * 2); ctx.fill();
  }
}

// ── Initialise MediaPipe + camera ─────────────────────────────────────────────
async function init() {
  const { FilesetResolver, HandLandmarker, FaceLandmarker } = await import(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs"
  );

  loadStatus.textContent = "Loading AI models...";
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
  );

  loadStatus.textContent = "Loading hand detector...";
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
      delegate: "GPU"
    },
    runningMode: "VIDEO",
    numHands: 2
  });

  loadStatus.textContent = "Loading face detector...";
  faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
      delegate: "GPU"
    },
    runningMode: "VIDEO",
    numFaces: 1,
    outputFaceBlendshapes: false
  });

  loadStatus.textContent = "Starting camera...";
  const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
  video.srcObject = stream;
  await new Promise(r => video.onloadedmetadata = r);
  video.play();

  loadDiv.style.display = "none";
  requestAnimationFrame(detect);
}

init().catch(err => { loadStatus.textContent = "Error: " + err.message; console.error(err); });
