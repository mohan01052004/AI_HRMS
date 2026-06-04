"""
schemas/payroll.py — Payroll, recruitment, goals, performance, onboarding schemas
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime
from models.payroll import JobStatus, GoalStatus


# ─── Salary ──────────────────────────────────────────────────────────────────

class SalaryStructureCreate(BaseModel):
    employee_id: int
    basic: float = Field(default=0.0, ge=0)
    hra: float = Field(default=0.0, ge=0)
    allowances: float = Field(default=0.0, ge=0)
    deductions: float = Field(default=0.0, ge=0)


class SalaryStructureOut(BaseModel):
    id: int
    employee_id: int
    basic: float
    hra: float
    allowances: float
    deductions: float
    updated_at: datetime

    model_config = {"from_attributes": True}


class PayslipCreate(BaseModel):
    employee_id: int
    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=2000)


class PayslipOut(BaseModel):
    id: int
    employee_id: int
    month: int
    year: int
    gross: float
    deductions: float
    net: float
    generated_at: datetime

    model_config = {"from_attributes": True}


# ─── Recruitment ─────────────────────────────────────────────────────────────

class JobPostingCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    description: Optional[str] = None
    department_id: Optional[int] = None
    requirements: Optional[str] = None
    location: Optional[str] = None
    salary_range: Optional[str] = None
    status: JobStatus = JobStatus.open


class JobPostingUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=200)
    description: Optional[str] = None
    requirements: Optional[str] = None
    location: Optional[str] = None
    salary_range: Optional[str] = None
    status: Optional[JobStatus] = None


class JobPostingOut(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    department_id: Optional[int] = None
    requirements: Optional[str] = None
    location: Optional[str] = None
    salary_range: Optional[str] = None
    status: JobStatus
    created_by: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Goals ───────────────────────────────────────────────────────────────────

class GoalCreate(BaseModel):
    employee_id: int
    title: str = Field(..., min_length=2, max_length=200)
    description: Optional[str] = None
    target_date: Optional[date] = None
    progress: int = Field(default=0, ge=0, le=100)
    status: GoalStatus = GoalStatus.not_started


class GoalUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    target_date: Optional[date] = None
    progress: Optional[int] = Field(None, ge=0, le=100)
    status: Optional[GoalStatus] = None


class GoalOut(BaseModel):
    id: int
    employee_id: int
    title: str
    description: Optional[str] = None
    target_date: Optional[date] = None
    progress: int
    status: GoalStatus
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Performance Reviews ──────────────────────────────────────────────────────

class PerformanceReviewCreate(BaseModel):
    employee_id: int
    period: str = Field(..., min_length=2, max_length=50)
    rating: Optional[float] = Field(None, ge=1.0, le=5.0)
    comments: Optional[str] = None


class PerformanceReviewOut(BaseModel):
    id: int
    employee_id: int
    reviewer_id: Optional[int] = None
    period: str
    rating: Optional[float] = None
    comments: Optional[str] = None
    ai_summary: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Onboarding ──────────────────────────────────────────────────────────────

class OnboardingTaskCreate(BaseModel):
    employee_id: int
    task_name: str = Field(..., min_length=2, max_length=200)
    description: Optional[str] = None
    due_date: Optional[date] = None


class OnboardingTaskOut(BaseModel):
    id: int
    employee_id: int
    task_name: str
    description: Optional[str] = None
    is_completed: int
    due_date: Optional[date] = None
    completed_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}
