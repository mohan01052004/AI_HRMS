"""
routes/attendance.py — Complete Attendance Management API

Endpoints:
  POST /attendance/clockin       — clock in for current user's employee record
  POST /attendance/clockout      — clock out, auto-calculates hours_worked
  GET  /attendance/today         — today's attendance status for current user
  GET  /attendance/my            — monthly records for current user (?month=2026-06)
  GET  /attendance/all           — all employees for a date (?date=2026-06-01) [Admin/Manager]
  GET  /attendance/summary       — monthly status counts (dashboard)
  POST /attendance               — manual entry [Admin/Manager]
  DELETE /attendance/{id}        — delete record [Admin/Manager]
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, extract
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import date, datetime, time, timezone

from database import get_db
from models.attendance import Attendance, AttendanceStatus
from models.employee import Employee, Department
from models.user import User
from schemas.attendance import AttendanceCreate, AttendanceOut, ClockInOut
from auth.jwt_handler import get_current_user, require_admin_or_manager
from websocket_manager import manager as ws_manager

router = APIRouter(prefix="/attendance", tags=["Attendance"])

# Late threshold — after 09:30 local time = late
LATE_THRESHOLD = time(9, 30)


# ─── Helpers ─────────────────────────────────────────────────────────────────

async def _get_employee_for_user(user: User, db: AsyncSession) -> Employee:
    """Resolve the Employee record linked to a User account."""
    result = await db.execute(
        select(Employee).where(Employee.user_id == user.id)
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "No employee record is linked to your user account. "
                "Please contact HR to link your account."
            ),
        )
    return emp


async def _get_today_record(
    employee_id: int, db: AsyncSession
) -> Optional[Attendance]:
    """Return today's attendance record for an employee, or None."""
    result = await db.execute(
        select(Attendance).where(
            and_(
                Attendance.employee_id == employee_id,
                Attendance.date == date.today(),
            )
        )
    )
    return result.scalar_one_or_none()


def _local_time() -> time:
    """Return current local time (without timezone info) for clock storage."""
    return datetime.now().time().replace(microsecond=0)


# ─── Clock In ────────────────────────────────────────────────────────────────

@router.post("/clockin", response_model=AttendanceOut, summary="Clock in for the current user")
async def clock_in(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Record clock-in for the authenticated user's linked employee.
    - Only one clock-in per day is allowed.
    - Status is set to `present` if before 09:30, otherwise `late`.
    """
    emp = await _get_employee_for_user(current_user, db)

    existing = await _get_today_record(emp.id, db)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already clocked in today.",
        )

    now = _local_time()
    att_status = AttendanceStatus.late if now > LATE_THRESHOLD else AttendanceStatus.present

    record = Attendance(
        employee_id=emp.id,
        date=date.today(),
        clock_in=now,
        status=att_status,
        hours_worked=0.0,
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)

    # Broadcast real-time clock-in event to all connected admins/managers
    import asyncio
    asyncio.create_task(ws_manager.broadcast("attendance_update", {
        "action": "clock_in",
        "employee_id": emp.id,
        "employee_name": emp.name,
        "status": att_status.value,
        "time": str(now),
    }))

    return record


# ─── Clock Out ───────────────────────────────────────────────────────────────

@router.post("/clockout", response_model=AttendanceOut, summary="Clock out for the current user")
async def clock_out(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Record clock-out for the authenticated user's linked employee.
    Automatically calculates `hours_worked` from clock_in to now.
    """
    emp = await _get_employee_for_user(current_user, db)

    record = await _get_today_record(emp.id, db)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="You haven't clocked in today. Please clock in first.",
        )
    if record.clock_out:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already clocked out today.",
        )

    now = _local_time()
    record.clock_out = now

    # Calculate hours worked
    if record.clock_in:
        today = date.today()
        ci = datetime.combine(today, record.clock_in)
        co = datetime.combine(today, now)
        record.hours_worked = max(0.0, round((co - ci).total_seconds() / 3600, 2))

        # Downgrade to half_day if worked < 4 hours
        if record.hours_worked < 4.0:
            record.status = AttendanceStatus.half_day

    db.add(record)
    await db.flush()
    await db.refresh(record)

    # Broadcast real-time clock-out event
    import asyncio
    asyncio.create_task(ws_manager.broadcast("attendance_update", {
        "action": "clock_out",
        "employee_id": emp.id,
        "employee_name": emp.name,
        "hours_worked": record.hours_worked,
        "time": str(now),
    }))

    return record


