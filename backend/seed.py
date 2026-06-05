"""
seed.py — Seed the database with demo users, departments, employees, and sample data.
Run once after starting the backend: python seed.py
"""
import sys
import io
# Force UTF-8 output on Windows to avoid cp1252 UnicodeEncodeError with emoji
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import AsyncSessionLocal, init_db, get_settings
from models.user import User, UserRole
from models.employee import Employee, Department, EmployeeStatus
from models.leave import LeaveType
from models.payroll import (
    SalaryStructure, JobPosting, JobStatus,
    Goal, GoalStatus, PerformanceReview, OnboardingTask,
)
from models.attendance import Attendance, AttendanceStatus
from auth.jwt_handler import hash_password
from datetime import date, time, datetime, timezone, timedelta
import random

settings = get_settings()


DEMO_USERS = [
    {
        "name": "Arjun Sharma",
        "email": "admin@hrms.com",
        "password": "HrMs@2026!Sec",
        "role": UserRole.management_admin,
    },
    {
        "name": "Priya Mehta",
        "email": "manager@hrms.com",
        "password": "HrMs@2026!Sec",
        "role": UserRole.senior_manager,
    },
    {
        "name": "Ravi Kumar",
        "email": "hr@hrms.com",
        "password": "HrMs@2026!Sec",
        "role": UserRole.hr_recruiter,
    },
    {
        "name": "Sneha Patel",
        "email": "emp@hrms.com",
        "password": "HrMs@2026!Sec",
        "role": UserRole.employee,
    },
    {
        "name": "Amit Singh",
        "email": "amit@hrms.com",
        "password": "HrMs@2026!Sec",
        "role": UserRole.employee,
    },
    {
        "name": "Deepika Nair",
        "email": "deepika@hrms.com",
        "password": "HrMs@2026!Sec",
        "role": UserRole.employee,
    },
]

DEPARTMENTS = [
    "Engineering",
    "Human Resources",
    "Sales & Marketing",
    "Finance",
    "Operations",
    "Product Management",
]

LEAVE_TYPES = [
    {"name": "Annual Leave", "days_allowed": 18, "is_paid": True},
    {"name": "Sick Leave", "days_allowed": 12, "is_paid": True},
    {"name": "Casual Leave", "days_allowed": 6, "is_paid": True},
    {"name": "Maternity Leave", "days_allowed": 180, "is_paid": True},
    {"name": "Paternity Leave", "days_allowed": 15, "is_paid": True},
    {"name": "Unpaid Leave", "days_allowed": 30, "is_paid": False},
]

JOB_POSTINGS = [
    {
        "title": "Senior React Developer",
        "description": "We are looking for a Senior React Developer to join our growing engineering team. You will be responsible for building and maintaining high-quality web applications.",
        "requirements": "5+ years React, TypeScript, Redux, REST APIs, Jest/Testing",
        "location": "Remote / Bengaluru",
        "salary_range": "₹18L - ₹28L",
    },
    {
        "title": "Python Backend Engineer",
        "description": "Join our backend team to build scalable Python FastAPI services. Work with PostgreSQL, MongoDB, and cloud infrastructure.",
        "requirements": "3+ years Python, FastAPI or Django, PostgreSQL, MongoDB, Docker",
        "location": "Hyderabad / Remote",
        "salary_range": "₹15L - ₹22L",
    },
    {
        "title": "HR Business Partner",
        "description": "Drive HR strategy, talent acquisition, and employee engagement across business units.",
        "requirements": "5+ years HR, SHRM/HRCI certification preferred, people analytics",
        "location": "Mumbai",
        "salary_range": "₹12L - ₹18L",
    },
    {
        "title": "Data Scientist",
        "description": "Build ML models and analytics pipelines to drive business insights.",
        "requirements": "3+ years ML, Python, SQL, TensorFlow/PyTorch, communication skills",
        "location": "Bengaluru",
        "salary_range": "₹20L - ₹35L",
    },
]


