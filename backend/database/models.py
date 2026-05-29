from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Date
from .database import Base
import datetime

class AppUsage(Base):
    __tablename__ = "app_usage"

    id = Column(Integer, primary_key=True, index=True)
    app_name = Column(String, index=True)
    process_name = Column(String, index=True)
    window_title = Column(String)
    start_timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    end_timestamp = Column(DateTime, nullable=True)
    duration_seconds = Column(Float, default=0.0)

class WebsiteUsage(Base):
    __tablename__ = "website_usage"

    id = Column(Integer, primary_key=True, index=True)
    domain = Column(String, index=True)
    url = Column(String)
    page_title = Column(String)
    browser_name = Column(String, index=True)
    start_timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    end_timestamp = Column(DateTime, nullable=True)
    duration_seconds = Column(Float, default=0.0)

class IdleSession(Base):
    __tablename__ = "idle_sessions"

    id = Column(Integer, primary_key=True, index=True)
    start_timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    end_timestamp = Column(DateTime, nullable=True)
    duration_seconds = Column(Float, default=0.0)

class DailyGoal(Base):
    __tablename__ = "daily_goals"

    id = Column(Integer, primary_key=True, index=True)
    goal_type = Column(String, default="productive_time")  # productive_time, app_time, limit_app
    target_minutes = Column(Integer, default=240)
    app_keyword = Column(String, nullable=True)  # optional: track a specific app/keyword
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class DailySummary(Base):
    __tablename__ = "daily_summaries"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, unique=True, index=True)
    total_minutes = Column(Float, default=0.0)
    productive_minutes = Column(Float, default=0.0)
    distracting_minutes = Column(Float, default=0.0)
    neutral_minutes = Column(Float, default=0.0)
    score = Column(Integer, default=0)
    top_app = Column(String, nullable=True)
    top_website = Column(String, nullable=True)

class FocusSessionRecord(Base):
    __tablename__ = "focus_sessions"

    id = Column(Integer, primary_key=True, index=True)
    start_timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    end_timestamp = Column(DateTime, nullable=True)
    duration_minutes = Column(Integer, default=25)
    completed = Column(Boolean, default=False)

class Settings(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True)
    value = Column(String)
