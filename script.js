// ── MEME MAPPING SYSTEM ────────────────────────────────────────────────────────
// Maps detected gesture keys to their display labels and raw base64 images from memes.js.
// Extensible: to add new mappings, simply add a new key-value pair here.
const memeMapping = {
  thumbsup: { img: MEMES.thumbsup, label: "👍 Thumbs Up Cat" },
  fist: { img: MEMES.fistcat, label: "✊ Fist Cat" },
  oksign: { img: MEMES.oksign, label: "👌 OK Cat" },
  namaste: { img: MEMES.namaste, label: "🙏 Namaste Cat" },
  shutup: { img: MEMES.shutup, label: "🤫 Shh Cat" },
  victory: { img: MEMES.love, label: "✌️ Peace/Love Cat" }, // Mapped to MEMES.love from memes.js
  smile: { img: MEMES.smile, label: "😊 Smiling Cat" },
  tongue: { img: MEMES.tongue, label: "😛 Tongue Cat" },
};

// ── DOM ELEMENTS ──────────────────────────────────────────────────────────────
const videoElement = document.getElementById("video");
const overlayCanvas = document.getElementById("overlay");
const canvasContext = overlayCanvas.getContext("2d");
const memeImageElement = document.getElementById("meme-img");
const memeLabelElement = document.getElementById("meme-label");
const noMemePlaceholder = document.getElementById("no-meme");
const loadingContainer = document.getElementById("loading");
const loadingStatusText = document.getElementById("load-status");
const debugPanel = document.getElementById("debug");
const screenshotButton = document.getElementById("btn-screenshot");

// ── APPLICATION STATE ──────────────────────────────────────────────────────────
let currentGesture = null;
let lastGestureDetectedTime = 0;
const GESTURE_INACTIVITY_TIMEOUT_MS = 700; // Time without detection before clearing UI

// Confidence Smoothing Configuration
const gestureHistoryBuffer = [];
const SMOOTHING_BUFFER_SIZE = 5; // Window size of frames to scan
const SMOOTHING_MATCH_THRESHOLD = 3; // Minimum identical frames required to trigger

// ── RENDER & UI UPDATES ───────────────────────────────────────────────────────
function renderActiveMeme(gestureKey) {
  const memeData = memeMapping[gestureKey];
  if (!memeData) return;

  memeImageElement.src = memeData.img;
  memeImageElement.style.display = "block";
  memeLabelElement.textContent = memeData.label;
  noMemePlaceholder.style.display = "none";

  // Highlight the active badge in the status bar
  Object.keys(memeMapping).forEach((key) => {
    const badge = document.getElementById("b-" + key);
    if (badge) {
      badge.classList.toggle("active", key === gestureKey);
    }
  });
}

function resetMemeDisplay() {
  memeImageElement.style.display = "none";
  memeLabelElement.textContent = "";
  noMemePlaceholder.style.display = "block";
  document.querySelectorAll(".badge").forEach((badge) => badge.classList.remove("active"));
}

// ── GEOMETRIC MATH HELPERS ────────────────────────────────────────────────────
function calculateEuclideanDistance(pointA, pointB) {
  return Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y);
}

// Checks if a finger is extended by verifying if its tip is vertically higher (lower Y coordinate)
// than the corresponding metacarpophalangeal (MCP) knuckle joint by a small threshold.
function checkFingerIsExtended(landmarks, tipIndex, mcpIndex) {
  return landmarks[tipIndex].y < landmarks[mcpIndex].y - 0.02;
}

// Checks if a finger is curled by verifying if its tip is vertically lower (higher Y coordinate)
// than the corresponding knuckle joint.
function checkFingerIsCurled(landmarks, tipIndex, mcpIndex) {
  return landmarks[tipIndex].y > landmarks[mcpIndex].y;
}