async def seed(db: AsyncSession):
    print("\n[SEED] Seeding AI-HRMS database...\n")

    # ─── Departments ──────────────────────────────────────────────────────────
    print("  [DIR] Creating departments...")
    dept_objects = []
    for dept_name in DEPARTMENTS:
        result = await db.execute(select(Department).where(Department.name == dept_name))
        dept = result.scalar_one_or_none()
        if not dept:
            dept = Department(name=dept_name)
            db.add(dept)
            await db.flush()
        dept_objects.append(dept)
    print(f"     ✓ {len(dept_objects)} departments ready")

    # ─── Users ───────────────────────────────────────────────────────────────
    print("  [USER] Creating demo users...")
    user_objects = []
    for u in DEMO_USERS:
        result = await db.execute(select(User).where(User.email == u["email"]))
        user = result.scalar_one_or_none()
        if not user:
            user = User(
                name=u["name"],
                email=u["email"],
                password_hash=hash_password(u["password"]),
                role=u["role"],
            )
            db.add(user)
            await db.flush()
        else:
            user.password_hash = hash_password(u["password"])
            db.add(user)
            await db.flush()
        user_objects.append(user)
    print(f"     ✓ {len(user_objects)} users ready")

    # ─── Employees ───────────────────────────────────────────────────────────
    print("  [EMP] Creating employees...")
    EMPLOYEE_DATA = [
        {"name": "Arjun Sharma", "email": "admin@hrms.com", "designation": "CTO", "dept_idx": 0, "salary": 250000, "user_idx": 0, "gender": "male"},
        {"name": "Priya Mehta", "email": "manager@hrms.com", "designation": "Engineering Manager", "dept_idx": 0, "salary": 180000, "user_idx": 1, "gender": "female"},
        {"name": "Ravi Kumar", "email": "hr@hrms.com", "designation": "HR Manager", "dept_idx": 1, "salary": 120000, "user_idx": 2, "gender": "male"},
        {"name": "Sneha Patel", "email": "emp@hrms.com", "designation": "Software Engineer", "dept_idx": 0, "salary": 95000, "user_idx": 3, "gender": "female"},
        {"name": "Amit Singh", "email": "amit@hrms.com", "designation": "Sales Executive", "dept_idx": 2, "salary": 75000, "user_idx": 4, "gender": "male"},
        {"name": "Deepika Nair", "email": "deepika@hrms.com", "designation": "Product Manager", "dept_idx": 5, "salary": 150000, "user_idx": 5, "gender": "female"},
        {"name": "Karan Verma", "email": "karan@hrms.com", "designation": "Data Engineer", "dept_idx": 0, "salary": 110000, "user_idx": None, "gender": "male"},
        {"name": "Anjali Rao", "email": "anjali@hrms.com", "designation": "Finance Analyst", "dept_idx": 3, "salary": 85000, "user_idx": None, "gender": "female"},
        {"name": "Suresh Babu", "email": "suresh@hrms.com", "designation": "DevOps Engineer", "dept_idx": 0, "salary": 100000, "user_idx": None, "gender": "male"},
        {"name": "Meera Iyer", "email": "meera@hrms.com", "designation": "UI/UX Designer", "dept_idx": 5, "salary": 90000, "user_idx": None, "gender": "female"},
    ]

    ROLE_PREFIX = {
        UserRole.management_admin: "ADM",
        UserRole.senior_manager:   "MGR",
        UserRole.hr_recruiter:     "HR",
        UserRole.employee:         "EMP",
    }

    emp_objects = []
    counters = {"ADM": 0, "MGR": 0, "HR": 0, "EMP": 0}
    for i, emp_data in enumerate(EMPLOYEE_DATA):
        result = await db.execute(select(Employee).where(Employee.email == emp_data["email"]))
        emp = result.scalar_one_or_none()
        
        # Determine prefix for this employee code
        role = UserRole.employee
        if emp_data["user_idx"] is not None:
            role = DEMO_USERS[emp_data["user_idx"]]["role"]
        prefix = ROLE_PREFIX.get(role, "EMP")
        counters[prefix] += 1
        emp_code = f"{prefix}-{str(counters[prefix]).zfill(4)}"

        if not emp:
            emp = Employee(
                name=emp_data["name"],
                email=emp_data["email"],
                employee_code=emp_code,
                designation=emp_data["designation"],
                department_id=dept_objects[emp_data["dept_idx"]].id,
                salary=emp_data["salary"],
                user_id=user_objects[emp_data["user_idx"]].id if emp_data["user_idx"] is not None else None,
                date_of_joining=date(2022 + (i % 3), (i % 12) + 1, max(1, (i * 3) % 28)),
                phone=f"+91 9{random.randint(100000000, 999999999)}",
                status=EmployeeStatus.active,
                gender=emp_data["gender"],
                is_approved=True,
            )

            db.add(emp)
            await db.flush()
        else:
            # Update gender and employee_code for existing seeded employees if not set
            if not emp.gender or not emp.employee_code:
                if not emp.gender:
                    emp.gender = emp_data["gender"]
                if not emp.employee_code:
                    emp.employee_code = emp_code
                db.add(emp)
                await db.flush()
        emp_objects.append(emp)

    print(f"     ✓ {len(emp_objects)} employees ready")

    # ─── Salary Structures ────────────────────────────────────────────────────
    print("  [PAY] Creating salary structures...")
    for emp in emp_objects:
        result = await db.execute(select(SalaryStructure).where(SalaryStructure.employee_id == emp.id))
        ss = result.scalar_one_or_none()
        if not ss:
            basic = emp.salary * 0.5
            hra = emp.salary * 0.2
            allowances = emp.salary * 0.2
            deductions = emp.salary * 0.1
            ss = SalaryStructure(
                employee_id=emp.id,
                basic=basic,
                hra=hra,
                allowances=allowances,
                deductions=deductions,
            )
            db.add(ss)
    await db.flush()
    print(f"     ✓ salary structures created")

    # ─── Leave Types ──────────────────────────────────────────────────────────
    print("  [LEAVE] Creating leave types...")
    for lt_data in LEAVE_TYPES:
        result = await db.execute(select(LeaveType).where(LeaveType.name == lt_data["name"]))
        lt = result.scalar_one_or_none()
        if not lt:
            lt = LeaveType(**lt_data)
            db.add(lt)
    await db.flush()
    print(f"     ✓ {len(LEAVE_TYPES)} leave types ready")

    # ─── Attendance Records (last 14 days) ────────────────────────────────────
    print("  [ATT] Creating attendance records...")
    att_count = 0
    today = date.today()
    for emp in emp_objects[:5]:  # First 5 employees
        for days_back in range(14, 0, -1):
            record_date = today - timedelta(days=days_back)
            if record_date.weekday() >= 5:  # Skip weekends
                continue
            result = await db.execute(
                select(Attendance).where(
                    Attendance.employee_id == emp.id,
                    Attendance.date == record_date,
                )
            )
            if result.scalar_one_or_none():
                continue

            # Random attendance
            rand = random.random()
            if rand > 0.9:
                status = AttendanceStatus.absent
                att = Attendance(employee_id=emp.id, date=record_date, status=status, hours_worked=0)
            elif rand > 0.8:
                clock_in = time(9, random.randint(31, 59))
                clock_out = time(18, random.randint(0, 30))
                hours = round((datetime.combine(record_date, clock_out) - datetime.combine(record_date, clock_in)).total_seconds() / 3600, 2)
                att = Attendance(employee_id=emp.id, date=record_date, clock_in=clock_in, clock_out=clock_out, status=AttendanceStatus.late, hours_worked=hours)
            else:
                clock_in = time(9, random.randint(0, 25))
                clock_out = time(17, random.randint(30, 59))
                hours = round((datetime.combine(record_date, clock_out) - datetime.combine(record_date, clock_in)).total_seconds() / 3600, 2)
                att = Attendance(employee_id=emp.id, date=record_date, clock_in=clock_in, clock_out=clock_out, status=AttendanceStatus.present, hours_worked=hours)
            db.add(att)
            att_count += 1
    await db.flush()
    print(f"     ✓ {att_count} attendance records created")

    # ─── Job Postings ─────────────────────────────────────────────────────────
    print("  [JOB] Creating job postings...")
    for jp_data in JOB_POSTINGS:
        result = await db.execute(select(JobPosting).where(JobPosting.title == jp_data["title"]))
        if not result.scalar_one_or_none():
            jp = JobPosting(
                **jp_data,
                department_id=dept_objects[0].id,
                status=JobStatus.open,
                created_by=user_objects[2].id,  # HR user
            )
            db.add(jp)
    await db.flush()
    print(f"     ✓ {len(JOB_POSTINGS)} job postings ready")

    # ─── Goals ───────────────────────────────────────────────────────────────
    print("  [GOAL] Creating goals...")
    GOALS = [
        {"emp_idx": 3, "title": "Complete AWS Certification", "description": "Pass AWS Solutions Architect exam", "progress": 65, "status": GoalStatus.in_progress},
        {"emp_idx": 3, "title": "Improve Code Coverage to 90%", "description": "Add unit tests across all modules", "progress": 40, "status": GoalStatus.in_progress},
        {"emp_idx": 4, "title": "Achieve Q2 Sales Target", "description": "Reach ₹50L in sales by end of Q2", "progress": 72, "status": GoalStatus.in_progress},
        {"emp_idx": 1, "title": "Hire 5 Engineers", "description": "Complete hiring for the platform team", "progress": 100, "status": GoalStatus.completed},
        {"emp_idx": 5, "title": "Launch Mobile App v2.0", "description": "Ship mobile app with new onboarding flow", "progress": 85, "status": GoalStatus.in_progress},
    ]
    for g in GOALS:
        goal = Goal(
            employee_id=emp_objects[g["emp_idx"]].id,
            title=g["title"],
            description=g["description"],
            progress=g["progress"],
            status=g["status"],
            target_date=date(2026, 9, 30),
        )
        db.add(goal)
    await db.flush()
    print(f"     ✓ {len(GOALS)} goals created")

    # ─── Performance Reviews ──────────────────────────────────────────────────
    print("  [REVIEW] Creating performance reviews...")
    REVIEWS = [
        {"emp_idx": 3, "period": "Q1 2026", "rating": 4.2, "comments": "Excellent performance in the React migration project. Great team collaboration and delivered ahead of schedule."},
        {"emp_idx": 4, "period": "Q1 2026", "rating": 3.8, "comments": "Good sales performance, exceeded targets by 12%. Needs improvement in CRM documentation."},
        {"emp_idx": 5, "period": "Q1 2026", "rating": 4.5, "comments": "Outstanding product leadership. Successfully launched 3 key features and improved NPS by 8 points."},
    ]
    for r in REVIEWS:
        review = PerformanceReview(
            employee_id=emp_objects[r["emp_idx"]].id,
            reviewer_id=user_objects[1].id,
            period=r["period"],
            rating=r["rating"],
            comments=r["comments"],
        )
        db.add(review)
    await db.flush()
    print(f"     ✓ {len(REVIEWS)} performance reviews created")

    # ─── Onboarding Tasks ─────────────────────────────────────────────────────
    print("  [ONBOARD] Creating onboarding tasks...")
    ONBOARDING_TASKS = [
        {"task_name": "Complete employment documentation", "description": "Sign offer letter, NDA, and compliance forms", "is_completed": 1},
        {"task_name": "IT equipment setup", "description": "Laptop setup, email credentials, and software installation", "is_completed": 1},
        {"task_name": "Office tour and introductions", "description": "Meet the team and facility walkthrough", "is_completed": 1},
        {"task_name": "HR policies handbook review", "description": "Read and acknowledge the employee handbook", "is_completed": 0},
        {"task_name": "Benefits enrollment", "description": "Select health insurance, PF, and other benefits", "is_completed": 0},
        {"task_name": "Security access and badge", "description": "Office badge and VPN access setup", "is_completed": 0},
    ]
    new_emp = emp_objects[-1]  # Meera Iyer as new employee
    for task_data in ONBOARDING_TASKS:
        task = OnboardingTask(
            employee_id=new_emp.id,
            task_name=task_data["task_name"],
            description=task_data["description"],
            is_completed=task_data["is_completed"],
            due_date=date.today() + timedelta(days=7),
            completed_at=datetime.now(timezone.utc) if task_data["is_completed"] else None,
        )
        db.add(task)
    await db.flush()
    print(f"     ✓ {len(ONBOARDING_TASKS)} onboarding tasks created for {new_emp.name}")

    await db.commit()

    print("\nOK Database seeded successfully!\n")
    print("=" * 50)
    print("DEMO LOGIN CREDENTIALS")
    print("=" * 50)
    for u in DEMO_USERS:
        print(f"  {u['role'].value:<22} {u['email']:<30} password: {u['password']}")
    print("=" * 50)
    print("\n[WEB] Frontend: http://localhost:5173")
    print("[DOCS] API Docs: http://localhost:8000/docs")
    print()


async def main():
    print("[INIT] Initializing database tables...")
    await init_db()
    async with AsyncSessionLocal() as db:
        await seed(db)


if __name__ == "__main__":
    asyncio.run(main())
