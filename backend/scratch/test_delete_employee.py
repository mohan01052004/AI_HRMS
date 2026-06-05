import asyncio
import os
import sys
import httpx
from datetime import datetime, date, timezone

# Add backend directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from database import AsyncSessionLocal
from models.user import User, UserRole
from models.employee import Employee, EmployeeStatus
from models.attendance import Attendance, AttendanceStatus
from models.leave import LeaveRequest, LeaveStatus
from models.payroll import SalaryStructure
from sqlalchemy import select

async def main():
    email = "temp_test_delete@hrms.com"
    emp_id = None
    user_id = None

    async with AsyncSessionLocal() as db:
        # Check if previous test ran and clean up
        res_emp = await db.execute(select(Employee).where(Employee.email == email))
        existing_emp = res_emp.scalar_one_or_none()
        if existing_emp:
            emp_id = existing_emp.id
            user_id = existing_emp.user_id
            print(f"Cleaning up previous test data for employee ID {emp_id}...")
            # Perform raw deletes for cleanup
            from sqlalchemy import delete
            await db.execute(delete(Attendance).where(Attendance.employee_id == emp_id))
            await db.execute(delete(LeaveRequest).where(LeaveRequest.employee_id == emp_id))
            await db.execute(delete(SalaryStructure).where(SalaryStructure.employee_id == emp_id))
            await db.execute(delete(Employee).where(Employee.id == emp_id))
            if user_id:
                await db.execute(delete(User).where(User.id == user_id))
            await db.commit()

        # 1. Create a mock User and Employee
        print("Inserting mock employee and dependencies...")
        new_user = User(
            name="Delete Me",
            email=email,
            password_hash="hashed_pw",
            role=UserRole.employee,
            is_active=True
        )
        db.add(new_user)
        await db.flush()

        new_emp = Employee(
            user_id=new_user.id,
            employee_code="EMP-9999",
            name="Delete Me",
            email=email,
            status=EmployeeStatus.active,
            is_approved=True
        )
        db.add(new_emp)
        await db.flush()

        emp_id = new_emp.id
        user_id = new_user.id

        # 2. Add related records
        att = Attendance(
            employee_id=emp_id,
            date=date.today(),
            status=AttendanceStatus.present
        )
        db.add(att)

        lr = LeaveRequest(
            employee_id=emp_id,
            leave_type_id=1,  # Assuming 1 is a valid leave type ID
            from_date=date.today(),
            to_date=date.today(),
            reason="Sick leave",
            status=LeaveStatus.pending
        )
        db.add(lr)

        sal = SalaryStructure(
            employee_id=emp_id,
            basic=50000.0,
            hra=15000.0,
            allowances=5000.0,
            deductions=2000.0
        )
        db.add(sal)

        await db.commit()
        print(f"Mock employee created. ID={emp_id}, UserID={user_id}")

    # 3. Authenticate and Delete via FastAPI endpoint
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            # Login as Admin
            print("Logging in as Admin...")
            login_res = await client.post("http://127.0.0.1:8000/auth/login/json", json={
                "email": "admin@hrms.com",
                "password": "HrMs@2026!Sec"
            })
            if login_res.status_code != 200:
                print("Admin login failed! Response:", login_res.text)
                return
            token = login_res.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}

            # Attempt self-deletion (Admin's own employee ID)
            print("Testing self-deletion protection...")
            me_res = await client.get("http://127.0.0.1:8000/employees/me", headers=headers)
            if me_res.status_code == 200:
                my_emp_id = me_res.json()["id"]
                self_del_res = await client.delete(f"http://127.0.0.1:8000/employees/{my_emp_id}", headers=headers)
                print(f"Self-deletion response status: {self_del_res.status_code} (Expected: 400 or 403)")
                assert self_del_res.status_code in [400, 403]
            else:
                print("Could not fetch own profile for self-deletion test.")

            # Perform the permanent deletion
            print(f"Deleting employee ID {emp_id} via API...")
            del_res = await client.delete(f"http://127.0.0.1:8000/employees/{emp_id}", headers=headers)
            print("API Response Status:", del_res.status_code)
            print("API Response:", del_res.json())
            assert del_res.status_code == 200

            # 4. Verify all records have been deleted/nullified
            print("Verifying database state...")
            async with AsyncSessionLocal() as db:
                # Assert employee is deleted
                chk_emp = (await db.execute(select(Employee).where(Employee.id == emp_id))).scalar_one_or_none()
                assert chk_emp is None, "Employee still exists!"

                # Assert user is deleted
                chk_usr = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
                assert chk_usr is None, "User login still exists!"

                # Assert attendance is deleted
                chk_att = (await db.execute(select(Attendance).where(Attendance.employee_id == emp_id))).scalars().all()
                assert len(chk_att) == 0, "Attendance logs still exist!"

                # Assert leave requests are deleted
                chk_lr = (await db.execute(select(LeaveRequest).where(LeaveRequest.employee_id == emp_id))).scalars().all()
                assert len(chk_lr) == 0, "Leave requests still exist!"

                # Assert salary structure is deleted
                chk_sal = (await db.execute(select(SalaryStructure).where(SalaryStructure.employee_id == emp_id))).scalar_one_or_none()
                assert chk_sal is None, "Salary structure still exists!"

            print("\nALL VERIFICATIONS PASSED SUCCESSFULLY!")

        except Exception as e:
            print("ERROR IN VERIFICATION:", e)
            raise e

if __name__ == "__main__":
    asyncio.run(main())
