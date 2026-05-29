# NeuroTrack 🧠⚡️

NeuroTrack is the ultimate AI-powered productivity operating system designed for power users. It goes beyond simple time-tracking to measure your actual *intensity* (APM), smartly categorize your activities, and enforce deep-work sessions using Focus Mode.

## Features

- **Visual DVR Timeline**: Automatically captures screenshots (saved locally) every 60 seconds so you can visually rewind your day.
- **APM Telemetry (Actions Per Minute)**: Tracks your keystrokes and mouse clicks locally to measure your "Intensity Gauge" and distinguish between reading and active working.
- **Smart Categorization Engine**: NLP-based keyword matching analyzes your window titles (e.g. "React Documentation" vs "Twitter") to calculate a dynamic Productivity Score.
- **Immersive Zen Mode**: Activate the Pomodoro timer, and your dashboard fades into a distraction-free flow-state environment complete with ambient soundscapes.
- **Deep Work Blocker**: The browser extension syncs with your Focus Mode. If you try to open a distracting site while the timer is running, the tab is instantly closed.
- **Data Liberation**: 100% of your data belongs to you. Export your entire timeline to CSV with the click of a button.

---

## 🚀 Quick Start Guide

### Prerequisites
- Python 3.10+
- Node.js & npm

### 1. Start the Backend (API + Tracking Engine)
The Python backend handles the SQLite database, APM listening, Screenshot capture, and WebSocket broadcasting.

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python main.py
```
> The backend runs on `http://127.0.0.1:8000`

### 2. Start the Frontend (React + Vite + Electron)
The frontend is a beautiful desktop application powered by React, Tailwind CSS, Framer Motion, Recharts, and Zustand.

```bash
cd frontend
npm install
npm run electron:dev
```

### 3. Install the Browser Extension
To track website usage and enforce the Focus Mode blocker, install the included browser extension.

#### Google Chrome / Edge
1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** in the top right corner.
3. Click **Load unpacked** and select the `Tracker/extension/` folder.

#### Mozilla Firefox
1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on...**
3. Select the `manifest-firefox.json` file inside the `Tracker/extension/` folder.

---

## 🧠 Architecture Overview

NeuroTrack is built with privacy and speed in mind.

- **Data Privacy**: All SQLite databases (`neurotrack.db`) and DVR Screenshots (`/data/screenshots`) are saved entirely locally on your hard drive. We **DO NOT** use cloud syncing. APM tracking only counts keystrokes, it never logs raw keys.
- **Electron Shell**: Runs Vite in development, providing a seamless windowless desktop experience.
- **FastAPI Backend**: Runs a multi-threaded architecture to ensure `pynput` (for APM) and `mss` (for screenshots) never block the WebSocket event loop.

## 🛠 Troubleshooting

- **Blank UI / Websocket Errors**: Ensure the Python backend is running first *before* starting the Electron frontend.
- **Screenshots not appearing**: Ensure your Python environment has access to screen recording permissions if you are on a restricted corporate machine. (Windows usually allows this by default).
- **Extension Not Tracking**: Make sure the backend is running on `127.0.0.1:8000`. If it runs on `localhost`, the extension might fail to fetch due to loopback resolution rules on some OS environments.

Enjoy your newfound productivity! ⚡️
