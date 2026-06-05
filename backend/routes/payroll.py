"""
routes/payroll.py — Salary structures and payslip generation
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from typing import List, Optional

from database import get_db
from models.payroll import SalaryStructure, Payslip
from models.employee import Employee, Department, EmployeeStatus
from models.user import User
from schemas.payroll import (
    SalaryStructureCreate, SalaryStructureOut,
    PayslipOut,
)
from auth.jwt_handler import get_current_user, require_admin, require_hr

router = APIRouter(prefix="/payroll", tags=["Payroll"])


# ─── Salary Structures ────────────────────────────────────────────────────────

@router.get("/salary-structure/{employee_id}", response_model=SalaryStructureOut)
async def get_salary_structure(
    employee_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_hr),
):
    result = await db.execute(
        select(SalaryStructure).where(SalaryStructure.employee_id == employee_id)
    )
    ss = result.scalar_one_or_none()
    if not ss:
        raise HTTPException(status_code=404, detail="Salary structure not found.")
    return ss


@router.post("/salary-structure", response_model=SalaryStructureOut, status_code=201)
async def create_salary_structure(
    payload: SalaryStructureCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    # Check if already exists — if so, update
    result = await db.execute(
        select(SalaryStructure).where(
            SalaryStructure.employee_id == payload.employee_id
        )
    )
    ss = result.scalar_one_or_none()
    if ss:
        for k, v in payload.model_dump(exclude={"employee_id"}).items():
            setattr(ss, k, v)
    else:
        ss = SalaryStructure(**payload.model_dump())
        db.add(ss)
    await db.flush()
    await db.refresh(ss)
    return ss


# ─── Payslips ─────────────────────────────────────────────────────────────────

@router.get("/my", response_model=List[PayslipOut])
async def list_my_payslips(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve payslips for the logged-in user."""
    result = await db.execute(
        select(Employee).where(Employee.user_id == current_user.id)
    )
    emp = result.scalar_one_or_none()
    if not emp:
        return []

    result = await db.execute(
        select(Payslip)
        .where(Payslip.employee_id == emp.id)
        .order_by(Payslip.year.desc(), Payslip.month.desc())
    )
    return result.scalars().all()


@router.get("/all")
async def list_all_payslips(
    month: int = Query(...),
    year: int = Query(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_hr),
):
    """Get roster of all employee payslips and gross/net summary for a specific month and year."""
    result = await db.execute(
        select(Payslip)
        .options(
            selectinload(Payslip.employee).selectinload(Employee.department)
        )
        .where(and_(Payslip.month == month, Payslip.year == year))
        .order_by(Payslip.id)
    )
    payslips = result.scalars().all()

    payslip_list = []
    total_gross = 0.0
    total_net = 0.0

    for ps in payslips:
        total_gross += ps.gross
        total_net += ps.net
        payslip_list.append({
            "id": ps.id,
            "employee_id": ps.employee_id,
            "employee_name": ps.employee.name if ps.employee else "Unknown",
            "department": ps.employee.department.name if (ps.employee and ps.employee.department) else "General Staff",
            "month": ps.month,
            "year": ps.year,
            "gross": ps.gross,
            "deductions": ps.deductions,
            "net": ps.net,
            "generated_at": ps.generated_at.isoformat() if ps.generated_at else None,
        })

    return {
        "payslips": payslip_list,
        "summary": {
            "total_gross": round(total_gross, 2),
            "total_net": round(total_net, 2),
        }
    }


@router.post("/generate", status_code=201)
async def generate_payroll(
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Bulk generate payslips for all active employees who have salary structures configured."""
    from datetime import date as date_cls
    month = payload.get("month")
    year = payload.get("year")
    if not month or not year:
        raise HTTPException(status_code=400, detail="Month and year are required.")

    # Block generation for future months
    today = date_cls.today()
    if (int(year), int(month)) > (today.year, today.month):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot generate payroll for a future month ({month}/{year}). "
                   f"Only current or past months are allowed."
        )

    # Find all active employees
    result = await db.execute(
        select(Employee).where(Employee.status == EmployeeStatus.active)
    )
    employees = result.scalars().all()

    generated = 0
    skipped = 0

    for emp in employees:
        # Check if payslip already exists
        existing_result = await db.execute(
            select(Payslip).where(
                and_(
                    Payslip.employee_id == emp.id,
                    Payslip.month == month,
                    Payslip.year == year,
                )
            )
        )
        if existing_result.scalar_one_or_none():
            skipped += 1
            continue

        # Fetch salary structure
        ss_result = await db.execute(
            select(SalaryStructure).where(SalaryStructure.employee_id == emp.id)
        )
        ss = ss_result.scalar_one_or_none()
        if not ss:
            skipped += 1
            continue

        gross = ss.basic + ss.hra + ss.allowances
        net = gross - ss.deductions
        payslip = Payslip(
            employee_id=emp.id,
            month=month,
            year=year,
            gross=round(gross, 2),
            deductions=round(ss.deductions, 2),
            net=round(net, 2),
        )
        db.add(payslip)
        generated += 1

    await db.flush()
    await db.commit()
    return {"generated": generated, "skipped": skipped}


@router.get("/payslips", response_model=List[PayslipOut])
async def list_payslips(
    employee_id: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_hr),
):
    """Roster list of payslips for backward compatibility."""
    query = select(Payslip).order_by(Payslip.year.desc(), Payslip.month.desc())
    if employee_id:
        query = query.where(Payslip.employee_id == employee_id)
    if year:
        query = query.where(Payslip.year == year)
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/payslips/{payslip_id}", response_model=PayslipOut)
async def get_payslip(
    payslip_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve single payslip statement."""
    result = await db.execute(select(Payslip).where(Payslip.id == payslip_id))
    ps = result.scalar_one_or_none()
    if not ps:
        raise HTTPException(status_code=404, detail="Payslip not found.")

    # Access security check
    if current_user.role not in ["management_admin", "hr_recruiter"]:
        result_emp = await db.execute(
            select(Employee).where(Employee.user_id == current_user.id)
        )
        emp = result_emp.scalar_one_or_none()
        if not emp or ps.employee_id != emp.id:
            raise HTTPException(status_code=403, detail="Access denied.")
    return ps


@router.get("/summary")
async def payroll_summary(
    year: int = Query(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_hr),
):
    """Monthly payroll totals for the given year."""
    from sqlalchemy import func
    result = await db.execute(
        select(
            Payslip.month,
            func.sum(Payslip.gross),
            func.sum(Payslip.net),
            func.count(Payslip.id),
        )
        .where(Payslip.year == year)
        .group_by(Payslip.month)
        .order_by(Payslip.month)
    )
    return [
        {
            "month": row[0],
            "total_gross": round(row[1] or 0, 2),
            "total_net": round(row[2] or 0, 2),
            "payslip_count": row[3],
        }
        for row in result
    ]
