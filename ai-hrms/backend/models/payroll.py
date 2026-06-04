"""
models/payroll.py — Salary structure, payslips, job postings, goals, performance reviews
"""
from sqlalchemy import (
    Column, Integer, String, Float, Text, Date, DateTime,
    ForeignKey, Enum, JSON
)
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from database import Base


# ─── Salary ──────────────────────────────────────────────────────────────────

class SalaryStructure(Base):
    __tablename__ = "salary_structures"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(
        Integer, ForeignKey("employees.id"), unique=True, nullable=False
    )
    basic = Column(Float, default=0.0)
    hra = Column(Float, default=0.0)
    allowances = Column(Float, default=0.0)
    deductions = Column(Float, default=0.0)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    employee = relationship("Employee", back_populates="salary_structure")


class Payslip(Base):
    __tablename__ = "payslips"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(
        Integer, ForeignKey("employees.id"), nullable=False, index=True
    )
    month = Column(Integer, nullable=False)  # 1–12
    year = Column(Integer, nullable=False)
    gross = Column(Float, default=0.0)
    deductions = Column(Float, default=0.0)
    net = Column(Float, default=0.0)
    generated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    employee = relationship("Employee", back_populates="payslips")


# ─── Recruitment ─────────────────────────────────────────────────────────────

class JobStatus(str, enum.Enum):
    open = "open"
    closed = "closed"
    on_hold = "on_hold"


class JobPosting(Base):
    __tablename__ = "job_postings"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    requirements = Column(Text, nullable=True)
    location = Column(String(150), nullable=True)
    salary_range = Column(String(100), nullable=True)
    status = Column(
        Enum(JobStatus, name="jobstatus"),
        default=JobStatus.open,
    )
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    department = relationship("Department", foreign_keys=[department_id])
    creator = relationship("User", foreign_keys=[created_by])


# ─── Performance ─────────────────────────────────────────────────────────────

class GoalStatus(str, enum.Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"


class Goal(Base):
    __tablename__ = "goals"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(
        Integer, ForeignKey("employees.id"), nullable=False, index=True
    )
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    target_date = Column(Date, nullable=True)
    progress = Column(Integer, default=0)  # 0–100
    status = Column(
        Enum(GoalStatus, name="goalstatus"),
        default=GoalStatus.not_started,
    )
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    employee = relationship("Employee", back_populates="goals")


class PerformanceReview(Base):
    __tablename__ = "performance_reviews"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(
        Integer, ForeignKey("employees.id"), nullable=False, index=True
    )
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    period = Column(String(50), nullable=False)  # e.g. "Q1 2025", "Annual 2024"
    rating = Column(Float, nullable=True)  # 1.0 – 5.0
    comments = Column(Text, nullable=True)
    ai_summary = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    employee = relationship(
        "Employee",
        back_populates="performance_reviews",
        foreign_keys=[employee_id],
    )
    reviewer = relationship("User", foreign_keys=[reviewer_id])


# ─── Onboarding ──────────────────────────────────────────────────────────────

class OnboardingTask(Base):
    __tablename__ = "onboarding_tasks"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(
        Integer, ForeignKey("employees.id"), nullable=False, index=True
    )
    task_name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    is_completed = Column(Integer, default=0)  # 0 or 1
    due_date = Column(Date, nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
