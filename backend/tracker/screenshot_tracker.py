import mss
from PIL import Image
import os
import time
from datetime import datetime
from database.database import SessionLocal
from database.models import Settings

def is_screenshot_enabled():
    try:
        db = SessionLocal()
        row = db.query(Settings).filter(Settings.key == "enable_screenshots").first()
        db.close()
        if row:
            return row.value.lower() == "true"
        return True
    except:
        return True

import win32gui
import win32api

def get_active_monitor_mss_index(sct):
    try:
        hwnd = win32gui.GetForegroundWindow()
        # 2 = MONITOR_DEFAULTTONEAREST
        monitor_handle = win32api.MonitorFromWindow(hwnd, 2)
        monitor_info = win32api.GetMonitorInfo(monitor_handle)
        monitor_rect = monitor_info['Monitor'] # (left, top, right, bottom)
        
        for i, m in enumerate(sct.monitors[1:], 1):
            if m['left'] == monitor_rect[0] and m['top'] == monitor_rect[1]:
                return i
    except:
        pass
    return 1 # Fallback to primary

class ScreenshotTracker:
    def __init__(self, output_dir="./data/screenshots", interval=60):
        self.output_dir = output_dir
        self.interval = interval
        self.is_tracking = True
        os.makedirs(self.output_dir, exist_ok=True)

    def take_screenshot(self):
        try:
            with mss.mss() as sct:
                idx = get_active_monitor_mss_index(sct)
                monitor = sct.monitors[idx]
                screenshot = sct.grab(monitor)
                
                img = Image.frombytes("RGB", screenshot.size, screenshot.bgra, "raw", "BGRX")
                
                # Resize to save space, but preserve quality better than 800x600
                img.thumbnail((1920, 1080))
                
                filename = f"{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.jpg"
                filepath = os.path.join(self.output_dir, filename)
                img.save(filepath, "JPEG", quality=60)
                return filename
        except Exception as e:
            print(f"Screenshot error: {e}")
            return None

    def run(self):
        while self.is_tracking:
            if is_screenshot_enabled():
                self.take_screenshot()
            time.sleep(self.interval)
