// Gesture mapping
const memeMapping = {
  thumbsup: { img: MEMES.thumbsup, label: "👍 Thumbs Up Cat" },
  fist: { img: MEMES.fistcat, label: "✊ Fist Cat" },
  oksign: { img: MEMES.oksign, label: "👌 OK Cat" },
  namaste: { img: MEMES.namaste, label: "🙏 Namaste Cat" },
  shutup: { img: MEMES.shutup, label: "🤫 Shh Cat" },
  victory: { img: MEMES.love, label: "✌️ Peace/Love Cat" },
  smile: { img: MEMES.smile, label: "😊 Smiling Cat" },
  tongue: { img: MEMES.tongue, label: "😛 Tongue Cat" },
};

// DOM references
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

// Inactivity and smoothing state
let currentGesture = null;
let lastGestureDetectedTime = 0;
const GESTURE_INACTIVITY_TIMEOUT_MS = 700;

const gestureHistoryBuffer = [];
const SMOOTHING_BUFFER_SIZE = 5;
const SMOOTHING_MATCH_THRESHOLD = 3;

// UI render handlers
function renderActiveMeme(gestureKey) {
  const memeData = memeMapping[gestureKey];
  if (!memeData) return;

  memeImageElement.src = memeData.img;
  memeImageElement.style.display = "block";
  memeLabelElement.textContent = memeData.label;
  noMemePlaceholder.style.display = "none";

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

// Coordinate math helpers
function calculateEuclideanDistance(pointA, pointB) {
  return Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y);
}

function checkFingerIsExtended(landmarks, tipIndex, mcpIndex) {
  return landmarks[tipIndex].y < landmarks[mcpIndex].y - 0.02;
}

function checkFingerIsCurled(landmarks, tipIndex, mcpIndex) {
  return landmarks[tipIndex].y > landmarks[mcpIndex].y;
}

// Hand gesture classification heuristics
function identifyHandGesture(landmarks) {
  const handSize = calculateEuclideanDistance(landmarks[0], landmarks[9]);

  const isIndexExtended = checkFingerIsExtended(landmarks, 8, 5);
  const isMiddleExtended = checkFingerIsExtended(landmarks, 12, 9);
  const isRingExtended = checkFingerIsExtended(landmarks, 16, 13);
  const isPinkyExtended = checkFingerIsExtended(landmarks, 20, 17);

  const isIndexCurled = checkFingerIsCurled(landmarks, 8, 5);
  const isMiddleCurled = checkFingerIsCurled(landmarks, 12, 9);
  const isRingCurled = checkFingerIsCurled(landmarks, 16, 13);
  const isPinkyCurled = checkFingerIsCurled(landmarks, 20, 17);

  const isThumbUp = landmarks[4].y < landmarks[0].y - handSize * 0.3;
  const isThumbExtended = calculateEuclideanDistance(landmarks[4], landmarks[2]) > handSize * 0.4;

  debugPanel.textContent =
    `Idx:${isIndexExtended ? "Ext" : isIndexCurled ? "Crl" : "-"} ` +
    `Mid:${isMiddleExtended ? "Ext" : isMiddleCurled ? "Crl" : "-"} ` +
    `Rng:${isRingExtended ? "Ext" : isRingCurled ? "Crl" : "-"} ` +
    `Pky:${isPinkyExtended ? "Ext" : isPinkyCurled ? "Crl" : "-"} ` +
    `Thb:${isThumbUp ? "UP" : isThumbExtended ? "Ext" : "-"}`;

  // Peace sign check
  const distanceIndexToMiddle = calculateEuclideanDistance(landmarks[8], landmarks[12]);
  const isPeaceSpread = distanceIndexToMiddle > handSize * 0.25;
  if (isIndexExtended && isMiddleExtended && isRingCurled && isPinkyCurled && isPeaceSpread) {
    return "victory";
  }

  // Fist and Thumbs Up check
  if (isIndexCurled && isMiddleCurled && isRingCurled && isPinkyCurled) {
    if (isThumbUp) return "thumbsup";
    return "fist";
  }

  // OK Sign check
  const pinchDistance = calculateEuclideanDistance(landmarks[4], landmarks[8]);
  if (pinchDistance < handSize * 0.4 && isMiddleExtended && isRingExtended && isPinkyExtended) {
    return "oksign";
  }

  // Shh / index only check
  if (isIndexExtended && isMiddleCurled && isRingCurled && isPinkyCurled) {
    return "shutup";
  }

  // Namaste check
  if (isIndexExtended && isMiddleExtended && isRingExtended && isPinkyExtended) {
    const totalSpread = calculateEuclideanDistance(landmarks[8], landmarks[20]);
    if (totalSpread / handSize < 0.65) return "namaste";
  }

  return null;
}

