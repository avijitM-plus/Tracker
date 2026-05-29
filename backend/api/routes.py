from fastapi import APIRouter, Depends, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from database.database import get_db
from database.models import AppUsage, WebsiteUsage, IdleSession, DailyGoal, DailySummary, FocusSessionRecord, Settings
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta, date
from types import SimpleNamespace
from ai.insights import generate_insights
import os, json
import psutil
from collections import defaultdict
from urllib.parse import urlparse

router = APIRouter()

# ──────────────────────────────────────────────
# HELPERS: Settings & Categorization
# ──────────────────────────────────────────────

DEFAULT_SETTINGS = {
    "productive_keywords": "code,terminal,obsidian,github,docs,figma,notion,chatgpt,vscode,cursor,intellij,pycharm,webstorm,sublime,vim,neovim,postman,jira,confluence,linear,gitlab,bitbucket,stackoverflow,devdocs",
    "distracting_keywords": "youtube,twitter,reddit,facebook,instagram,tiktok,netflix,discord,twitch,9gag,imgur,buzzfeed,snapchat,pinterest",
    "learning_keywords": "udemy,coursera,edx,pluralsight,skillshare,leetcode,hackerrank,medium,dev.to,freecodecamp,khan,wikipedia,arxiv",
    "communication_keywords": "slack,teams,zoom,meet,outlook,gmail,thunderbird,telegram,whatsapp,signal,skype,webex",
    "blocked_domains": "youtube.com,twitter.com,x.com,reddit.com,facebook.com,instagram.com",
    "idle_timeout": "60",
    "screenshot_interval": "60",
    "enable_screenshots": "true"
}

def get_setting(db: Session, key: str) -> str:
    row = db.query(Settings).filter(Settings.key == key).first()
    if row:
        return row.value
    return DEFAULT_SETTINGS.get(key, "")

def get_keywords(db: Session, key: str) -> list:
    raw = get_setting(db, key)
    return [k.strip().lower() for k in raw.split(",") if k.strip()]

def categorize_name(name_lower: str, db: Session):
    """Returns one of: Work, Learning, Communication, Entertainment, Other"""
    productive = get_keywords(db, "productive_keywords")
    distracting = get_keywords(db, "distracting_keywords")
    learning = get_keywords(db, "learning_keywords")
    communication = get_keywords(db, "communication_keywords")
    
    if any(kw in name_lower for kw in productive):
        return "Work"
    if any(kw in name_lower for kw in learning):
        return "Learning"
    if any(kw in name_lower for kw in communication):
        return "Communication"
    if any(kw in name_lower for kw in distracting):
        return "Entertainment"
    return "Other"

# ──────────────────────────────────────────────
# BROWSER TRACKING
# ──────────────────────────────────────────────

class BrowserData(BaseModel):
    domain: str
    title: str
    url: Optional[str] = ""
    browser: Optional[str] = "Chrome"

current_website_state = {
    "domain": None, "url": None, "title": None,
    "browser": None, "start_timestamp": None,
    "last_received_at": None
}

BROWSER_PROCESSES = {
    "chrome.exe": {"name": "Chrome", "family": "chromium", "install_file": "manifest.json"},
    "msedge.exe": {"name": "Microsoft Edge", "family": "chromium", "install_file": "manifest.json"},
    "brave.exe": {"name": "Brave", "family": "chromium", "install_file": "manifest.json"},
    "bravebrowser.exe": {"name": "Brave", "family": "chromium", "install_file": "manifest.json"},
    "opera.exe": {"name": "Opera", "family": "chromium", "install_file": "manifest.json"},
    "opera_gx.exe": {"name": "Opera GX", "family": "chromium", "install_file": "manifest.json"},
    "firefox.exe": {"name": "Firefox", "family": "firefox", "install_file": "manifest-firefox.json"},
}

def detect_running_browsers():
    found = {}
    try:
        for proc in psutil.process_iter(["name"]):
            proc_name = (proc.info.get("name") or "").lower()
            if proc_name in BROWSER_PROCESSES:
                browser = BROWSER_PROCESSES[proc_name]
                found[browser["name"]] = browser
    except Exception:
        return []
    return list(found.values())

def classify_shortform_url(url: Optional[str], title: Optional[str] = "") -> Optional[str]:
    """Detect high-dopamine short-form feeds from tracked browser URLs."""
    if not url:
        return None
    try:
        parsed = urlparse(url)
    except Exception:
        return None

    domain = (parsed.hostname or "").lower()
    path = (parsed.path or "").lower()
    query = (parsed.query or "").lower()
    text = f"{url} {title or ''}".lower()

    if ("youtube.com" in domain or "m.youtube.com" in domain) and "/shorts" in path:
        return "YouTube Shorts"
    if "facebook.com" in domain and ("/reel" in path or "/reels" in path or "reel" in query):
        return "Facebook Reels"
    if "fb.watch" in domain and "reel" in text:
        return "Facebook Reels"
    return None