// ── HAND GESTURE CLASSIFIER ───────────────────────────────────────────────────
function identifyHandGesture(landmarks) {
  // handSize represents the scale of the hand in screen space.
  // Wrist (0) to middle knuckle MCP (9) is used as it remains static regardless of finger curl.
  const handSize = calculateEuclideanDistance(landmarks[0], landmarks[9]);

  const isIndexExtended = checkFingerIsExtended(landmarks, 8, 5);
  const isMiddleExtended = checkFingerIsExtended(landmarks, 12, 9);
  const isRingExtended = checkFingerIsExtended(landmarks, 16, 13);
  const isPinkyExtended = checkFingerIsExtended(landmarks, 20, 17);

  const isIndexCurled = checkFingerIsCurled(landmarks, 8, 5);
  const isMiddleCurled = checkFingerIsCurled(landmarks, 12, 9);
  const isRingCurled = checkFingerIsCurled(landmarks, 16, 13);
  const isPinkyCurled = checkFingerIsCurled(landmarks, 20, 17);

  // Thumb is up if the tip (4) is vertically higher than the wrist (0) by 30% of palm size
  const isThumbUp = landmarks[4].y < landmarks[0].y - handSize * 0.3;
  
  // Thumb is extended outwards if it has sufficient distance from knuckle joint (2)
  const isThumbExtended = calculateEuclideanDistance(landmarks[4], landmarks[2]) > handSize * 0.4;

  // Render quick diagnostic coordinates for debugging
  debugPanel.textContent =
    `Idx:${isIndexExtended ? "Ext" : isIndexCurled ? "Crl" : "-"} ` +
    `Mid:${isMiddleExtended ? "Ext" : isMiddleCurled ? "Crl" : "-"} ` +
    `Rng:${isRingExtended ? "Ext" : isRingCurled ? "Crl" : "-"} ` +
    `Pky:${isPinkyExtended ? "Ext" : isPinkyCurled ? "Crl" : "-"} ` +
    `Thb:${isThumbUp ? "UP" : isThumbExtended ? "Ext" : "-"}`;

  // 1. Victory/Peace Sign: Index and Middle extended, Ring and Pinky curled, with spread between Index/Middle.
  const distanceIndexToMiddle = calculateEuclideanDistance(landmarks[8], landmarks[12]);
  // Spread distance threshold (25% of palm size) ensures the fingers form a distinct V shape.
  const isPeaceSpread = distanceIndexToMiddle > handSize * 0.25;
  if (isIndexExtended && isMiddleExtended && isRingCurled && isPinkyCurled && isPeaceSpread) {
    return "victory";
  }

  // 2. Fist / Thumbs Up
  if (isIndexCurled && isMiddleCurled && isRingCurled && isPinkyCurled) {
    if (isThumbUp) return "thumbsup";
    return "fist";
  }

  // 3. OK Sign: Pinch between Thumb (4) and Index (8), with all other fingers straight.
  const pinchDistance = calculateEuclideanDistance(landmarks[4], landmarks[8]);
  // A threshold of 40% handSize accounts for camera perspective changes.
  if (pinchDistance < handSize * 0.4 && isMiddleExtended && isRingExtended && isPinkyExtended) {
    return "oksign";
  }

  // 4. Shh / Shut Up: Only the Index finger is straight, others are curled.
  if (isIndexExtended && isMiddleCurled && isRingCurled && isPinkyCurled) {
    return "shutup";
  }

  // 5. Namaste: All fingers straight and close together (spread between Index 8 and Pinky 20 is narrow).
  if (isIndexExtended && isMiddleExtended && isRingExtended && isPinkyExtended) {
    const totalSpread = calculateEuclideanDistance(landmarks[8], landmarks[20]);
    if (totalSpread / handSize < 0.65) return "namaste";
  }

  return null;
}

// ── FACIAL EXPRESSION CLASSIFIER ──────────────────────────────────────────────
function identifyFacialExpression(landmarks) {
  // faceWidth represents head scale based on left-most (234) and right-most (454) face points.
  const faceWidth = calculateEuclideanDistance(landmarks[234], landmarks[454]);
  const mouthOpeningGap = calculateEuclideanDistance(landmarks[13], landmarks[14]) / faceWidth;
  const lipVerticalStretch = calculateEuclideanDistance(landmarks[0], landmarks[17]) / faceWidth;

  // Tongue Out: vertical mouth opening gap and lips stretched.
  if (mouthOpeningGap > 0.06 && lipVerticalStretch > 0.14) {
    return "tongue";
  }

  // Smile: mouth corner distance (61 to 291) relative to face width.
  // Standard neutral mouth ratio is ~0.36; stretching beyond 0.46 indicates a clear smile.
  const smileRatio = calculateEuclideanDistance(landmarks[61], landmarks[291]) / faceWidth;
  if (smileRatio > 0.46) {
    return "smile";
  }

  return null;
}

