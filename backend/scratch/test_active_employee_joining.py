import asyncio, os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import select
from datetime import date
from dotenv import load_dotenv
from routes.attendance import get_all_attendance
from models.employee import Employee, EmployeeStatus

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

async def test():
    engine = create_async_engine(DATABASE_URL)
    async with AsyncSession(engine) as s:
        # Fetch Suhas and activate him
        res = await s.execute(select(Employee).where(Employee.id == 16))
        emp = res.scalar_one_or_none()
        if not emp:
            print("Employee 16 not found")
            return
        
        original_status = emp.status
        emp.status = EmployeeStatus.active
        s.add(emp)
        await s.flush()
        print(f"Temporarily activated Employee 16 (joining date: {emp.date_of_joining})")

        # Query team view for June 4
        result_before = await get_all_attendance(date_filter=date(2026, 6, 4), department_id=None, db=s, _=None)
        records_before = result_before["records"]
        emp_16_before = [r for r in records_before if r["employee_id"] == 16]
        print(f"Suhas in records for 2026-06-04: {len(emp_16_before)}")

        # Query team view for June 5
        result_after = await get_all_attendance(date_filter=date(2026, 6, 5), department_id=None, db=s, _=None)
        records_after = result_after["records"]
        emp_16_after = [r for r in records_after if r["employee_id"] == 16]
        print(f"Suhas in records for 2026-06-05: {len(emp_16_after)}")

        # Roll back changes so we don't commit temporary database state changes
        await s.rollback()
        print("Rolled back activation")

asyncio.run(test())