@router.post("/api/track/browser")
def track_browser(data: BrowserData, db: Session = Depends(get_db)):
    now = datetime.utcnow()
    is_same_session = (
        current_website_state["domain"] == data.domain and
        (current_website_state["url"] or "") == (data.url or "") and
        (current_website_state["browser"] or "Chrome") == (data.browser or "Chrome")
    )

    if is_same_session:
        current_website_state["title"] = data.title
        current_website_state["last_received_at"] = now
        return {"status": "ok", "mode": "heartbeat"}

    close_current_website_session(db, now)
    current_website_state["domain"] = data.domain
    current_website_state["url"] = data.url
    current_website_state["title"] = data.title
    current_website_state["browser"] = data.browser
    current_website_state["start_timestamp"] = now
    current_website_state["last_received_at"] = now
    return {"status": "ok"}

def close_current_website_session(db: Session, end_time: datetime):
    if not current_website_state["domain"] or not current_website_state["start_timestamp"]:
        return
    last_received = current_website_state.get("last_received_at")
    final_end = end_time
    if last_received and (end_time - last_received).total_seconds() > 120:
        final_end = last_received
    duration = (final_end - current_website_state["start_timestamp"]).total_seconds()
    if duration <= 0:
        return
    usage = WebsiteUsage(
        domain=current_website_state["domain"],
        url=current_website_state["url"] or "",
        page_title=current_website_state["title"],
        browser_name=current_website_state["browser"] or "Chrome",
        start_timestamp=current_website_state["start_timestamp"],
        end_timestamp=final_end,
        duration_seconds=duration
    )
    db.add(usage)
    db.commit()

def get_website_usage_window(db: Session, start: datetime, end: Optional[datetime] = None, include_active: bool = True):
    end = end or datetime.utcnow()
    usage = db.query(WebsiteUsage).filter(
        WebsiteUsage.start_timestamp >= start,
        WebsiteUsage.start_timestamp < end
    ).all()

    if not include_active:
        return usage

    active_start = current_website_state.get("start_timestamp")
    last_received = current_website_state.get("last_received_at")
    now = datetime.utcnow()
    active_end = now if last_received and (now - last_received).total_seconds() <= 120 else (last_received or now)
    if current_website_state.get("domain") and active_start:
        clipped_start = max(active_start, start)
        clipped_end = min(active_end, end)
        duration = (clipped_end - clipped_start).total_seconds()
        if duration > 0:
            usage.append(SimpleNamespace(
                id=None,
                domain=current_website_state.get("domain"),
                url=current_website_state.get("url") or "",
                page_title=current_website_state.get("title"),
                browser_name=current_website_state.get("browser") or "Chrome",
                start_timestamp=clipped_start,
                end_timestamp=clipped_end,
                duration_seconds=duration,
                is_active=True,
            ))
    return usage

@router.get("/api/browser-extension/status")
def get_browser_extension_status():
    now = datetime.utcnow()
    running_browsers = detect_running_browsers()
    last_received = current_website_state.get("last_received_at")
    seconds_since_telemetry = (now - last_received).total_seconds() if last_received else None
    telemetry_recent = seconds_since_telemetry is not None and seconds_since_telemetry <= 120
    active_browser = current_website_state.get("browser")

    primary = None
    if active_browser:
        primary = next((b for b in running_browsers if b["name"].lower() == str(active_browser).lower()), None)
    if primary is None and running_browsers:
        primary = running_browsers[0]

    browser_running = len(running_browsers) > 0
    needs_install = browser_running and not telemetry_recent

    if primary and primary["family"] == "firefox":
        install_steps = [
            "Open Firefox and go to about:debugging#/runtime/this-firefox.",
            "Click Load Temporary Add-on.",
            "Select D:\\Tracker\\extension\\manifest-firefox.json, not manifest.json.",
        ]
        install_url = "about:debugging#/runtime/this-firefox"
    else:
        browser_name = primary["name"] if primary else "Chrome or Edge"
        install_steps = [
            f"Open {browser_name} extensions.",
            "Enable Developer mode.",
            "Click Load unpacked and select D:\\Tracker\\extension.",
        ]
        install_url = "chrome://extensions/"

    return {
        "browser_running": browser_running,
        "telemetry_recent": telemetry_recent,
        "needs_install": needs_install,
        "active_browser": active_browser,
        "primary_browser": primary["name"] if primary else None,
        "browser_family": primary["family"] if primary else None,
        "running_browsers": [b["name"] for b in running_browsers],
        "seconds_since_telemetry": round(seconds_since_telemetry) if seconds_since_telemetry is not None else None,
        "install_url": install_url,
        "install_path": "D:\\Tracker\\extension",
        "install_file": primary["install_file"] if primary else "manifest.json",
        "install_steps": install_steps,
        "message": (
            f"Install the NeuroTrack extension for {primary['name']} to enable website tracking and blocking."
            if needs_install and primary else
            "Browser extension telemetry is active." if telemetry_recent else
            "No supported browser is currently running."
        )
    }

# ──────────────────────────────────────────────
# TODAY REPORT (with categories)
# ──────────────────────────────────────────────