# ─── Today's Status (current user) ───────────────────────────────────────────

@router.get("/today", summary="Get today's attendance for the current user")
async def get_today(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns today's attendance record for the logged-in user.
    If no record exists, returns a `not_started` status object.
    """
    emp = await _get_employee_for_user(current_user, db)
    record = await _get_today_record(emp.id, db)

    if not record:
        return {
            "employee_id":  emp.id,
            "employee_name": emp.name,
            "date":         date.today().isoformat(),
            "status":       "not_started",
            "clock_in":     None,
            "clock_out":    None,
            "hours_worked": 0.0,
            "can_clock_in":  True,
            "can_clock_out": False,
        }

    return {
        "id":            record.id,
        "employee_id":   record.employee_id,
        "employee_name": emp.name,
        "date":          record.date.isoformat(),
        "status":        record.status,
        "clock_in":      record.clock_in.strftime("%H:%M:%S") if record.clock_in else None,
        "clock_out":     record.clock_out.strftime("%H:%M:%S") if record.clock_out else None,
        "hours_worked":  record.hours_worked,
        "can_clock_in":  False,
        "can_clock_out": record.clock_in is not None and record.clock_out is None,
    }


# ─── My Monthly Records ───────────────────────────────────────────────────────

@router.get("/my", response_model=List[AttendanceOut], summary="Current user's monthly attendance")
async def get_my_attendance(
    month: str = Query(..., description="Month in YYYY-MM format, e.g. 2026-06"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns all attendance records for the current user in a given month.
    Used to build the calendar heatmap on the frontend.
    """
    emp = await _get_employee_for_user(current_user, db)

    try:
        year, mon = map(int, month.split("-"))
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=400,
            detail="Invalid month format. Use YYYY-MM (e.g. 2026-06).",
        )

    result = await db.execute(
        select(Attendance)
        .where(
            and_(
                Attendance.employee_id == emp.id,
                extract("year", Attendance.date)  == year,
                extract("month", Attendance.date) == mon,
            )
        )
        .order_by(Attendance.date)
    )
    records = result.scalars().all()

    # Also compute summary counts alongside — returned as custom header X-Summary
    # (actual summary is part of the /my/summary endpoint)
    return records


