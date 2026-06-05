import asyncio, os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import select
from dotenv import load_dotenv
from routes.attendance import get_today
from models.user import User

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

async def test():
    engine = create_async_engine(DATABASE_URL)
    async with AsyncSession(engine) as s:
        # Fetch manager user (email: manager@hrms.com)
        res_mgr = await s.execute(select(User).where(User.email == "manager@hrms.com"))
        manager = res_mgr.scalar_one_or_none()
        
        # Fetch HR user (email: hr@hrms.com)
        res_hr = await s.execute(select(User).where(User.email == "hr@hrms.com"))
        hr = res_hr.scalar_one_or_none()

        print("Testing Manager today status:")
        mgr_today = await get_today(db=s, current_user=manager)
        print(f"  Manager employee ID: {mgr_today['employee_id']}, can_clock_in: {mgr_today['can_clock_in']}")

        print("Testing HR today status:")
        hr_today = await get_today(db=s, current_user=hr)
        print(f"  HR employee ID: {hr_today['employee_id']}, can_clock_in: {hr_today['can_clock_in']}")

asyncio.run(test())
