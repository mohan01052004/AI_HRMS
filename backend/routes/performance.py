"""
routes/performance.py — Goals and performance reviews
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional

from database import get_db, cache_delete
from models.payroll import Goal, PerformanceReview, OnboardingTask
from models.employee import Employee
from models.user import User, UserRole
from schemas.payroll import (
    GoalCreate, GoalUpdate, GoalOut,
    PerformanceReviewCreate, PerformanceReviewOut,
    OnboardingTaskCreate, OnboardingTaskOut,
)
from auth.jwt_handler import get_current_user, require_admin_or_manager

router = APIRouter(prefix="/performance", tags=["Performance"])


# ─── Helper: resolve employee_id for the current user ────────────────────────

async def _get_own_employee_id(user: User, db: AsyncSession) -> Optional[int]:
    """Return the employee record ID linked to this user, or None if not found."""
    result = await db.execute(
        select(Employee.id).where(Employee.user_id == user.id)
    )
    return result.scalar_one_or_none()


def _is_privileged(user: User) -> bool:
    """Admins, senior managers, and HR recruiters can see everyone's data."""
    return user.role in (
        UserRole.management_admin,
        UserRole.senior_manager,
        UserRole.hr_recruiter,
    )


# ─── Goals ───────────────────────────────────────────────────────────────────

@router.get("/goals", response_model=List[GoalOut])
async def list_goals(
    employee_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Goal).order_by(Goal.created_at.desc())

    if _is_privileged(current_user):
        # Admin / Manager / HR — can filter by employee_id, or see all
        if employee_id:
            query = query.where(Goal.employee_id == employee_id)
    else:
        # Regular employee — always restricted to their own goals only
        own_id = await _get_own_employee_id(current_user, db)
        if own_id is None:
            # No linked employee record yet — return empty
            return []
        query = query.where(Goal.employee_id == own_id)

    result = await db.execute(query)
    return result.scalars().all()


@router.post("/goals", response_model=GoalOut, status_code=201)
async def create_goal(
    payload: GoalCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Employees can only create goals for themselves
    if not _is_privileged(current_user):
        own_id = await _get_own_employee_id(current_user, db)
        if own_id is None:
            raise HTTPException(status_code=403, detail="No employee profile linked to your account.")
        if payload.employee_id != own_id:
            raise HTTPException(status_code=403, detail="You can only create goals for yourself.")

    goal = Goal(**payload.model_dump())
    db.add(goal)
    await db.flush()
    await db.refresh(goal)

    # Evict cache
    emp_res = await db.execute(select(Employee.user_id).where(Employee.id == payload.employee_id))
    tgt_user_id = emp_res.scalar_one_or_none()
    if tgt_user_id:
        cache_delete(f"employee_dashboard_{tgt_user_id}")
    cache_delete(f"employee_detail_dashboard_{payload.employee_id}")

    return goal


@router.put("/goals/{goal_id}", response_model=GoalOut)
async def update_goal(
    goal_id: int,
    payload: GoalUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Goal).where(Goal.id == goal_id))
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found.")

    # Employees may only edit their own goals
    if not _is_privileged(current_user):
        own_id = await _get_own_employee_id(current_user, db)
        if goal.employee_id != own_id:
            raise HTTPException(status_code=403, detail="You can only update your own goals.")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(goal, k, v)
    db.add(goal)
    await db.flush()
    await db.refresh(goal)

    # Evict cache
    emp_res = await db.execute(select(Employee.user_id).where(Employee.id == goal.employee_id))
    tgt_user_id = emp_res.scalar_one_or_none()
    if tgt_user_id:
        cache_delete(f"employee_dashboard_{tgt_user_id}")
    cache_delete(f"employee_detail_dashboard_{goal.employee_id}")

    return goal


@router.delete("/goals/{goal_id}", status_code=204)
async def delete_goal(
    goal_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Goal).where(Goal.id == goal_id))
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found.")

    # Employees may only delete their own goals
    if not _is_privileged(current_user):
        own_id = await _get_own_employee_id(current_user, db)
        if goal.employee_id != own_id:
            raise HTTPException(status_code=403, detail="You can only delete your own goals.")

    # Evict cache
    emp_res = await db.execute(select(Employee.user_id).where(Employee.id == goal.employee_id))
    tgt_user_id = emp_res.scalar_one_or_none()
    if tgt_user_id:
        cache_delete(f"employee_dashboard_{tgt_user_id}")
    cache_delete(f"employee_detail_dashboard_{goal.employee_id}")

    await db.delete(goal)


# ─── Performance Reviews ──────────────────────────────────────────────────────

@router.get("/reviews", response_model=List[PerformanceReviewOut])
async def list_reviews(
    employee_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(PerformanceReview).order_by(PerformanceReview.created_at.desc())

    if _is_privileged(current_user):
        # Admin / Manager / HR — can filter by employee_id, or see all
        if employee_id:
            query = query.where(PerformanceReview.employee_id == employee_id)
    else:
        # Regular employee — always restricted to their own reviews only
        own_id = await _get_own_employee_id(current_user, db)
        if own_id is None:
            return []
        query = query.where(PerformanceReview.employee_id == own_id)

    result = await db.execute(query)
    return result.scalars().all()


@router.post("/reviews", response_model=PerformanceReviewOut, status_code=201)
async def create_review(
    payload: PerformanceReviewCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_manager),
):
    review = PerformanceReview(
        **payload.model_dump(),
        reviewer_id=current_user.id,
    )
    db.add(review)
    await db.flush()
    await db.refresh(review)

    # Evict cache
    emp_res = await db.execute(select(Employee.user_id).where(Employee.id == payload.employee_id))
    tgt_user_id = emp_res.scalar_one_or_none()
    if tgt_user_id:
        cache_delete(f"employee_dashboard_{tgt_user_id}")
    cache_delete(f"employee_detail_dashboard_{payload.employee_id}")

    return review


@router.get("/reviews/{review_id}", response_model=PerformanceReviewOut)
async def get_review(
    review_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PerformanceReview).where(PerformanceReview.id == review_id)
    )
    review = result.scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found.")

    # Employees may only see their own reviews
    if not _is_privileged(current_user):
        own_id = await _get_own_employee_id(current_user, db)
        if review.employee_id != own_id:
            raise HTTPException(status_code=403, detail="Access denied.")

    return review


# ─── Onboarding Tasks ─────────────────────────────────────────────────────────

@router.get("/onboarding", response_model=List[OnboardingTaskOut])
async def list_onboarding_tasks(
    employee_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = select(OnboardingTask).order_by(OnboardingTask.created_at)
    if employee_id:
        query = query.where(OnboardingTask.employee_id == employee_id)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/onboarding", response_model=OnboardingTaskOut, status_code=201)
async def create_onboarding_task(
    payload: OnboardingTaskCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_or_manager),
):
    task = OnboardingTask(**payload.model_dump())
    db.add(task)
    await db.flush()
    await db.refresh(task)
    return task


@router.put("/onboarding/{task_id}/complete", response_model=OnboardingTaskOut)
async def complete_onboarding_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    from datetime import datetime, timezone
    result = await db.execute(
        select(OnboardingTask).where(OnboardingTask.id == task_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Onboarding task not found.")
    task.is_completed = 1
    task.completed_at = datetime.now(timezone.utc)
    db.add(task)
    await db.flush()
    await db.refresh(task)
    return task
