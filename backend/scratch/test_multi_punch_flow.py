import asyncio, os, json
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import select
from datetime import date, time
from dotenv import load_dotenv

from models.user import User
from models.employee import Employee
from models.attendance import Attendance, AttendanceStatus
from routes.attendance import clock_in, clock_out, get_today

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

async def test():
    engine = create_async_engine(DATABASE_URL)
    async with AsyncSession(engine) as s:
        # Fetch Suhas Patel (user_id = 12, employee_id = 16)
        res = await s.execute(select(User).where(User.id == 12))
        user = res.scalar_one_or_none()
        if not user:
            print("User 12 not found")
            return

        res_emp = await s.execute(select(Employee).where(Employee.user_id == 12))
        emp = res_emp.scalar_one_or_none()
        
        # Clear any existing attendance record for today so we start clean
        existing_att = await s.execute(
            select(Attendance).where(
                Attendance.employee_id == emp.id,
                Attendance.date == date.today()
            )
        )
        for r in existing_att.scalars().all():
            await s.delete(r)
        await s.flush()
        print("Cleared existing attendance records for today to run test cleanly")

        # 1. First Clock In (09:00:00)
        # Mock _local_time in the router by temporarily overriding clock_in endpoint's internal time calculation,
        # or we can manually invoke clock_in and then manipulate the records to verify the math logic.
        # But wait! To test the actual code paths of clock_in and clock_out, let's execute them and manipulate their times.
        # Since _local_time() returns datetime.now().time(), we can mock it by replacing the helper function in the module:
        import routes.attendance
        original_local_time = routes.attendance._local_time

        # Mock time to 09:00:00
        routes.attendance._local_time = lambda: time(9, 0, 0)
        print("Simulating Punch 1: Clock In at 09:00:00...")
        rec1 = await clock_in(db=s, current_user=user)
        print(f"  Result: status={rec1.status}, clock_in={rec1.clock_in}, clock_history={rec1.clock_history}")
        
        # Mock time to 12:00:00 and Clock Out
        routes.attendance._local_time = lambda: time(12, 0, 0)
        print("Simulating Punch 2: Clock Out at 12:00:00...")
        rec2 = await clock_out(db=s, current_user=user)
        print(f"  Result: status={rec2.status}, clock_out={rec2.clock_out}, hours_worked={rec2.hours_worked}, clock_history={rec2.clock_history}")
        assert rec2.hours_worked == 3.0, f"Expected 3.0 hours, got {rec2.hours_worked}"
        assert rec2.status == AttendanceStatus.half_day, f"Expected half_day, got {rec2.status}"

        # Mock time to 13:00:00 and Clock In again
        routes.attendance._local_time = lambda: time(13, 0, 0)
        print("Simulating Punch 3: Clock In at 13:00:00...")
        rec3 = await clock_in(db=s, current_user=user)
        print(f"  Result: status={rec3.status}, clock_in={rec3.clock_in}, clock_out={rec3.clock_out}, clock_history={rec3.clock_history}")
        assert rec3.clock_out is None, "Clock out should be reset to None when active"

        # Mock time to 19:00:00 and Clock Out again (total 3 + 6 = 9 hours)
        routes.attendance._local_time = lambda: time(19, 0, 0)
        print("Simulating Punch 4: Clock Out at 19:00:00...")
        rec4 = await clock_out(db=s, current_user=user)
        print(f"  Result: status={rec4.status}, clock_out={rec4.clock_out}, hours_worked={rec4.hours_worked}, clock_history={rec4.clock_history}")
        assert rec4.hours_worked == 9.0, f"Expected 9.0 hours, got {rec4.hours_worked}"
        assert rec4.status == AttendanceStatus.present, f"Expected present, got {rec4.status}"

        # 2. Get Today's Status
        today_data = await get_today(db=s, current_user=user)
        print("Today's status via get_today API:")
        for k, v in today_data.items():
            print(f"  {k}: {v}")
        
        assert today_data["can_clock_in"] is True, "Should be able to clock in again"
        assert today_data["can_clock_out"] is False, "Should not be able to clock out when not clocked in"

        # Restore original time helper
        routes.attendance._local_time = original_local_time
        
        # Roll back changes so database remains unmodified after tests
        await s.rollback()
        print("All assertions passed and transaction rolled back successfully!")

asyncio.run(test())
