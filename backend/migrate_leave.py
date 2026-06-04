import asyncio
from database import engine
from sqlalchemy import text

async def main():
    async with engine.begin() as conn:
        await conn.execute(text("ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS rejection_reason TEXT;"))
    print("Migration successful: added rejection_reason to leave_requests.")

if __name__ == "__main__":
    asyncio.run(main())