// Facial expression classification heuristics
function identifyFacialExpression(landmarks) {
  const faceWidth = calculateEuclideanDistance(landmarks[234], landmarks[454]);
  const mouthOpeningGap = calculateEuclideanDistance(landmarks[13], landmarks[14]) / faceWidth;
  const lipVerticalStretch = calculateEuclideanDistance(landmarks[0], landmarks[17]) / faceWidth;

  // Tongue out check
  if (mouthOpeningGap > 0.06 && lipVerticalStretch > 0.14) {
    return "tongue";
  }

  // Smile check
  const smileRatio = calculateEuclideanDistance(landmarks[61], landmarks[291]) / faceWidth;
  if (smileRatio > 0.46) {
    return "smile";
  }

  return null;
}

// Frame tracking references
let handLandmarkerInstance, faceLandmarkerInstance, lastProcessedVideoTime = -1;

// Frame processing loop
async function runDetectionLoop() {
  if (videoElement.readyState < 2) {
    requestAnimationFrame(runDetectionLoop);
    return;
  }
  const currentTime = performance.now();
  let frameDetection = null;

  if (videoElement.currentTime !== lastProcessedVideoTime) {
    lastProcessedVideoTime = videoElement.currentTime;

    overlayCanvas.width = videoElement.videoWidth || 640;
    overlayCanvas.height = videoElement.videoHeight || 480;
    canvasContext.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

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

    if (!frameDetection) {
      const faceResult = faceLandmarkerInstance.detectForVideo(videoElement, currentTime);
      if (faceResult.faceLandmarks && faceResult.faceLandmarks.length > 0) {
        frameDetection = identifyFacialExpression(faceResult.faceLandmarks[0]);
      }
    }
  }

  // Filter history buffer for smoothing
  gestureHistoryBuffer.push(frameDetection);
  if (gestureHistoryBuffer.length > SMOOTHING_BUFFER_SIZE) {
    gestureHistoryBuffer.shift();
  }

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

// Hand connections map
const PALM_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

// Skeleton renderer
function renderHandSkeleton(landmarks) {
  const width = overlayCanvas.width;
  const height = overlayCanvas.height;

  canvasContext.strokeStyle = "#3b82f6";
  canvasContext.lineWidth = 3;
  canvasContext.fillStyle = "#60a5fa";

  for (const [startNode, endNode] of PALM_CONNECTIONS) {
    canvasContext.beginPath();
    canvasContext.moveTo(landmarks[startNode].x * width, landmarks[startNode].y * height);
    canvasContext.lineTo(landmarks[endNode].x * width, landmarks[endNode].y * height);
    canvasContext.stroke();
  }

  for (const joint of landmarks) {
    canvasContext.beginPath();
    canvasContext.arc(joint.x * width, joint.y * height, 5, 0, Math.PI * 2);
    canvasContext.fill();
  }
}

// Collage canvas builder
async function saveMemeCollage() {
  if (!currentGesture) {
    alert("Please strike a pose to load a cat meme before saving!");
    return;
  }

  const collageCanvas = document.createElement("canvas");
  const gap = 15;
  const border = 10;
  const textSpace = 50;
  
  const paneWidth = 400;
  const paneHeight = 300;
  
  collageCanvas.width = paneWidth * 2 + gap + border * 2;
  collageCanvas.height = paneHeight + border * 2 + textSpace;
  
  const ctx = collageCanvas.getContext("2d");
  
  ctx.fillStyle = "#0d0d0d";
  ctx.fillRect(0, 0, collageCanvas.width, collageCanvas.height);
  
  ctx.save();
  ctx.translate(border + paneWidth, border);
  ctx.scale(-1, 1);
  ctx.drawImage(videoElement, 0, 0, paneWidth, paneHeight);
  ctx.restore();
  
  if (gestureHistoryBuffer[gestureHistoryBuffer.length - 1]) {
    ctx.drawImage(overlayCanvas, border, border, paneWidth, paneHeight);
  }
  
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(border + paneWidth + gap, border, paneWidth, paneHeight);
  ctx.drawImage(memeImageElement, border + paneWidth + gap, border, paneWidth, paneHeight);
  
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 16px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("MeowCam Collage", collageCanvas.width / 2, collageCanvas.height - 30);
  
  ctx.fillStyle = "#3b82f6";
  ctx.font = "14px sans-serif";
  ctx.fillText(`Triggered: ${memeMapping[currentGesture].label}`, collageCanvas.width / 2, collageCanvas.height - 12);
  
  const dataURL = collageCanvas.toDataURL("image/png");
  const downloadLink = document.createElement("a");
  downloadLink.download = `meowcam-collage-${Date.now()}.png`;
  downloadLink.href = dataURL;
  downloadLink.click();
}

screenshotButton.addEventListener("click", saveMemeCollage);

// Initialize MediaPipe vision instances
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

  loadingContainer.style.display = "none";
  requestAnimationFrame(runDetectionLoop);
}

initializeApplication().catch((err) => {
  loadingStatusText.textContent = "Webcam error: " + err.message;
  console.error(err);
});
