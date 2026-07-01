<div align="center">

# 🐱 MeowCam

### *Strike a pose. Meet your cat.*

**Real-time AI camera that detects your hand gestures & facial expressions — then responds with the perfectly matched cat meme.**

[![Live Demo](https://img.shields.io/badge/🚀_Live_Demo-Visit_Now-3b82f6?style=for-the-badge)](https://pratikshya32.github.io/cat-meme-cam/)
[![Made with JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://github.com/Pratikshya32/cat-meme-cam)
[![Powered by MediaPipe](https://img.shields.io/badge/MediaPipe-AI_Vision-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/edge/mediapipe/solutions/guide)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

---

> No installs. No backend. No server.  
> Just open your browser, show a gesture, and let the cats judge you. 🐾

</div>

---

## 📖 Table of Contents

- [About the Project](#-about-the-project)
- [Key Features](#-key-features)
- [Live Demo](#-live-demo)
- [How It Works](#-how-it-works)
- [Gesture & Expression Map](#-gesture--expression-map)
- [Custom Gesture Heuristics](#-custom-gesture-heuristics)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Contributing](#-contributing)
- [Author](#-author)

---

## 🌟 About the Project

**MeowCam** is a fully browser-based AI experience — no app download, no server, no configuration. It uses **Google MediaPipe** to run real-time computer vision directly in your browser, detecting your hand gestures and facial expressions through your webcam and instantly matching them to the most fitting cat meme.

Whether you flash a thumbs up, pull a peace sign, or just smile at the camera — a cat has something to say about it.

**Why I built this:**
- Explore real-world MediaPipe integration in a fun, engaging way
- Demonstrate that complex AI pipelines can run entirely client-side
- Because the internet always needs more cat memes 🐱

---

## ✨ Key Features

- **On-Device ML Inference**: Hand skeleton and facial landmark detection running fully in the browser via WebAssembly (WASM).
- **Temporal Gesture Smoothing**: Built-in sliding window queue filtering to eliminate coordinate noise and screen flickering.
- **Victory (Peace Sign) Classifier**: Advanced geometric distance checks classifying double-finger spreads.
- **📸 Save Collage**: Capture your webcam frame overlaid with your hand skeleton tracking lines and your matching cat meme in a single consolidated image download.

---

## 🚀 Live Demo

> **👉 [https://pratikshya32.github.io/cat-meme-cam/](https://pratikshya32.github.io/cat-meme-cam/)**

**Steps to use:**
1. Open the link in any modern browser (Chrome recommended)
2. Click **Allow** when asked for webcam permission
3. Wait 2–3 seconds for the AI models to load
4. Strike a gesture or expression from the table below
5. Watch your matching cat meme appear instantly 🐾
6. Click **Save Collage** to capture and download your pose with the cat!

---

## ⚙️ How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                        MeowCam Pipeline                     │
│                                                             │
│   📷 Webcam Feed                                            │
│        │                                                    │
│        ▼                                                    │
│   🧠 MediaPipe Vision Models (runs in browser via WASM)     │
│        │                                                    │
│        ├──► Hand Landmark Detection                         │
│        │         └──► Gesture Classification               │
│        │                                                    │
│        └──► Face Landmark Detection                         │
│                   └──► Expression Classification           │
│                                                             │
│        ▼                                                    │
│   🗂️ memes.js (gesture → meme URL mapping)                 │
│        │                                                    │
│        ▼                                                    │
│   🐱 Matching Cat Meme displayed in real-time              │
└─────────────────────────────────────────────────────────────┘
```

All processing happens **100% on-device** in the browser. No image or video data is ever sent to a server.

---

## 🎭 Gesture & Expression Map

| Input Trigger | Gesture | Cat Meme Response |
|---|---|---|
| 👍 Thumbs Up | Raise thumb upward | Crying thumbs-up cat |
| ✊ Fist | Closed fist | Fist bump cat GIF |
| 👌 OK Sign | Thumb & index finger circle | OK approval cat |
| 🙏 Namaste | Both palms pressed together | Peaceful Namaste cat |
| 🤫 Shh | Index finger to lips | "Quiet" shut up cat |
| ✌️ Peace | Two fingers raised | Peace & love cat |
| 😊 Smile | Natural smile at camera | Happy smiling kitten |
| 😛 Tongue Out | Stick tongue out | Silly derp cat |

> **Tip:** Hold each gesture steady for 1–2 seconds for the best detection accuracy.

---

## 🔍 Custom Gesture Heuristics

To avoid the performance costs of heavy deep learning classification networks running in-browser, this project utilizes **custom mathematical heuristics** calculated from the 21 hand landmarks:

- **Wrist-to-MCP Scaling**: To ensure distance thresholds remain scale-invariant (working the same whether your hand is close to the lens or far away), all distance offsets are dynamically scaled relative to the wrist-to-middle-knuckle distance:
  $$\text{Scale} = \text{Distance}(\text{Wrist}_0, \text{Middle Knuckle}_9)$$
- **Victory (Peace) Spread Check**: The classification verifies that the Index and Middle fingers are straight, the Ring and Pinky fingers are curled, and the tip separation exceeds a minimum coordinate ratio:
  $$\text{Distance}(\text{Index Tip}_8, \text{Middle Tip}_{12}) > 0.25 \times \text{Scale}$$

---

## 🛠️ Tech Stack

| Technology | Role | Why |
|---|---|---|
| **MediaPipe Tasks Vision** | AI hand & face landmark detection | Runs fully in-browser via WebAssembly — zero latency, zero server |
| **HTML5** | Structure & webcam integration | Native `getUserMedia` API for webcam access |
| **Vanilla CSS** | Responsive UI & styling | No framework needed — clean, fast, and structured |
| **JavaScript (ES6+)** | Real-time gesture logic & meme mapping | Lightweight, no build step required |

**No React. No Node. No dependencies to install.**  
This entire app ships as 5 static files.

---

## 📁 Project Structure

```
cat-meme-cam/
│
├── index.html        # App shell, webcam canvas, UI layout
├── style.css         # Styling, animations, responsive design
├── script.js         # MediaPipe integration, gesture detection logic
├── memes.js          # Gesture-to-meme URL mapping object
└── README.md         # You are here
```

---

## 🏁 Getting Started

### Option 1 — Use Live (Recommended)

Just visit **[https://pratikshya32.github.io/cat-meme-cam/](https://pratikshya32.github.io/cat-meme-cam/)** — nothing to install.

### Option 2 — Run Locally

```bash
# 1. Clone the repository
git clone https://github.com/Pratikshya32/cat-meme-cam.git

# 2. Navigate into the folder
cd cat-meme-cam

# 3. Serve locally (webcam requires a local server, not file://)
npx serve .
# OR
python -m http.server 8000
```

Then open **http://localhost:8000** (or the port shown) in your browser.

> ⚠️ **Important:** Webcam access requires either `localhost` or an `https://` URL. Opening `index.html` directly via `file://` will NOT work.

### Browser Compatibility

| Browser | Support |
|---|---|
| Chrome 88+ | ✅ Full Support |
| Edge 88+ | ✅ Full Support |
| Firefox | ⚠️ Partial (WebAssembly may vary) |
| Safari | ⚠️ Limited webcam API support |
| Mobile Chrome | ✅ Works on Android |

---

## 🤝 Contributing

Contributions, ideas, and cat meme suggestions are always welcome!

```bash
# 1. Fork the repository
# 2. Create your feature branch
git checkout -b feature/add-new-gesture

# 3. Add your changes
# 4. Commit with a clear message
git commit -m "feat: add surprised face expression mapping"

# 5. Push and open a Pull Request
git push origin feature/add-new-gesture
```

---

## 👩‍💻 Author

<div align="center">

**Pratikshya Sahoo**

[![GitHub](https://img.shields.io/badge/GitHub-Pratikshya32-181717?style=flat-square&logo=github)](https://github.com/Pratikshya32)
[![Deloitte Certified](https://img.shields.io/badge/Deloitte-Technology_Job_Simulation-86BC25?style=flat-square&logo=deloitte&logoColor=white)](https://github.com/Pratikshya32)

*Deloitte Technology Job Simulation · June 2026*

</div>

---

<div align="center">

**If MeowCam made you smile, drop a ⭐ on the repo — it helps a lot!**

Made with 💜 and a lot of cat memes · © 2026 Pratikshya Sahoo

</div>
