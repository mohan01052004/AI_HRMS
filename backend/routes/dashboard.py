"""
routes/dashboard.py — Role-specific dashboard data endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import date, datetime, timezone, timedelta

from database import get_db, cache_get, cache_set
from models.user import User
from models.employee import Employee, Department
from models.attendance import Attendance, AttendanceStatus
from models.leave import LeaveRequest, LeaveStatus, LeaveType
from models.payroll import Payslip, SalaryStructure, JobPosting, JobStatus, Goal, PerformanceReview
from auth.jwt_handler import get_current_user, require_admin_or_manager

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def _get_employee_for_user(db: AsyncSession, user: User) -> Employee | None:
    result = await db.execute(
        select(Employee).where(Employee.user_id == user.id)
    )
    return result.scalar_one_or_none()


# ─── 1. Admin Dashboard ───────────────────────────────────────────────────────

@router.get("/admin")
async def admin_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("management_admin",):
        raise HTTPException(status_code=403, detail="Admin access required.")

    # TTL cache — 60 seconds, prevents DB storm on busy dashboards
    cache_key = "admin_dashboard"
    cached = cache_get(cache_key)
    if cached:
        return cached

    today = date.today()
    current_month = today.month
    current_year = today.year

    # Total employees
    total_emp = (await db.execute(
        select(func.count(Employee.id)).where(Employee.status == "active")
    )).scalar() or 0

    # Present today
    present_today = (await db.execute(
        select(func.count(Attendance.id)).where(
            and_(Attendance.date == today, Attendance.status == AttendanceStatus.present)
        )
    )).scalar() or 0

    # On leave today (approved leaves spanning today)
    on_leave_today = (await db.execute(
        select(func.count(LeaveRequest.id)).where(
            and_(
                LeaveRequest.status == LeaveStatus.approved,
                LeaveRequest.from_date <= today,
                LeaveRequest.to_date >= today,
            )
        )
    )).scalar() or 0

    # Open positions
    open_positions = (await db.execute(
        select(func.count(JobPosting.id)).where(JobPosting.status == JobStatus.open)
    )).scalar() or 0

    # Pending leaves
    pending_leaves = (await db.execute(
        select(func.count(LeaveRequest.id)).where(LeaveRequest.status == LeaveStatus.pending)
    )).scalar() or 0

    # Payroll this month (sum of net payslips for current month/year)
    payroll_this_month = (await db.execute(
        select(func.coalesce(func.sum(Payslip.net), 0)).where(
            and_(Payslip.month == current_month, Payslip.year == current_year)
        )
    )).scalar() or 0

    # Dept headcount
    dept_rows = (await db.execute(
        select(Department.name, func.count(Employee.id).label("count"))
        .join(Employee, Employee.department_id == Department.id, isouter=True)
        .where(Employee.status == "active")
        .group_by(Department.name)
        .order_by(func.count(Employee.id).desc())
    )).all()
    dept_headcount = [{"name": r.name, "value": r.count} for r in dept_rows]

    # Monthly attendance rate (last 6 months) — % of active employees who clocked in
    monthly_attendance = []
    for i in range(5, -1, -1):
        # Go back i months from today
        first_of_month = (today.replace(day=1) - timedelta(days=i * 28)).replace(day=1)
        m, y = first_of_month.month, first_of_month.year
        # Count distinct employees with attendance record that month
        att_count = (await db.execute(
            select(func.count(func.distinct(Attendance.employee_id))).where(
                and_(
                    func.extract("month", Attendance.date) == m,
                    func.extract("year", Attendance.date) == y,
                    Attendance.status == AttendanceStatus.present,
                )
            )
        )).scalar() or 0
        rate = round((att_count / total_emp * 100) if total_emp else 0, 1)
        monthly_attendance.append({"month": MONTHS_SHORT[m - 1], "rate": rate, "count": att_count})

    result = {
        "total_employees": total_emp,
        "present_today": present_today,
        "on_leave_today": on_leave_today,
        "open_positions": open_positions,
        "pending_leaves": pending_leaves,
        "payroll_this_month": round(payroll_this_month, 2),
        "dept_headcount": dept_headcount,
        "monthly_attendance_rate": monthly_attendance,
    }
    cache_set(cache_key, result)
    return result


# ─── 2. Manager Dashboard ────────────────────────────────────────────────────

@router.get("/manager")
async def manager_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("management_admin", "senior_manager"):
        raise HTTPException(status_code=403, detail="Manager access required.")

    today = date.today()

    # Get the manager's own employee record
    mgr_emp = await _get_employee_for_user(db, current_user)

    # Team = employees whose manager_id matches this employee's id
    if mgr_emp:
        team_result = await db.execute(
            select(Employee.id).where(
                and_(Employee.manager_id == mgr_emp.id, Employee.status == "active")
            )
        )
        team_ids = [r[0] for r in team_result.all()]
    else:
        team_ids = []

    my_team_count = len(team_ids)

    # Team present today
    team_present = 0
    if team_ids:
        team_present = (await db.execute(
            select(func.count(Attendance.id)).where(
                and_(
                    Attendance.employee_id.in_(team_ids),
                    Attendance.date == today,
                    Attendance.status == AttendanceStatus.present,
                )
            )
        )).scalar() or 0

    # Pending leave approvals for team
    pending_approvals = 0
    if team_ids:
        pending_approvals = (await db.execute(
            select(func.count(LeaveRequest.id)).where(
                and_(
                    LeaveRequest.employee_id.in_(team_ids),
                    LeaveRequest.status == LeaveStatus.pending,
                )
            )
        )).scalar() or 0

    # Team average performance rating
    team_perf_avg = 0.0
    if team_ids:
        avg = (await db.execute(
            select(func.avg(PerformanceReview.rating)).where(
                and_(
                    PerformanceReview.employee_id.in_(team_ids),
                    PerformanceReview.rating.isnot(None),
                )
            )
        )).scalar()
        team_perf_avg = round(avg or 0.0, 2)

    return {
        "my_team_count": my_team_count,
        "team_present_today": team_present,
        "pending_approvals": pending_approvals,
        "team_performance_avg": team_perf_avg,
    }


# ─── 3. Recruiter Dashboard ──────────────────────────────────────────────────

@router.get("/recruiter")
async def recruiter_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("management_admin", "hr_recruiter"):
        raise HTTPException(status_code=403, detail="HR/Recruiter access required.")

    today = date.today()

    # Open positions
    open_positions = (await db.execute(
        select(func.count(JobPosting.id)).where(JobPosting.status == JobStatus.open)
    )).scalar() or 0

    # Total applicants = resume screenings stored in MongoDB
    # We use a PostgreSQL-side placeholder; fetch from mongo asynchronously
    from database import get_mongo_db
    mongo_db = get_mongo_db()
    total_applicants = await mongo_db.resume_screenings.count_documents({})

    # Top candidates (top 5 from mongo by score)
    top_cursor = mongo_db.resume_screenings.find(
        {}, {"candidate_name": 1, "score": 1, "recommendation": 1, "job_title": 1, "_id": 0}
    ).sort("score", -1).limit(5)
    top_candidates = await top_cursor.to_list(length=5)

    # Interviews today placeholder (no interview model — use open jobs count as proxy)
    interviews_today = 0

    return {
        "open_positions": open_positions,
        "total_applicants": total_applicants,
        "interviews_today": interviews_today,
        "top_candidates": top_candidates,
    }


# ─── 4. Employee Dashboard ───────────────────────────────────────────────────

@router.get("/employee")
async def employee_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    current_month = today.month
    current_year = today.year

    # Get own employee record
    emp = await _get_employee_for_user(db, current_user)
    if not emp:
        return {
            "my_attendance_this_month": 0,
            "leave_balance": {},
            "latest_payslip_summary": None,
            "my_goals_count": 0,
        }

    # Attendance this month (days present)
    attendance_this_month = (await db.execute(
        select(func.count(Attendance.id)).where(
            and_(
                Attendance.employee_id == emp.id,
                func.extract("month", Attendance.date) == current_month,
                func.extract("year", Attendance.date) == current_year,
                Attendance.status == AttendanceStatus.present,
            )
        )
    )).scalar() or 0

    # Leave balance: fetch all leave types, calculate approved days used
    leave_types_result = await db.execute(select(LeaveType))
    leave_types = leave_types_result.scalars().all()

    leave_balance = {}
    for lt in leave_types:
        used_result = await db.execute(
            select(LeaveRequest).where(
                and_(
                    LeaveRequest.employee_id == emp.id,
                    LeaveRequest.leave_type_id == lt.id,
                    LeaveRequest.status == LeaveStatus.approved,
                    func.extract("year", LeaveRequest.from_date) == current_year,
                )
            )
        )
        used_leaves = used_result.scalars().all()
        used_days = sum(
            (lr.to_date - lr.from_date).days + 1 for lr in used_leaves
        )
        leave_balance[lt.name] = {
            "allowed": lt.days_allowed,
            "used": used_days,
            "remaining": max(lt.days_allowed - used_days, 0),
        }

    # Latest payslip summary
    payslip_result = await db.execute(
        select(Payslip)
        .where(Payslip.employee_id == emp.id)
        .order_by(Payslip.year.desc(), Payslip.month.desc())
        .limit(1)
    )
    latest_payslip = payslip_result.scalar_one_or_none()
    payslip_summary = None
    if latest_payslip:
        payslip_summary = {
            "month": MONTHS_SHORT[latest_payslip.month - 1],
            "year": latest_payslip.year,
            "gross": latest_payslip.gross,
            "deductions": latest_payslip.deductions,
            "net": latest_payslip.net,
        }

    # Goals count (active)
    goals_count = (await db.execute(
        select(func.count(Goal.id)).where(
            and_(
                Goal.employee_id == emp.id,
                Goal.status.in_(["not_started", "in_progress"]),
            )
        )
    )).scalar() or 0

    return {
        "my_attendance_this_month": attendance_this_month,
        "leave_balance": leave_balance,
        "latest_payslip_summary": payslip_summary,
        "my_goals_count": goals_count,
    }


# ─── 5. Admin: Per-Employee Drill-Down Dashboard ──────────────────────────────

@router.get("/employee/{employee_id}")
async def employee_detail_dashboard(
    employee_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Full activity dashboard for a specific employee.
    Accessible by: management_admin, senior_manager, hr_recruiter.
    Returns: profile, 6-month attendance trend, leave balance,
             goals, performance reviews, payroll history.
    """
    if current_user.role not in ("management_admin", "senior_manager", "hr_recruiter"):
        raise HTTPException(status_code=403, detail="Management access required.")

    # Get the employee
    from sqlalchemy.orm import selectinload
    emp_result = await db.execute(
        select(Employee)
        .options(selectinload(Employee.department))
        .where(Employee.id == employee_id)
    )
    emp = emp_result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found.")

    today = date.today()
    current_month = today.month
    current_year = today.year

    # ── Attendance: last 6 months trend ──────────────────────────────────────
    attendance_trend = []
    for i in range(5, -1, -1):
        first_of_month = (today.replace(day=1) - timedelta(days=i * 28)).replace(day=1)
        m, y = first_of_month.month, first_of_month.year
        days_present = (await db.execute(
            select(func.count(Attendance.id)).where(
                and_(
                    Attendance.employee_id == employee_id,
                    func.extract("month", Attendance.date) == m,
                    func.extract("year", Attendance.date) == y,
                    Attendance.status == AttendanceStatus.present,
                )
            )
        )).scalar() or 0
        days_late = (await db.execute(
            select(func.count(Attendance.id)).where(
                and_(
                    Attendance.employee_id == employee_id,
                    func.extract("month", Attendance.date) == m,
                    func.extract("year", Attendance.date) == y,
                    Attendance.status == AttendanceStatus.late,
                )
            )
        )).scalar() or 0
        attendance_trend.append({
            "month": MONTHS_SHORT[m - 1],
            "year": y,
            "present": days_present,
            "late": days_late,
            "total": days_present + days_late,
        })

    # ── Attendance this month ─────────────────────────────────────────────────
    attendance_this_month = (await db.execute(
        select(func.count(Attendance.id)).where(
            and_(
                Attendance.employee_id == employee_id,
                func.extract("month", Attendance.date) == current_month,
                func.extract("year", Attendance.date) == current_year,
                Attendance.status.in_([AttendanceStatus.present, AttendanceStatus.late]),
            )
        )
    )).scalar() or 0

    # ── Leave balance ─────────────────────────────────────────────────────────
    leave_types_result = await db.execute(select(LeaveType))
    leave_types = leave_types_result.scalars().all()
    leave_balance = {}
    for lt in leave_types:
        used_result = await db.execute(
            select(LeaveRequest).where(
                and_(
                    LeaveRequest.employee_id == employee_id,
                    LeaveRequest.leave_type_id == lt.id,
                    LeaveRequest.status == LeaveStatus.approved,
                    func.extract("year", LeaveRequest.from_date) == current_year,
                )
            )
        )
        used_days = sum(
            (lr.to_date - lr.from_date).days + 1 for lr in used_result.scalars().all()
        )
        leave_balance[lt.name] = {
            "allowed": lt.days_allowed,
            "used": used_days,
            "remaining": max(lt.days_allowed - used_days, 0),
        }

    # ── Goals ─────────────────────────────────────────────────────────────────
    goals_result = await db.execute(
        select(Goal)
        .where(Goal.employee_id == employee_id)
        .order_by(Goal.created_at.desc())
        .limit(5)
    )
    goals = [
        {
            "id": g.id,
            "title": g.title,
            "status": g.status,
            "progress": g.progress,
            "target_date": str(g.target_date) if g.target_date else None,
        }
        for g in goals_result.scalars().all()
    ]

    # ── Performance reviews ───────────────────────────────────────────────────
    reviews_result = await db.execute(
        select(PerformanceReview)
        .where(PerformanceReview.employee_id == employee_id)
        .order_by(PerformanceReview.created_at.desc())
        .limit(5)
    )
    reviews = [
        {
            "id": r.id,
            "period": r.period,
            "rating": r.rating,
            "comments": r.comments,
        }
        for r in reviews_result.scalars().all()
    ]
    rated_reviews = [r["rating"] for r in reviews if r["rating"] is not None]
    avg_rating = round(sum(rated_reviews) / len(rated_reviews), 2) if rated_reviews else None

    # ── Payroll history (last 6 months) ──────────────────────────────────────
    payslips_result = await db.execute(
        select(Payslip)
        .where(Payslip.employee_id == employee_id)
        .order_by(Payslip.year.desc(), Payslip.month.desc())
        .limit(6)
    )
    payroll_history = [
        {
            "month": MONTHS_SHORT[p.month - 1],
            "year": p.year,
            "gross": p.gross,
            "deductions": p.deductions,
            "net": p.net,
        }
        for p in payslips_result.scalars().all()
    ]

    return {
        "employee": {
            "id": emp.id,
            "name": emp.name,
            "email": emp.email,
            "designation": emp.designation,
            "department": emp.department.name if emp.department else None,
            "status": emp.status,
            "join_date": str(emp.date_of_joining) if emp.date_of_joining else None,
            "phone": emp.phone,
        },
        "attendance_this_month": attendance_this_month,
        "attendance_trend": attendance_trend,
        "leave_balance": leave_balance,
        "goals": goals,
        "reviews": reviews,
        "avg_rating": avg_rating,
        "payroll_history": payroll_history,
    }