@router.get("/my/summary", summary="Monthly summary stats for current user")
async def get_my_summary(
    month: str = Query(..., description="Month in YYYY-MM format"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns aggregated monthly attendance stats for the current user:
    present_days, late_days, absent_days, half_days, total_hours_worked.
    """
    emp = await _get_employee_for_user(current_user, db)

    try:
        year, mon = map(int, month.split("-"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid month format. Use YYYY-MM.")

    import calendar
    working_days_in_month = sum(
        1 for d in range(1, calendar.monthrange(year, mon)[1] + 1)
        if datetime(year, mon, d).weekday() < 5  # Mon-Fri
    )

    rows = await db.execute(
        select(Attendance.status, func.count(Attendance.id), func.sum(Attendance.hours_worked))
        .where(
            and_(
                Attendance.employee_id == emp.id,
                extract("year", Attendance.date) == year,
                extract("month", Attendance.date) == mon,
            )
        )
        .group_by(Attendance.status)
    )

    stats: dict = {s.value: {"count": 0, "hours": 0.0} for s in AttendanceStatus}
    for row in rows:
        status_val, count, hours = row
        stats[status_val] = {"count": count, "hours": round(hours or 0, 2)}

    present_days = stats["present"]["count"] + stats["late"]["count"] + stats["half_day"]["count"]
    total_hours  = sum(v["hours"] for v in stats.values())

    return {
        "month":               month,
        "employee_id":         emp.id,
        "working_days":        working_days_in_month,
        "present_days":        present_days,
        "late_days":           stats["late"]["count"],
        "absent_days":         max(0, working_days_in_month - present_days),
        "half_days":           stats["half_day"]["count"],
        "wfh_days":            stats["work_from_home"]["count"],
        "total_hours_worked":  round(total_hours, 2),
        "avg_hours_per_day":   round(total_hours / present_days, 2) if present_days else 0,
        "attendance_pct":      round(present_days / working_days_in_month * 100, 1)
                               if working_days_in_month else 0,
    }


# ─── All Employees — Admin/Manager view ──────────────────────────────────────

@router.get("/all", summary="All employees' attendance for a specific date [Admin/Manager]")
async def get_all_attendance(
    date_filter: date = Query(..., alias="date", description="Date in YYYY-MM-DD format"),
    department_id: Optional[int] = Query(None, description="Filter by department ID"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_or_manager),
):
    """
    Returns all employees' attendance status for a given date.
    Includes employees with no record (shown as absent).
    Filterable by department.
    """
    # Fetch all employees (with dept filter)
    emp_query = (
        select(Employee)
        .options(selectinload(Employee.department))
        .where(Employee.status == "active")
        .order_by(Employee.name)
    )
    if department_id:
        emp_query = emp_query.where(Employee.department_id == department_id)

    emp_result = await db.execute(emp_query)
    employees  = emp_result.scalars().all()

    # Fetch all attendance records for that date
    att_result = await db.execute(
        select(Attendance).where(Attendance.date == date_filter)
    )
    att_records = {r.employee_id: r for r in att_result.scalars().all()}

    # Merge: every employee gets a record (absent if missing)
    output = []
    for emp in employees:
        rec = att_records.get(emp.id)
        output.append({
            "employee_id":   emp.id,
            "employee_name": emp.name,
            "department":    emp.department.name if emp.department else None,
            "designation":   emp.designation,
            "date":          date_filter.isoformat(),
            "status":        rec.status        if rec else "absent",
            "clock_in":      rec.clock_in.strftime("%H:%M") if rec and rec.clock_in  else None,
            "clock_out":     rec.clock_out.strftime("%H:%M") if rec and rec.clock_out else None,
            "hours_worked":  rec.hours_worked  if rec else 0.0,
            "record_id":     rec.id            if rec else None,
        })

    # Summary counts
    status_counts = {}
    for row in output:
        s = row["status"]
        status_counts[s] = status_counts.get(s, 0) + 1

    return {
        "date":          date_filter.isoformat(),
        "total":         len(output),
        "status_counts": status_counts,
        "records":       output,
    }


# ─── Monthly Summary (dashboard chart) ───────────────────────────────────────

@router.get("/summary", summary="Monthly attendance status counts")
async def attendance_summary(
    month: int = Query(..., ge=1, le=12),
    year:  int = Query(..., ge=2000),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Aggregated status counts for a month. Used by the Dashboard chart."""
    result = await db.execute(
        select(Attendance.status, func.count(Attendance.id))
        .where(
            and_(
                extract("month", Attendance.date) == month,
                extract("year",  Attendance.date) == year,
            )
        )
        .group_by(Attendance.status)
    )
    return {row[0]: row[1] for row in result}


# ─── Manual Entry / Delete (Admin/Manager) ────────────────────────────────────

@router.post("", response_model=AttendanceOut, status_code=201,
             summary="Manual attendance entry [Admin/Manager]")
async def create_attendance(
    payload: AttendanceCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_or_manager),
):
    """Create or correct an attendance record manually."""
    # Check for duplicate
    existing = await db.execute(
        select(Attendance).where(
            and_(
                Attendance.employee_id == payload.employee_id,
                Attendance.date == payload.date,
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail=f"Attendance record already exists for employee {payload.employee_id} on {payload.date}.",
        )
    record = Attendance(**payload.model_dump())
    db.add(record)
    await db.flush()
    await db.refresh(record)
    return record


@router.delete("/{record_id}", status_code=204,
               summary="Delete attendance record [Admin/Manager]")
async def delete_attendance(
    record_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_or_manager),
):
    result = await db.execute(select(Attendance).where(Attendance.id == record_id))
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found.")
    await db.delete(record)
