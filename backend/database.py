"""
database.py — Async SQLAlchemy (PostgreSQL) + Motor (MongoDB) connections
Scalability: tuned pool settings for 5,000+ concurrent users
"""
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic_settings import BaseSettings
from functools import lru_cache
from cachetools import TTLCache
import threading
import os
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://postgres:password@localhost:5432/aihrms"
    )
    mongodb_url: str = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    mongodb_name: str = os.getenv("MONGODB_NAME", "aihrms")
    secret_key: str = os.getenv("SECRET_KEY", "changeme-secret-key-32chars-minimum")
    algorithm: str = os.getenv("ALGORITHM", "HS256")
    access_token_expire_minutes: int = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440")
    )
    groq_api_key: str = os.getenv("GROQ_API_KEY", "")
    frontend_url: str = os.getenv("FRONTEND_URL", "http://localhost:5173")

    class Config:
        env_file = ".env"
        extra = "allow"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


# ─── PostgreSQL ───────────────────────────────────────────────────────────────
# Pool tuned for 5,000+ concurrent users:
#   pool_size=20         — persistent connections kept alive
#   max_overflow=40      — burst connections above pool_size
#   pool_timeout=30      — seconds to wait for connection before error
#   pool_recycle=1800    — recycle connections every 30 min to avoid stale connections
#   pool_pre_ping=True   — verify connections before use (handles drops)
settings = get_settings()

# Auto-resolve postgresql:// and postgres:// schemas to postgresql+asyncpg:// for async engines
db_url = settings.database_url
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif db_url.startswith("postgresql://") and not db_url.startswith("postgresql+asyncpg://"):
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

engine = create_async_engine(
    db_url,
    echo=False,
    pool_pre_ping=True,
    pool_size=20,
    max_overflow=40,
    pool_timeout=30,
    pool_recycle=1800,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    """FastAPI dependency — yields an async DB session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ─── MongoDB ──────────────────────────────────────────────────────────────────
# maxPoolSize=50 — MongoDB connection pool for concurrent queries
# serverSelectionTimeoutMS=5000 — fail fast if MongoDB is unreachable
_mongo_client: AsyncIOMotorClient | None = None


def get_mongo_client() -> AsyncIOMotorClient:
    global _mongo_client
    if _mongo_client is None:
        _mongo_client = AsyncIOMotorClient(
            settings.mongodb_url,
            maxPoolSize=50,
            serverSelectionTimeoutMS=5000,
        )
    return _mongo_client


def get_mongo_db():
    """Returns the Motor database instance."""
    return get_mongo_client()[settings.mongodb_name]


async def init_mongo_indexes():
    """Create MongoDB indexes for performance."""
    db = get_mongo_db()
    await db.resume_screenings.create_index("job_id")
    await db.resume_screenings.create_index("screened_at")
    await db.resume_screenings.create_index([("score", -1)])
    await db.chat_history.create_index("user_id", unique=True)
    await db.ai_logs.create_index("created_at")
    await db.ai_logs.create_index("feature")
    await db.voice_interviews.create_index("created_at")


async def init_db():
    """Create all PostgreSQL tables."""
    # Import all models so they are registered with Base
    from models import user, employee, attendance, leave, payroll  # noqa: F401
    from sqlalchemy import text
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(
            text("ALTER TABLE employees ADD COLUMN IF NOT EXISTS gender VARCHAR(10)")
        )
        await conn.execute(
            text("ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT TRUE")
        )
        await conn.execute(
            text("ALTER TABLE attendance ADD COLUMN IF NOT EXISTS clock_history TEXT")
        )


# ─── In-Memory TTL Cache ──────────────────────────────────────────────────────
# Thread-safe TTL cache for expensive dashboard queries.
# 60-second TTL — fresh enough for near-real-time, avoids DB storms.
_cache_lock = threading.Lock()
_dashboard_cache: TTLCache = TTLCache(maxsize=128, ttl=60)


def get_cache() -> TTLCache:
    return _dashboard_cache


def cache_get(key: str):
    with _cache_lock:
        return _dashboard_cache.get(key)


def cache_set(key: str, value):
    with _cache_lock:
        _dashboard_cache[key] = value