@router.get("/api/reports/today")
def get_today_report(db: Session = Depends(get_db)):
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    app_usage = db.query(AppUsage).filter(AppUsage.start_timestamp >= today).all()
    website_usage = get_website_usage_window(db, today)

    app_summary = {}
    for u in app_usage:
        app_summary[u.app_name] = app_summary.get(u.app_name, 0) + u.duration_seconds
    web_summary = {}
    for u in website_usage:
        web_summary[u.domain] = web_summary.get(u.domain, 0) + u.duration_seconds

    app_summary = dict(sorted(app_summary.items(), key=lambda x: x[1], reverse=True))
    web_summary = dict(sorted(web_summary.items(), key=lambda x: x[1], reverse=True))

    ai_insights = generate_insights(app_summary, web_summary)

    # Category breakdown + hourly breakdown
    categories = {"Work": 0, "Learning": 0, "Communication": 0, "Entertainment": 0, "Other": 0}
    productive_time = 0
    distracting_time = 0
    total_time = 0
    hourly = [0.0] * 24

    for u in app_usage:
        cat = categorize_name(u.app_name.lower(), db)
        categories[cat] += u.duration_seconds
        total_time += u.duration_seconds
        if cat == "Work":
            productive_time += u.duration_seconds
        elif cat == "Entertainment":
            distracting_time += u.duration_seconds
        if u.start_timestamp:
            hourly[u.start_timestamp.hour] += u.duration_seconds / 60

    for u in website_usage:
        cat = categorize_name(u.domain.lower(), db)
        categories[cat] += u.duration_seconds
        total_time += u.duration_seconds
        if cat in ("Work", "Learning"):
            productive_time += u.duration_seconds
        elif cat == "Entertainment":
            distracting_time += u.duration_seconds
        if u.start_timestamp:
            hourly[u.start_timestamp.hour] += u.duration_seconds / 60

    score = 50
    if total_time > 0:
        ratio = (productive_time - distracting_time * 1.5) / total_time
        score = int(max(0, min(100, (ratio + 0.5) * 100)))

    # Most productive hour
    most_productive_hour = max(range(24), key=lambda h: hourly[h]) if max(hourly) > 0 else -1

    return {
        "apps": app_summary,
        "websites": web_summary,
        "categories": categories,
        "insights": ai_insights,
        "productivity_score": score,
        "total_seconds": total_time,
        "productive_seconds": productive_time,
        "distracting_seconds": distracting_time,
        "hourly": [round(h, 1) for h in hourly],
        "most_productive_hour": most_productive_hour
    }

