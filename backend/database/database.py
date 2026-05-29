from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
import os

# Create data directory if it doesn't exist
os.makedirs(os.path.dirname("./neurotrack.db"), exist_ok=True)

SQLALCHEMY_DATABASE_URL = "sqlite:///./neurotrack.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