// ── DETECTION & SMOOTHING LOOP ────────────────────────────────────────────────
let handLandmarkerInstance, faceLandmarkerInstance, lastProcessedVideoTime = -1;

async function runDetectionLoop() {
  if (videoElement.readyState < 2) {
    requestAnimationFrame(runDetectionLoop);
    return;
  }
  const currentTime = performance.now();
  let frameDetection = null;

  if (videoElement.currentTime !== lastProcessedVideoTime) {
    lastProcessedVideoTime = videoElement.currentTime;

    // Sync canvas and overlay coordinates with video resolution
    overlayCanvas.width = videoElement.videoWidth || 640;
    overlayCanvas.height = videoElement.videoHeight || 480;
    canvasContext.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    // 1. Process Hand Detection
    const handResult = handLandmarkerInstance.detectForVideo(videoElement, currentTime);
    if (handResult.landmarks && handResult.landmarks.length > 0) {
      for (const landmarks of handResult.landmarks) {
        renderHandSkeleton(landmarks);
        const gesture = identifyHandGesture(landmarks);
        if (gesture) {
          frameDetection = gesture;
          break;
        }
      }
    }

    // 2. Process Face Detection (Fallback if no hand gesture is active)
    if (!frameDetection) {
      const faceResult = faceLandmarkerInstance.detectForVideo(videoElement, currentTime);
      if (faceResult.faceLandmarks && faceResult.faceLandmarks.length > 0) {
        frameDetection = identifyFacialExpression(faceResult.faceLandmarks[0]);
      }
    }
  }

  // Confidence Smoothing Implementation
  gestureHistoryBuffer.push(frameDetection);
  if (gestureHistoryBuffer.length > SMOOTHING_BUFFER_SIZE) {
    gestureHistoryBuffer.shift();
  }

  // Compute the mode (most frequent gesture) in the sliding window buffer
  const frequencies = {};
  let mostFrequentGesture = null;
  let maxCount = 0;

  for (const gesture of gestureHistoryBuffer) {
    frequencies[gesture] = (frequencies[gesture] || 0) + 1;
    if (frequencies[gesture] > maxCount) {
      maxCount = frequencies[gesture];
      mostFrequentGesture = gesture;
    }
  }

  // Update current gesture if the threshold of matching frames is satisfied
  if (mostFrequentGesture && maxCount >= SMOOTHING_MATCH_THRESHOLD) {
    lastGestureDetectedTime = currentTime;
    if (mostFrequentGesture !== currentGesture) {
      currentGesture = mostFrequentGesture;
      renderActiveMeme(mostFrequentGesture);
    }
  } else if (currentGesture && currentTime - lastGestureDetectedTime > GESTURE_INACTIVITY_TIMEOUT_MS) {
    currentGesture = null;
    resetMemeDisplay();
  }

  requestAnimationFrame(runDetectionLoop);
}

// ── HAND SKELETON RENDERER ────────────────────────────────────────────────────
const PALM_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8], // Index
  [5, 9], [9, 10], [10, 11], [11, 12], // Middle
  [9, 13], [13, 14], [14, 15], [15, 16], // Ring
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17], // Pinky + Palm Base
];

function renderHandSkeleton(landmarks) {
  const width = overlayCanvas.width;
  const height = overlayCanvas.height;

  canvasContext.strokeStyle = "#ffcc00";
  canvasContext.lineWidth = 3;
  canvasContext.fillStyle = "#ff6ec7";

  // Draw connecting bones
  for (const [startNode, endNode] of PALM_CONNECTIONS) {
    canvasContext.beginPath();
    canvasContext.moveTo(landmarks[startNode].x * width, landmarks[startNode].y * height);
    canvasContext.lineTo(landmarks[endNode].x * width, landmarks[endNode].y * height);
    canvasContext.stroke();
  }

  // Draw joint vertices
  for (const joint of landmarks) {
    canvasContext.beginPath();
    canvasContext.arc(joint.x * width, joint.y * height, 5, 0, Math.PI * 2);
    canvasContext.fill();
  }
}