@router.get("/api/reports/yesterday")
def get_yesterday_report(db: Session = Depends(get_db)):
    now = datetime.utcnow()
    yesterday_start = (now - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_end = yesterday_start + timedelta(days=1)
    
    apps = db.query(AppUsage).filter(
        AppUsage.start_timestamp >= yesterday_start,
        AppUsage.start_timestamp < yesterday_end
    ).all()
    websites = get_website_usage_window(db, yesterday_start, yesterday_end)
    
    productive = 0
    distracting = 0
    total = 0
    for a in apps:
        total += a.duration_seconds
        cat = categorize_name(a.app_name.lower(), db)
        if cat == "Work": productive += a.duration_seconds
        elif cat == "Entertainment": distracting += a.duration_seconds
    for w in websites:
        total += w.duration_seconds
        cat = categorize_name(w.domain.lower(), db)
        if cat in ("Work", "Learning"): productive += w.duration_seconds
        elif cat == "Entertainment": distracting += w.duration_seconds
    
    score = 50
    if total > 0:
        ratio = (productive - distracting * 1.5) / total
        score = int(max(0, min(100, (ratio + 0.5) * 100)))
    
    return {
        "productivity_score": score,
        "total_seconds": total,
        "productive_seconds": productive,
        "distracting_seconds": distracting
    }

@router.get("/api/coach/today")
def get_today_coach(db: Session = Depends(get_db)):
    """Local-first coaching layer that turns raw activity into a next action."""
    now = datetime.utcnow()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    last_hour = now - timedelta(hours=1)
    last_90 = now - timedelta(minutes=90)
    last_2h = now - timedelta(hours=2)

    app_usage = db.query(AppUsage).filter(AppUsage.start_timestamp >= today).all()
    website_usage = get_website_usage_window(db, today)

    events = []
    for usage in app_usage:
        name = usage.app_name or "Unknown"
        category = categorize_name(name.lower(), db)
        events.append({
            "name": name,
            "kind": "app",
            "category": category,
            "start": usage.start_timestamp,
            "duration": usage.duration_seconds or 0
        })

    for usage in website_usage:
        name = usage.domain or "Unknown"
        category = categorize_name(name.lower(), db)
        events.append({
            "name": name,
            "kind": "website",
            "category": category,
            "start": usage.start_timestamp,
            "duration": usage.duration_seconds or 0
        })

    events = [event for event in events if event["start"] is not None]
    events.sort(key=lambda event: event["start"])

    totals = {
        "Work": 0.0,
        "Learning": 0.0,
        "Communication": 0.0,
        "Entertainment": 0.0,
        "Other": 0.0,
    }
    top_focus = {}
    top_distractions = {}
    hourly_productive = [0.0] * 24

    for event in events:
        duration = event["duration"]
        category = event["category"]
        totals[category] = totals.get(category, 0.0) + duration

        if category in ("Work", "Learning"):
            top_focus[event["name"]] = top_focus.get(event["name"], 0.0) + duration
            hourly_productive[event["start"].hour] += duration / 60
        elif category == "Entertainment":
            top_distractions[event["name"]] = top_distractions.get(event["name"], 0.0) + duration

    total_seconds = sum(totals.values())
    productive_seconds = totals["Work"] + totals["Learning"]
    distracting_seconds = totals["Entertainment"]
    communication_seconds = totals["Communication"]

    productivity_score = 50
    if total_seconds > 0:
        ratio = (productive_seconds - distracting_seconds * 1.5) / total_seconds
        productivity_score = int(max(0, min(100, (ratio + 0.5) * 100)))

    recent_events = [event for event in events if event["start"] >= last_90]
    recent_productive = sum(event["duration"] for event in recent_events if event["category"] in ("Work", "Learning"))
    recent_distracting = sum(event["duration"] for event in recent_events if event["category"] == "Entertainment")
    active_2h = sum(event["duration"] for event in events if event["start"] >= last_2h)
    context_switches_last_hour = sum(1 for event in events if event["start"] >= last_hour)

    idle_sessions = db.query(IdleSession).filter(IdleSession.start_timestamp >= today).all()
    idle_2h = sum((idle.duration_seconds or 0) for idle in idle_sessions if idle.start_timestamp and idle.start_timestamp >= last_2h)
    last_idle = max(
        [idle for idle in idle_sessions if idle.end_timestamp is not None],
        key=lambda idle: idle.end_timestamp,
        default=None
    )
    minutes_since_break = None
    if last_idle and last_idle.end_timestamp:
        minutes_since_break = max(0, round((now - last_idle.end_timestamp).total_seconds() / 60))

    longest_focus_block = 0.0
    current_block = 0.0
    last_focus_end = None
    for event in events:
        if event["category"] in ("Work", "Learning"):
            event_end = event["start"] + timedelta(seconds=event["duration"])
            if last_focus_end and (event["start"] - last_focus_end).total_seconds() <= 5 * 60:
                current_block += event["duration"]
            else:
                current_block = event["duration"]
            longest_focus_block = max(longest_focus_block, current_block)
            last_focus_end = event_end
        elif event["category"] == "Entertainment":
            current_block = 0.0
            last_focus_end = None

    goals = db.query(DailyGoal).filter(DailyGoal.is_active == True).all()
    primary_goal = goals[0] if goals else None
    goal_progress = None
    if primary_goal and primary_goal.target_minutes:
        current_minutes = productive_seconds / 60
        goal_progress = {
            "target_minutes": primary_goal.target_minutes,
            "current_minutes": round(current_minutes, 1),
            "percent": min(100, round((current_minutes / primary_goal.target_minutes) * 100))
        }

    top_distractions_list = [
        {"name": name, "minutes": round(seconds / 60, 1)}
        for name, seconds in sorted(top_distractions.items(), key=lambda item: item[1], reverse=True)[:3]
    ]
    top_focus_list = [
        {"name": name, "minutes": round(seconds / 60, 1)}
        for name, seconds in sorted(top_focus.items(), key=lambda item: item[1], reverse=True)[:3]
    ]

    historical_hourly = [0.0] * 24
    week_start = today - timedelta(days=7)
    historical_apps = db.query(AppUsage).filter(
        AppUsage.start_timestamp >= week_start,
        AppUsage.start_timestamp < today
    ).all()
    historical_websites = get_website_usage_window(db, week_start, today, include_active=False)
    for usage in historical_apps:
        if usage.start_timestamp and categorize_name((usage.app_name or "").lower(), db) == "Work":
            historical_hourly[usage.start_timestamp.hour] += (usage.duration_seconds or 0) / 60
    for usage in historical_websites:
        if usage.start_timestamp and categorize_name((usage.domain or "").lower(), db) in ("Work", "Learning"):
            historical_hourly[usage.start_timestamp.hour] += (usage.duration_seconds or 0) / 60

    hour_source = hourly_productive if max(hourly_productive) > 0 else historical_hourly
    best_hours = [
        hour for hour, minutes in sorted(enumerate(hour_source), key=lambda item: item[1], reverse=True)
        if minutes > 0
    ][:3]
    if not best_hours:
        best_hours = [9, 10, 14]

    risk_flags = []
    if recent_distracting >= 15 * 60:
        risk_flags.append({
            "label": "Distraction drift",
            "level": "high",
            "detail": f"{round(recent_distracting / 60)} minutes of entertainment in the last 90 minutes"
        })
    if context_switches_last_hour >= 18:
        risk_flags.append({
            "label": "Context switching",
            "level": "medium",
            "detail": f"{context_switches_last_hour} app or site switches in the last hour"
        })
    if active_2h >= 100 * 60 and idle_2h < 5 * 60:
        risk_flags.append({
            "label": "Recovery debt",
            "level": "medium",
            "detail": "Almost two active hours with very little idle time"
        })
    if communication_seconds > productive_seconds and total_seconds > 30 * 60:
        risk_flags.append({
            "label": "Reactive day",
            "level": "medium",
            "detail": "Communication is outrunning focused work"
        })

    if recent_distracting >= 15 * 60:
        mode = "Focus Rescue"
        duration = 25
        title = "Lock the next 25 minutes behind Focus Mode"
        rationale = "Recent entertainment time is high enough that blocking will help more than another chart."
        actions = [
            "Start Focus Mode",
            "Write one concrete finish line for this sprint",
            "Keep only the work app and one reference tab open"
        ]
    elif active_2h >= 100 * 60 and idle_2h < 5 * 60:
        mode = "Recovery Reset"
        duration = 10
        title = "Take a real reset before the next push"
        rationale = "Sustained activity without a meaningful break usually turns into slower work."
        actions = [
            "Step away for 10 minutes",
            "Drink water and move",
            "Return with a 35 minute sprint"
        ]
    elif recent_productive >= 45 * 60 and context_switches_last_hour < 14:
        mode = "Deepen"
        duration = 50
        title = "You have momentum. Extend the current thread."
        rationale = "Your recent work is productive and relatively stable, so a longer session is worth it."
        actions = [
            "Start a 50 minute focus block",
            "Batch messages until the block ends",
            "Stop when one visible artifact is improved"
        ]
    elif total_seconds < 30 * 60:
        mode = "Momentum Boot"
        duration = 25
        title = "Create the first clean win of the day"
        rationale = "There is not much tracked signal yet, so the best move is a short intentional start."
        actions = [
            "Pick the smallest valuable task",
            "Start Focus Mode for 25 minutes",
            "Avoid measuring until the sprint is done"
        ]
    else:
        mode = "Precision Sprint"
        duration = 35
        title = "Use a compact sprint to raise the score"
        rationale = "The day is mixed; a focused block is enough to tilt the trend without overcommitting."
        actions = [
            "Choose one task that advances the day",
            "Silence communication during the sprint",
            "Review the timeline afterward"
        ]

    blockers = [item["name"] for item in top_distractions_list] or _get_blocked_domains(db)[:3]

    return {
        "mode": mode,
        "title": title,
        "duration_minutes": duration,
        "rationale": rationale,
        "actions": actions,
        "blockers": blockers,
        "risk_flags": risk_flags,
        "top_focus": top_focus_list,
        "top_distractions": top_distractions_list,
        "best_hours": best_hours,
        "metrics": {
            "productivity_score": productivity_score,
            "productive_minutes": round(productive_seconds / 60, 1),
            "distracting_minutes": round(distracting_seconds / 60, 1),
            "recent_productive_minutes": round(recent_productive / 60, 1),
            "recent_distracting_minutes": round(recent_distracting / 60, 1),
            "context_switches_last_hour": context_switches_last_hour,
            "longest_focus_block_minutes": round(longest_focus_block / 60, 1),
            "minutes_since_break": minutes_since_break
        },
        "goal": goal_progress
    }

# ──────────────────────────────────────────────
# WEEKLY / HISTORICAL ANALYTICS
# ──────────────────────────────────────────────

@router.get("/api/reports/weekly")
def get_weekly_report(db: Session = Depends(get_db)):
    days = []
    now = datetime.utcnow()
    
    for i in range(6, -1, -1):  # last 7 days, oldest first
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        
        apps = db.query(AppUsage).filter(
            AppUsage.start_timestamp >= day_start,
            AppUsage.start_timestamp < day_end
        ).all()
        websites = get_website_usage_window(db, day_start, day_end)

        productive = 0
        distracting = 0
        total = 0
        hourly = [0] * 24  # minutes per hour

        for a in apps:
            dur = a.duration_seconds
            total += dur
            cat = categorize_name(a.app_name.lower(), db)
            if cat == "Work":
                productive += dur
            elif cat == "Entertainment":
                distracting += dur
            # Fill hourly
            if a.start_timestamp:
                hourly[a.start_timestamp.hour] += dur / 60

        for w in websites:
            dur = w.duration_seconds
            total += dur
            cat = categorize_name(w.domain.lower(), db)
            if cat in ("Work", "Learning"):
                productive += dur
            elif cat == "Entertainment":
                distracting += dur
            if w.start_timestamp:
                hourly[w.start_timestamp.hour] += dur / 60

        score = 50
        if total > 0:
            ratio = (productive - distracting * 1.5) / total
            score = int(max(0, min(100, (ratio + 0.5) * 100)))

        days.append({
            "date": day_start.strftime("%Y-%m-%d"),
            "day_name": day_start.strftime("%a"),
            "total_minutes": round(total / 60, 1),
            "productive_minutes": round(productive / 60, 1),
            "distracting_minutes": round(distracting / 60, 1),
            "score": score,
            "hourly": [round(h, 1) for h in hourly]
        })

    return days

# ──────────────────────────────────────────────
# TIMELINE
# ──────────────────────────────────────────────

@router.get("/api/reports/timeline")
def get_timeline(db: Session = Depends(get_db)):
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    app_usage = db.query(AppUsage).filter(AppUsage.start_timestamp >= today).all()
    website_usage = get_website_usage_window(db, today)

    events = []
    for app in app_usage:
        events.append({
            "type": "app", "name": app.app_name, "title": app.window_title,
            "start": app.start_timestamp.isoformat(), "duration": app.duration_seconds
        })
    for web in website_usage:
        events.append({
            "type": "website", "name": web.domain, "title": web.page_title,
            "start": web.start_timestamp.isoformat(), "duration": web.duration_seconds
        })
    events.sort(key=lambda x: x["start"], reverse=True)
    return events

@router.get("/api/reports/websites/deep-dive")
def get_websites_deep_dive(days: int = Query(1, ge=1, le=30), db: Session = Depends(get_db)):
    now = datetime.utcnow()
    if days == 1:
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    else:
        start = now - timedelta(days=days)
    span = now - start
    previous_start = start - span
    previous_end = start

    usage = get_website_usage_window(db, start, now)
    previous_usage = get_website_usage_window(db, previous_start, previous_end, include_active=False)

    previous_by_domain = defaultdict(float)
    for item in previous_usage:
        previous_by_domain[item.domain or "Unknown"] += item.duration_seconds or 0

    domains = {}
    pages = defaultdict(lambda: {"title": "", "url": "", "domain": "", "seconds": 0.0, "visits": 0})
    hourly = [0.0] * 24
    category_totals = {"Work": 0.0, "Learning": 0.0, "Communication": 0.0, "Entertainment": 0.0, "Other": 0.0}
    shortform_seconds = 0.0
    shortform_sessions = 0

    for item in usage:
        domain = item.domain or "Unknown"
        title = item.page_title or "Untitled"
        url = item.url or ""
        seconds = item.duration_seconds or 0
        category = categorize_name(domain.lower(), db)
        shortform_kind = classify_shortform_url(url, title)

        if domain not in domains:
            domains[domain] = {
                "domain": domain,
                "category": category,
                "total_seconds": 0.0,
                "sessions": 0,
                "longest_session_seconds": 0.0,
                "last_seen": None,
                "shortform_seconds": 0.0,
                "shortform_sessions": 0,
                "page_titles": defaultdict(int),
            }

        record = domains[domain]
        record["total_seconds"] += seconds
        record["sessions"] += 1
        record["longest_session_seconds"] = max(record["longest_session_seconds"], seconds)
        if item.start_timestamp and (record["last_seen"] is None or item.start_timestamp > record["last_seen"]):
            record["last_seen"] = item.start_timestamp
        record["page_titles"][title] += 1

        if shortform_kind:
            record["shortform_seconds"] += seconds
            record["shortform_sessions"] += 1
            shortform_seconds += seconds
            shortform_sessions += 1

        page_key = f"{domain}|{url or title}"
        pages[page_key]["title"] = title
        pages[page_key]["url"] = url
        pages[page_key]["domain"] = domain
        pages[page_key]["seconds"] += seconds
        pages[page_key]["visits"] += 1

        category_totals[category] += seconds
        if item.start_timestamp:
            hourly[item.start_timestamp.hour] += seconds / 60

    total_seconds = sum(item["total_seconds"] for item in domains.values())
    productive_seconds = category_totals["Work"] + category_totals["Learning"]
    distracting_seconds = category_totals["Entertainment"]
    productive_ratio = round((productive_seconds / total_seconds) * 100) if total_seconds else 0

    domain_rows = []
    for record in domains.values():
        previous_seconds = previous_by_domain[record["domain"]]
        delta_seconds = record["total_seconds"] - previous_seconds
        avg_session = record["total_seconds"] / record["sessions"] if record["sessions"] else 0
        top_title = max(record["page_titles"].items(), key=lambda item: item[1])[0] if record["page_titles"] else ""
        domain_rows.append({
            "domain": record["domain"],
            "category": record["category"],
            "minutes": round(record["total_seconds"] / 60, 1),
            "sessions": record["sessions"],
            "avg_session_minutes": round(avg_session / 60, 1),
            "longest_session_minutes": round(record["longest_session_seconds"] / 60, 1),
            "last_seen": record["last_seen"].isoformat() if record["last_seen"] else None,
            "trend_minutes": round(delta_seconds / 60, 1),
            "shortform_minutes": round(record["shortform_seconds"] / 60, 1),
            "shortform_sessions": record["shortform_sessions"],
            "top_title": top_title,
        })

    domain_rows.sort(key=lambda item: item["minutes"], reverse=True)
    page_rows = sorted(pages.values(), key=lambda item: item["seconds"], reverse=True)[:12]
    page_rows = [{
        "title": item["title"],
        "domain": item["domain"],
        "url": item["url"],
        "minutes": round(item["seconds"] / 60, 1),
        "visits": item["visits"],
    } for item in page_rows]

    focus_candidates = [
        item for item in domain_rows
        if item["category"] in ("Work", "Learning") and item["minutes"] >= 3
    ][:5]
    risk_domains = [
        item for item in domain_rows
        if item["category"] == "Entertainment" or item["shortform_minutes"] > 0
    ][:5]

    recommendations = []
    if shortform_seconds >= 30 * 60:
        recommendations.append("Short-form video is past 30 minutes. Add these domains to Focus Mode blockers before the next sprint.")
    if distracting_seconds > productive_seconds and total_seconds > 20 * 60:
        recommendations.append("Distracting browsing is outrunning useful browsing. Switch to Focus Mode for the next session.")
    if len(domain_rows) >= 8:
        recommendations.append("High domain spread today. Close stale tabs and keep only the active work trail open.")
    if not recommendations:
        recommendations.append("Website usage looks controlled. Keep productive references open and review again after the next block.")

    return {
        "range_days": days,
        "summary": {
            "total_minutes": round(total_seconds / 60, 1),
            "productive_minutes": round(productive_seconds / 60, 1),
            "distracting_minutes": round(distracting_seconds / 60, 1),
            "shortform_minutes": round(shortform_seconds / 60, 1),
            "shortform_sessions": shortform_sessions,
            "productive_ratio": productive_ratio,
            "domains_count": len(domain_rows),
            "sessions_count": sum(item["sessions"] for item in domain_rows),
        },
        "categories": {key: round(value / 60, 1) for key, value in category_totals.items()},
        "hourly": [round(value, 1) for value in hourly],
        "domains": domain_rows,
        "top_pages": page_rows,
        "focus_candidates": focus_candidates,
        "risk_domains": risk_domains,
        "recommendations": recommendations,
    }

# ──────────────────────────────────────────────
# FOCUS MODE
# ──────────────────────────────────────────────

focus_state = {"is_active": False, "blocked_domains": []}

def _get_blocked_domains(db: Session):
    raw = get_setting(db, "blocked_domains")
    return [d.strip() for d in raw.split(",") if d.strip()]

class FocusStateUpdate(BaseModel):
    is_active: bool

@router.get("/api/focus")
def get_focus_state(db: Session = Depends(get_db)):
    focus_state["blocked_domains"] = _get_blocked_domains(db)
    return focus_state

@router.post("/api/focus")
def update_focus_state(state: FocusStateUpdate, db: Session = Depends(get_db)):
    focus_state["is_active"] = state.is_active
    focus_state["blocked_domains"] = _get_blocked_domains(db)
    # Record focus session
    if state.is_active:
        session = FocusSessionRecord(start_timestamp=datetime.utcnow())
        db.add(session)
        db.commit()
    else:
        # End the last open session
        last = db.query(FocusSessionRecord).filter(
            FocusSessionRecord.end_timestamp == None
        ).order_by(FocusSessionRecord.id.desc()).first()
        if last:
            last.end_timestamp = datetime.utcnow()
            last.completed = True
            db.commit()
    return focus_state

# ──────────────────────────────────────────────
# AI CHAT
# ──────────────────────────────────────────────

class ChatMessage(BaseModel):
    message: str

@router.post("/api/chat")
def chat_with_ai(chat: ChatMessage, db: Session = Depends(get_db)):
    msg = chat.message.lower()
    if "productive" in msg or "score" in msg:
        response = "Your productivity score looks solid! You've spent a lot of time in VS Code today. Keep it up!"
    elif "distracted" in msg or "youtube" in msg:
        response = "I noticed some YouTube usage. Maybe try enabling Focus Mode if you need to lock in?"
    elif "timeline" in msg or "today" in msg:
        response = "You've been active for several hours today. Check the Timeline view to see your exact activity logs."
    elif "focus" in msg:
        response = "Focus Mode blocks distracting websites using the NeuroTrack extension. Start a Pomodoro timer in the header to activate it!"
    elif "goal" in msg:
        response = "Head to the Dashboard to set daily goals. You can track productive hours and build streaks!"
    elif "streak" in msg:
        response = "Streaks reward consistency! Hit your daily goal every day to keep your streak alive. 🔥"
    else:
        response = f"I'm your NeuroTrack AI assistant. You said: '{chat.message}'. How can I help you optimize your workflow today?"
    return {"response": response}

# ──────────────────────────────────────────────
# SCREENSHOTS
# ──────────────────────────────────────────────

@router.get("/api/reports/screenshots")
def get_screenshots():
    try:
        files = os.listdir("./data/screenshots")
        files.sort(reverse=True)
        data = []
        for f in files:
            if f.endswith(".jpg"):
                try:
                    ts_str = f.replace(".jpg", "")
                    dt = datetime.strptime(ts_str, "%Y%m%d_%H%M%S")
                    data.append({"url": f"http://127.0.0.1:8000/screenshots/{f}", "timestamp": dt.isoformat()})
                except Exception:
                    pass
        return data
    except Exception:
        return []

# ──────────────────────────────────────────────
# CSV EXPORT
# ──────────────────────────────────────────────

@router.get("/api/reports/export")
def export_data(db: Session = Depends(get_db)):
    app_usage = db.query(AppUsage).all()
    website_usage = db.query(WebsiteUsage).all()
    csv_data = "type,name,title,start_timestamp,duration_seconds\n"
    for app in app_usage:
        safe_title = str(app.window_title).replace('"', '""') if app.window_title else ""
        csv_data += f'app,"{app.app_name}","{safe_title}","{app.start_timestamp}",{app.duration_seconds}\n'
    for web in website_usage:
        safe_title = str(web.page_title).replace('"', '""') if web.page_title else ""
        csv_data += f'website,"{web.domain}","{safe_title}","{web.start_timestamp}",{web.duration_seconds}\n'
    return PlainTextResponse(content=csv_data, media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=neurotrack_export.csv"})

# ──────────────────────────────────────────────
# GOALS & STREAKS
# ──────────────────────────────────────────────

class GoalCreate(BaseModel):
    goal_type: str = "productive_time"
    target_minutes: int = 240
    app_keyword: Optional[str] = None

@router.get("/api/goals")
def get_goals(db: Session = Depends(get_db)):
    goals = db.query(DailyGoal).filter(DailyGoal.is_active == True).all()
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Calculate today's progress for productive time
    apps = db.query(AppUsage).filter(AppUsage.start_timestamp >= today).all()
    websites = get_website_usage_window(db, today)
    
    productive_seconds = 0
    for a in apps:
        if categorize_name(a.app_name.lower(), db) == "Work":
            productive_seconds += a.duration_seconds
    for w in websites:
        if categorize_name(w.domain.lower(), db) in ("Work", "Learning"):
            productive_seconds += w.duration_seconds
    
    productive_minutes = productive_seconds / 60

    result = []
    for g in goals:
        progress = productive_minutes if g.goal_type == "productive_time" else 0
        # If it's app-specific, calculate that
        if g.goal_type == "app_time" and g.app_keyword:
            kw = g.app_keyword.lower()
            progress = sum(a.duration_seconds for a in apps if kw in a.app_name.lower()) / 60
        result.append({
            "id": g.id, "goal_type": g.goal_type,
            "target_minutes": g.target_minutes, "app_keyword": g.app_keyword,
            "current_minutes": round(progress, 1),
            "percent": min(100, round((progress / g.target_minutes) * 100)) if g.target_minutes > 0 else 0
        })
    return result

@router.post("/api/goals")
def create_goal(goal: GoalCreate, db: Session = Depends(get_db)):
    new_goal = DailyGoal(
        goal_type=goal.goal_type,
        target_minutes=goal.target_minutes,
        app_keyword=goal.app_keyword
    )
    db.add(new_goal)
    db.commit()
    return {"status": "ok", "id": new_goal.id}

@router.delete("/api/goals/{goal_id}")
def delete_goal(goal_id: int, db: Session = Depends(get_db)):
    goal = db.query(DailyGoal).filter(DailyGoal.id == goal_id).first()
    if goal:
        goal.is_active = False
        db.commit()
    return {"status": "ok"}

@router.get("/api/streak")
def get_streak(db: Session = Depends(get_db)):
    """Calculate streak: consecutive days where productive time >= first active goal target."""
    goals = db.query(DailyGoal).filter(DailyGoal.is_active == True).all()
    if not goals:
        return {"streak": 0, "message": "Set a goal to start building streaks!"}
    
    target_minutes = goals[0].target_minutes
    streak = 0
    now = datetime.utcnow()
    
    for i in range(1, 365):  # check up to a year back
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        
        apps = db.query(AppUsage).filter(
            AppUsage.start_timestamp >= day_start,
            AppUsage.start_timestamp < day_end
        ).all()
        
        productive = sum(a.duration_seconds for a in apps if categorize_name(a.app_name.lower(), db) == "Work")
        
        if productive / 60 >= target_minutes:
            streak += 1
        else:
            break
    
    return {"streak": streak, "target_minutes": target_minutes}

# ──────────────────────────────────────────────
# SETTINGS
# ──────────────────────────────────────────────

@router.get("/api/settings")
def get_settings(db: Session = Depends(get_db)):
    result = dict(DEFAULT_SETTINGS)  # start with defaults
    db_settings = db.query(Settings).all()
    for s in db_settings:
        result[s.key] = s.value
    return result

class SettingsUpdate(BaseModel):
    settings: dict

@router.put("/api/settings")
def update_settings(data: SettingsUpdate, db: Session = Depends(get_db)):
    for key, value in data.settings.items():
        existing = db.query(Settings).filter(Settings.key == key).first()
        if existing:
            existing.value = str(value)
        else:
            db.add(Settings(key=key, value=str(value)))
    db.commit()
    return {"status": "ok"}
