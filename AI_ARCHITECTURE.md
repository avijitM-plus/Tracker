# NeuroTrack AI Architecture

This document explains how the AI assistant and insight generation currently work in the NeuroTrack application.

## Overview

Currently, the AI features in NeuroTrack are **simulated using rule-based keyword matching**. It behaves like a mock/dummy AI. There are no external LLM API calls (like OpenAI or Anthropic) or local ML models running in the background.

The AI system is split into two main components:
1. **The Interactive AI Chat Assistant** (Frontend UI + Backend Route)
2. **The Daily Insights Generator** (Backend Analysis)

---

## 1. Interactive AI Chat

### Frontend (`AIChat.tsx`)
The frontend provides a floating action button (the sparkle icon) that opens an animated side drawer containing the chat interface. 
- It maintains the chat history in local component state.
- When you type a message and send it, the frontend sends a `POST` request with your text to the backend at `http://127.0.0.1:8000/api/chat`.

### Backend (`api/routes.py`)
The backend route `/api/chat` intercepts the user's message, converts it to lowercase, and checks for specific keywords to return a pre-written response.

Here is the exact logic currently driving the AI Chat:
- **"productive"** or **"score"**: _"Your productivity score looks solid! You've spent a lot of time in VS Code today. Keep it up!"_
- **"distracted"** or **"youtube"**: _"I noticed some YouTube usage. Maybe try enabling Focus Mode if you need to lock in?"_
- **"timeline"** or **"today"**: _"You've been active for several hours today. Check the Timeline view to see your exact activity logs."_
- **"focus"**: _"Focus Mode blocks distracting websites using the NeuroTrack extension. Start a Pomodoro timer in the header to activate it!"_
- **"goal"** or **"streak"**: Explains how goals and streaks work.
- **Fallback**: If no keywords match, it echoes back what you said: _"I'm your NeuroTrack AI assistant. You said: '[Message]'. How can I help you optimize your workflow today?"_

---

## 2. Daily Insights Generation

### Backend (`ai/insights.py`)
There is a dedicated function `generate_insights(app_summary, web_summary)` that analyzes your daily tracked data to provide human-readable feedback on the Dashboard.

Similar to the chat, it uses basic logic to generate sentences:
- It calculates the app you used the most and generates a string like: _"You spent X hours using apps today, with [App Name] taking up the most time."_
- It looks specifically for "Visual Studio Code" or "Code" in your app history to give you a specific compliment.
- If there's no data, it outputs a generic _"Not enough data..."_ message.

## Future Implementation Notes

As noted in the source code comments (`insights.py`), this rule-based system is meant to be a placeholder for a true AI integration. 

To upgrade this to a real AI system, you would need to:
1. Install an LLM SDK (e.g., `openai` or `google-generativeai`).
2. Modify `/api/chat` to format the user's chat history into a prompt context, append live data (like the user's current tracked websites and apps), and stream the response back from the LLM API.
3. Modify `generate_insights` to pass the raw daily `app_summary` and `web_summary` JSON payloads to an LLM with a system prompt asking it to act as a productivity coach and return 3 concise bullet points.
