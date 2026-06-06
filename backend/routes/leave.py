"""
routes/leave.py — Leave types and leave request management
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime, timezone, date
from pydantic import BaseModel, Field

from database import get_db, cache_delete
from models.leave import LeaveType, LeaveRequest, LeaveStatus
from models.employee import Employee
from models.user import User
from schemas.leave import (
    LeaveTypeCreate, LeaveTypeOut,
    LeaveRequestCreate,
)
from auth.jwt_handler import get_current_user, require_admin_or_manager
from websocket_manager import manager as ws_manager

router = APIRouter(prefix="/leave", tags=["Leave Management"])


# ─── Custom Pydantic Models for Response serialization ──────────────────────────

class LeaveTypeOutCustom(BaseModel):
    id: int
    name: str
    days_allowed: int
    is_paid: bool

    model_config = {"from_attributes": True}


class LeaveRequestOutCustom(BaseModel):
    id: int
    employee_id: int
    employee_name: Optional[str] = None
    department_name: Optional[str] = None
    leave_type_id: int
    from_date: date
    to_date: date
    reason: Optional[str] = None
    status: str
    approved_by: Optional[int] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    created_at: datetime
    leave_type: Optional[LeaveTypeOutCustom] = None

    model_config = {"from_attributes": True}


class LeaveBalanceOut(BaseModel):
    leave_type_id: int
    leave_type_name: str
    days_allowed: int
    days_used: int
    days_remaining: int


class MyLeaveSummary(BaseModel):
    requests: List[LeaveRequestOutCustom]
    balances: List[LeaveBalanceOut]


class RejectRequestPayload(BaseModel):
    reason: Optional[str] = None


# ─── Helpers ─────────────────────────────────────────────────────────────────

async def _get_employee_for_user(user: User, db: AsyncSession) -> Employee:
    """Resolve the Employee record linked to a User account."""
    result = await db.execute(
        select(Employee).where(Employee.user_id == user.id)
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(
            status_code=404,
            detail="No employee record is linked to your user account. Please contact HR.",
        )
    return emp


# ─── Leave Types ─────────────────────────────────────────────────────────────

@router.get("/types", response_model=List[LeaveTypeOutCustom], summary="List all leave types")
async def list_leave_types(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(LeaveType).order_by(LeaveType.name))
    types = result.scalars().all()

    # Filter out maternity leave for non-female employees
    emp_res = await db.execute(select(Employee).where(Employee.user_id == current_user.id))
    emp = emp_res.scalar_one_or_none()
    if emp and (not emp.gender or emp.gender.lower() != "female"):
        types = [t for t in types if "maternity" not in t.name.lower()]
    return types



@router.post("/types", response_model=LeaveTypeOutCustom, status_code=201, summary="Create a new leave type")
async def create_leave_type(
    payload: LeaveTypeCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_or_manager),
):
    lt = LeaveType(**payload.model_dump())
    db.add(lt)
    await db.flush()
    await db.refresh(lt)
    return lt


# ─── Employee Endpoints ──────────────────────────────────────────────────────

@router.post("/apply", response_model=LeaveRequestOutCustom, status_code=201, summary="Apply for leave")
async def apply_leave(
    payload: LeaveRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Submit a leave application.
    - Validates date range (end date >= start date).
    - Checks for overlapping requests (approved or pending).
    - Validates remaining leave balance dynamically.
    """
    emp = await _get_employee_for_user(current_user, db)

    # Date range validation
    if payload.to_date < payload.from_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End date (to_date) must be on or after start date (from_date)."
        )

    requested_days = (payload.to_date - payload.from_date).days + 1

    # Leave type existence validation
    leave_type = await db.get(LeaveType, payload.leave_type_id)
    if not leave_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Specified leave type not found."
        )

    # Restrict maternity leave to female employees only
    if "maternity" in leave_type.name.lower():
        if not emp.gender or emp.gender.lower() != "female":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maternity leave is only available for female employees."
            )


    # Check for overlapping leave requests (approved or pending)
    overlap_query = select(LeaveRequest).where(
        and_(
            LeaveRequest.employee_id == emp.id,
            LeaveRequest.status.in_([LeaveStatus.pending, LeaveStatus.approved]),
            or_(
                and_(LeaveRequest.from_date <= payload.to_date, LeaveRequest.to_date >= payload.from_date)
            )
        )
    )
    overlap_result = await db.execute(overlap_query)
    if overlap_result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have an overlapping pending or approved leave request for these dates."
        )

    # Validate leave balance
    approved_query = select(LeaveRequest).where(
        and_(
            LeaveRequest.employee_id == emp.id,
            LeaveRequest.leave_type_id == payload.leave_type_id,
            LeaveRequest.status == LeaveStatus.approved
        )
    )
    approved_result = await db.execute(approved_query)
    approved_requests = approved_result.scalars().all()
    used_days = sum((r.to_date - r.from_date).days + 1 for r in approved_requests)

    remaining_days = max(0, leave_type.days_allowed - used_days)
    if requested_days > remaining_days:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient leave balance. You requested {requested_days} day(s), but only have {remaining_days} day(s) remaining for {leave_type.name}."
        )

    req = LeaveRequest(
        employee_id=emp.id,
        leave_type_id=payload.leave_type_id,
        from_date=payload.from_date,
        to_date=payload.to_date,
        reason=payload.reason,
        status=LeaveStatus.pending
    )
    db.add(req)
    await db.flush()
    await db.refresh(req)

    # Fetch loaded record with leave_type relationship
    result = await db.execute(
        select(LeaveRequest)
        .options(selectinload(LeaveRequest.leave_type))
        .where(LeaveRequest.id == req.id)
    )
    req_loaded = result.scalar_one()
    req_loaded.employee_name = emp.name

    cache_delete(f"employee_dashboard_{current_user.id}")
    cache_delete(f"employee_detail_dashboard_{emp.id}")
    cache_delete("admin_dashboard")

    return req_loaded


