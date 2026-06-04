"""
routes/recruitment.py — Job postings management
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional

from database import get_db
from models.payroll import JobPosting, JobStatus
from models.user import User
from schemas.payroll import JobPostingCreate, JobPostingUpdate, JobPostingOut
from auth.jwt_handler import get_current_user, require_hr

router = APIRouter(prefix="/recruitment", tags=["Recruitment"])


@router.get("", response_model=List[JobPostingOut])
async def list_jobs(
    status: Optional[str] = Query(None),
    department_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = select(JobPosting).order_by(JobPosting.created_at.desc())
    if status:
        query = query.where(JobPosting.status == status)
    if department_id:
        query = query.where(JobPosting.department_id == department_id)
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=JobPostingOut, status_code=201)
async def create_job(
    payload: JobPostingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_hr),
):
    job = JobPosting(**payload.model_dump(), created_by=current_user.id)
    db.add(job)
    await db.flush()
    await db.refresh(job)
    return job


@router.get("/{job_id}", response_model=JobPostingOut)
async def get_job(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(JobPosting).where(JobPosting.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job posting not found.")
    return job


@router.put("/{job_id}", response_model=JobPostingOut)
async def update_job(
    job_id: int,
    payload: JobPostingUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_hr),
):
    result = await db.execute(select(JobPosting).where(JobPosting.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job posting not found.")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(job, k, v)
    db.add(job)
    await db.flush()
    await db.refresh(job)
    return job


@router.delete("/{job_id}", status_code=204)
async def delete_job(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_hr),
):
    result = await db.execute(select(JobPosting).where(JobPosting.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job posting not found.")
    await db.delete(job)
