import time
import win32gui
import win32process
import psutil
from datetime import datetime
from database.database import SessionLocal
from database.models import AppUsage

class AppTracker:
    def __init__(self):
        self.current_app = None
        self.current_window_title = None
        self.current_process_name = None
        self.session_start = None
        self.is_tracking = True

    def get_active_window_info(self):
        try:
            window = win32gui.GetForegroundWindow()
            title = win32gui.GetWindowText(window)
            pid = win32process.GetWindowThreadProcessId(window)[1]
            
            try:
                process = psutil.Process(pid)
                process_name = process.name()
                
                # Basic cleanup for app name
                app_name = process_name.replace('.exe', '').capitalize()
                
            except psutil.NoSuchProcess:
                process_name = "Unknown"
                app_name = "Unknown"

            return app_name, process_name, title
        except Exception as e:
            return "Unknown", "Unknown", "Unknown"

    def run(self):
        while self.is_tracking:
            app_name, process_name, title = self.get_active_window_info()
            
            # Change detected or first run
            if process_name != self.current_process_name or title != self.current_window_title:
                if self.current_process_name is not None and self.session_start is not None:
                    self.save_session(self.current_app, self.current_process_name, self.current_window_title, self.session_start, datetime.utcnow())
                
                self.current_app = app_name
                self.current_process_name = process_name
                self.current_window_title = title
                self.session_start = datetime.utcnow()
                
            time.sleep(1)

    def save_session(self, app_name, process_name, window_title, start_time, end_time):
        duration = (end_time - start_time).total_seconds()
        # Ignore very short sessions
        if duration < 1.0 or process_name == "Unknown":
            return

        db = SessionLocal()
        try:
            new_usage = AppUsage(
                app_name=app_name,
                process_name=process_name,
                window_title=window_title,
                start_timestamp=start_time,
                end_timestamp=end_time,
                duration_seconds=duration
            )
            db.add(new_usage)
            db.commit()
        except Exception as e:
            print(f"Error saving session: {e}")
            db.rollback()
        finally:
            db.close()