@router.get("/my", response_model=MyLeaveSummary, summary="Get own leave history and balance summary")
async def get_my_leaves(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve employee's own leave requests and computed balances for all types.
    """
    emp = await _get_employee_for_user(current_user, db)

    # Fetch leave requests
    req_query = (
        select(LeaveRequest)
        .options(selectinload(LeaveRequest.leave_type))
        .where(LeaveRequest.employee_id == emp.id)
        .order_by(LeaveRequest.created_at.desc())
    )
    req_result = await db.execute(req_query)
    my_requests = req_result.scalars().all()

    # Fetch leave types
    type_query = select(LeaveType)
    type_result = await db.execute(type_query)
    types = type_result.scalars().all()

    balances = []
    for lt in types:
        # Hide maternity leave balance for non-female employees
        if "maternity" in lt.name.lower() and (not emp.gender or emp.gender.lower() != "female"):
            continue
        used = sum(
            (r.to_date - r.from_date).days + 1
            for r in my_requests
            if r.leave_type_id == lt.id and r.status == LeaveStatus.approved
        )
        balances.append(
            LeaveBalanceOut(
                leave_type_id=lt.id,
                leave_type_name=lt.name,
                days_allowed=lt.days_allowed,
                days_used=used,
                days_remaining=max(0, lt.days_allowed - used)
            )
        )


    for r in my_requests:
        r.employee_name = emp.name

    return MyLeaveSummary(
        requests=my_requests,
        balances=balances
    )


# ─── Manager / Admin Endpoints ───────────────────────────────────────────────

@router.get("/pending", response_model=List[LeaveRequestOutCustom], summary="List all pending leave requests")
async def get_pending_leaves(
    department_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_manager),
):
    """
    Retrieve all pending leave requests. Filterable by department.
    - Standard employee/hr leaves go to both managers and admins.
    - Manager leaves go only to admins.
    - No self-approval (own requests are filtered out).
    """
    # Resolve the current user's employee record
    emp_res = await db.execute(select(Employee).where(Employee.user_id == current_user.id))
    current_emp = emp_res.scalar_one_or_none()
    current_emp_id = current_emp.id if current_emp else None

    # Construct base query joining LeaveRequest -> Employee -> User
    query = (
        select(LeaveRequest)
        .join(Employee, LeaveRequest.employee_id == Employee.id)
        .join(User, Employee.user_id == User.id)
        .options(
            selectinload(LeaveRequest.leave_type),
            selectinload(LeaveRequest.employee).selectinload(Employee.department)
        )
        .where(LeaveRequest.status == LeaveStatus.pending)
    )

    # Filter out current user's own leave requests (no self-approval)
    if current_emp_id is not None:
        query = query.where(LeaveRequest.employee_id != current_emp_id)

    # Role-based restriction:
    # - senior_manager can see leave requests from standard employees, hr recruiters, and admins (excludes other senior_managers).
    # - management_admin can see senior_manager requests too.
    if current_user.role == "senior_manager":
        query = query.where(User.role != "senior_manager")

    if department_id:
        query = query.where(Employee.department_id == department_id)

    query = query.order_by(LeaveRequest.created_at.asc())

    result = await db.execute(query)
    requests = result.scalars().all()

    for r in requests:
        if r.employee:
            r.employee_name = r.employee.name
            r.department_name = r.employee.department.name if r.employee.department else None

    return requests


@router.put("/{leave_id}/approve", response_model=LeaveRequestOutCustom, summary="Approve a leave request")
async def approve_leave(
    leave_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_manager),
):
    """
    Approve a pending leave request.
    """
    result = await db.execute(
        select(LeaveRequest)
        .options(
            selectinload(LeaveRequest.leave_type),
            selectinload(LeaveRequest.employee)
        )
        .where(LeaveRequest.id == leave_id)
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave request not found."
        )

    if req.status != LeaveStatus.pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only pending requests can be approved. This request is already {req.status}."
        )

    # Resolve current user's employee record
    emp_res = await db.execute(select(Employee).where(Employee.user_id == current_user.id))
    current_emp = emp_res.scalar_one_or_none()
    
    # 1. No self approval check
    if current_emp and req.employee_id == current_emp.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot approve your own leave request."
        )

    # 2. Requester role check: manager leave requests can only be approved by admin
    requester_user_res = await db.execute(
        select(User.role).join(Employee, Employee.user_id == User.id).where(Employee.id == req.employee_id)
    )
    requester_role = requester_user_res.scalar_one_or_none()
    if requester_role == "senior_manager" and current_user.role != "management_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Leave requests from managers can only be approved by an administrator."
        )

    req.status = LeaveStatus.approved
    req.approved_by = current_user.id
    req.approved_at = datetime.now(timezone.utc)

    db.add(req)
    await db.flush()
    await db.refresh(req)

    # Notify the employee in real-time
    if req.employee:
        emp_user_res = await db.execute(
            select(User.id).join(Employee, Employee.user_id == User.id).where(Employee.id == req.employee_id)
        )
        emp_user_id = emp_user_res.scalar_one_or_none()
        if emp_user_id:
            import asyncio
            asyncio.create_task(ws_manager.send_to_user(emp_user_id, "leave_update", {
                "action": "approved",
                "leave_id": req.id,
                "message": f"Your leave request has been approved!",
            }))
        asyncio.create_task(ws_manager.broadcast("leave_update", {
            "action": "approved",
            "employee_name": req.employee.name if req.employee else "Employee",
            "leave_id": req.id,
        }))

    if req.employee:
        req.employee_name = req.employee.name

    # Clear target employee cache
    if req.employee and req.employee.user_id:
        cache_delete(f"employee_dashboard_{req.employee.user_id}")
    cache_delete(f"employee_detail_dashboard_{req.employee_id}")
    cache_delete("admin_dashboard")

    return req


@router.put("/{leave_id}/reject", response_model=LeaveRequestOutCustom, summary="Reject a leave request")
async def reject_leave(
    leave_id: int,
    payload: RejectRequestPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_manager),
):
    """
    Reject a pending leave request with a rejection reason.
    """
    result = await db.execute(
        select(LeaveRequest)
        .options(
            selectinload(LeaveRequest.leave_type),
            selectinload(LeaveRequest.employee)
        )
        .where(LeaveRequest.id == leave_id)
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave request not found."
        )

    if req.status != LeaveStatus.pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only pending requests can be rejected. This request is already {req.status}."
        )

    # Resolve current user's employee record
    emp_res = await db.execute(select(Employee).where(Employee.user_id == current_user.id))
    current_emp = emp_res.scalar_one_or_none()
    
    # 1. No self rejection check
    if current_emp and req.employee_id == current_emp.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot reject your own leave request."
        )

    # 2. Requester role check: manager leave requests can only be rejected by admin
    requester_user_res = await db.execute(
        select(User.role).join(Employee, Employee.user_id == User.id).where(Employee.id == req.employee_id)
    )
    requester_role = requester_user_res.scalar_one_or_none()
    if requester_role == "senior_manager" and current_user.role != "management_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Leave requests from managers can only be rejected by an administrator."
        )

    req.status = LeaveStatus.rejected
    req.rejection_reason = payload.reason
    req.approved_by = current_user.id
    req.approved_at = datetime.now(timezone.utc)

    db.add(req)
    await db.flush()
    await db.refresh(req)

    # Notify the employee in real-time
    if req.employee:
        emp_user_res = await db.execute(
            select(User.id).join(Employee, Employee.user_id == User.id).where(Employee.id == req.employee_id)
        )
        emp_user_id = emp_user_res.scalar_one_or_none()
        if emp_user_id:
            import asyncio
            asyncio.create_task(ws_manager.send_to_user(emp_user_id, "leave_update", {
                "action": "rejected",
                "leave_id": req.id,
                "message": f"Your leave request has been rejected. Reason: {payload.reason or 'Not specified'}",
            }))
        req.employee_name = req.employee.name

    # Clear target employee cache
    if req.employee and req.employee.user_id:
        cache_delete(f"employee_dashboard_{req.employee.user_id}")
    cache_delete(f"employee_detail_dashboard_{req.employee_id}")
    cache_delete("admin_dashboard")

    return req


# ─── Fallback / General Endpoints ────────────────────────────────────────────

@router.get("", response_model=List[LeaveRequestOutCustom], summary="List leave requests (general)")
async def list_leave_requests(
    employee_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = (
        select(LeaveRequest)
        .options(
            selectinload(LeaveRequest.leave_type),
            selectinload(LeaveRequest.employee)
        )
        .order_by(LeaveRequest.created_at.desc())
    )
    if employee_id:
        query = query.where(LeaveRequest.employee_id == employee_id)
    if status:
        query = query.where(LeaveRequest.status == status)
    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    requests = result.scalars().all()

    for r in requests:
        if r.employee:
            r.employee_name = r.employee.name

    return requests


@router.get("/{leave_id}", response_model=LeaveRequestOutCustom, summary="Get single leave request detail")
async def get_leave_request(
    leave_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(LeaveRequest)
        .options(
            selectinload(LeaveRequest.leave_type),
            selectinload(LeaveRequest.employee)
        )
        .where(LeaveRequest.id == leave_id)
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Leave request not found.")
    
    if req.employee:
        req.employee_name = req.employee.name
        
    return req


@router.delete("/{leave_id}", status_code=204, summary="Cancel pending leave request")
async def cancel_leave(
    leave_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    emp = await _get_employee_for_user(current_user, db)
    result = await db.execute(
        select(LeaveRequest).where(
            and_(
                LeaveRequest.id == leave_id,
                LeaveRequest.employee_id == emp.id
            )
        )
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Leave request not found.")
    if req.status != LeaveStatus.pending:
        raise HTTPException(
            status_code=400,
            detail="Only pending requests can be cancelled."
        )
    req.status = LeaveStatus.cancelled
    db.add(req)

    # Evict cache
    cache_delete(f"employee_dashboard_{current_user.id}")
    cache_delete(f"employee_detail_dashboard_{emp.id}")
    cache_delete("admin_dashboard")