// ── SAVE/SCREENSHOT COLLAGE FEATURE ──────────────────────────────────────────
async function saveMemeCollage() {
  if (!currentGesture) {
    alert("Please strike a pose to load a cat meme before saving!");
    return;
  }

  const videoWidth = videoElement.videoWidth || 640;
  const videoHeight = videoElement.videoHeight || 480;
  
  // Set dimensions for the screenshot collage canvas
  const collageCanvas = document.createElement("canvas");
  const gap = 15;
  const border = 10;
  const textSpace = 50;
  
  const paneWidth = 400;
  const paneHeight = 300;
  
  collageCanvas.width = paneWidth * 2 + gap + border * 2;
  collageCanvas.height = paneHeight + border * 2 + textSpace;
  
  const ctx = collageCanvas.getContext("2d");
  
  // Draw background frame
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, collageCanvas.width, collageCanvas.height);
  
  // Draw mirrored video capture
  ctx.save();
  ctx.translate(border + paneWidth, border);
  ctx.scale(-1, 1);
  ctx.drawImage(videoElement, 0, 0, paneWidth, paneHeight);
  ctx.restore();
  
  // Draw skeleton overlays over the captured frame
  if (gestureHistoryBuffer[gestureHistoryBuffer.length - 1]) {
    // Attempt to copy skeleton coordinates
    ctx.strokeStyle = "#ffcc00";
    ctx.lineWidth = 2;
    ctx.fillStyle = "#ff6ec7";
    
    // We fetch current hand coordinates drawn on the overlay canvas
    ctx.drawImage(overlayCanvas, border, border, paneWidth, paneHeight);
  }
  
  // Draw matched cat meme image
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(border + paneWidth + gap, border, paneWidth, paneHeight);
  ctx.drawImage(memeImageElement, border + paneWidth + gap, border, paneWidth, paneHeight);
  
  // Draw title banner and text signature
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 16px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("MemeCat Cam Collage", collageCanvas.width / 2, collageCanvas.height - 30);
  
  ctx.fillStyle = "#ffcc00";
  ctx.font = "14px sans-serif";
  ctx.fillText(`Triggered: ${memeMapping[currentGesture].label}`, collageCanvas.width / 2, collageCanvas.height - 12);
  
  // Trigger Image Download
  const dataURL = collageCanvas.toDataURL("image/png");
  const downloadLink = document.createElement("a");
  downloadLink.download = `memecat-collage-${Date.now()}.png`;
  downloadLink.href = dataURL;
  downloadLink.click();
}

screenshotButton.addEventListener("click", saveMemeCollage);

// ── INITIALISE VISION TOOLS & WEBCAM ──────────────────────────────────────────
async function initializeApplication() {
  const { FilesetResolver, HandLandmarker, FaceLandmarker } = await import(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs"
  );

  loadingStatusText.textContent = "Connecting CDN files...";
  const visionTasksResolver = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
  );

  loadingStatusText.textContent = "Compiling hand detector...";
  handLandmarkerInstance = await HandLandmarker.createFromOptions(visionTasksResolver, {
    baseOptions: {
      modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
      delegate: "GPU"
    },
    runningMode: "VIDEO",
    numHands: 2
  });

  loadingStatusText.textContent = "Compiling face detector...";
  faceLandmarkerInstance = await FaceLandmarker.createFromOptions(visionTasksResolver, {
    baseOptions: {
      modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
      delegate: "GPU"
    },
    runningMode: "VIDEO",
    numFaces: 1,
    outputFaceBlendshapes: false
  });

  loadingStatusText.textContent = "Connecting to webcam...";
  const cameraStream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480 },
    audio: false
  });
  videoElement.srcObject = cameraStream;
  await new Promise((resolve) => (videoElement.onloadedmetadata = resolve));
  videoElement.play();

  // Hide loading spinner and initiate animation loop
  loadingContainer.style.display = "none";
  requestAnimationFrame(runDetectionLoop);
}

// Launch the app
initializeApplication().catch((err) => {
  loadingStatusText.textContent = "Webcam error: " + err.message;
  console.error(err);
});
