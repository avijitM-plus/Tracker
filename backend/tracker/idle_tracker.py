import time
from pynput import mouse, keyboard
from datetime import datetime
from database.database import SessionLocal
from database.models import IdleSession

class IdleTracker:
    def __init__(self, idle_timeout=60):
        self.idle_timeout = idle_timeout
        self.last_activity_time = time.time()
        self.is_idle = False
        self.idle_start_time = None
        self.is_tracking = True
        
        # APM Tracking
        self.action_timestamps = []

    def get_apm(self):
        now = time.time()
        # Clean old timestamps
        self.action_timestamps = [t for t in self.action_timestamps if now - t <= 60]
        return len(self.action_timestamps)

    def on_activity(self, *args):
        now = time.time()
        self.last_activity_time = now
        
        # Track input for APM (we pass args so we can filter out mouse move, which spam too much)
        # Mouse move has 2 args (x,y), click has 4, scroll has 4, keypress has 1
        if len(args) != 2:
            self.action_timestamps.append(now)
            # keep only last 60 seconds
            self.action_timestamps = [t for t in self.action_timestamps if now - t <= 60]
        
        if self.is_idle:
            # User came back, end idle session
            self.is_idle = False
            self.save_idle_session(self.idle_start_time, datetime.utcnow())
            self.idle_start_time = None

    def start_listeners(self):
        # Keyboard listener
        self.keyboard_listener = keyboard.Listener(on_press=self.on_activity)
        self.keyboard_listener.start()
        
        # Mouse listener
        self.mouse_listener = mouse.Listener(
            on_move=self.on_activity,
            on_click=self.on_activity,
            on_scroll=self.on_activity
        )
        self.mouse_listener.start()

    def run(self):
        self.start_listeners()
        
        while self.is_tracking:
            now = time.time()
            if not self.is_idle and (now - self.last_activity_time) > self.idle_timeout:
                self.is_idle = True
                self.idle_start_time = datetime.utcnow()
            time.sleep(1)

    def save_idle_session(self, start_time, end_time):
        duration = (end_time - start_time).total_seconds()
        
        db = SessionLocal()
        try:
            new_session = IdleSession(
                start_timestamp=start_time,
                end_timestamp=end_time,
                duration_seconds=duration
            )
            db.add(new_session)
            db.commit()
        except Exception as e:
            print(f"Error saving idle session: {e}")
            db.rollback()
        finally:
            db.close()
