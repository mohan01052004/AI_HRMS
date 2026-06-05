import asyncio, os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import select
from datetime import date
from dotenv import load_dotenv
from routes.attendance import get_all_attendance
from models.user import User

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

async def test():
    engine = create_async_engine(DATABASE_URL)
    async with AsyncSession(engine) as s:
        # Call for 2026-06-04
        result_before = await get_all_attendance(date_filter=date(2026, 6, 4), department_id=None, db=s, _=None)
        records_before = result_before["records"]
        emp_16_before = [r for r in records_before if r["employee_id"] == 16]
        print(f"Suhas (emp 16) in records for 2026-06-04: {len(emp_16_before)}")

        # Call for 2026-06-05
        result_after = await get_all_attendance(date_filter=date(2026, 6, 5), department_id=None, db=s, _=None)
        records_after = result_after["records"]
        emp_16_after = [r for r in records_after if r["employee_id"] == 16]
        print(f"Suhas (emp 16) in records for 2026-06-05: {len(emp_16_after)}")

asyncio.run(test())
