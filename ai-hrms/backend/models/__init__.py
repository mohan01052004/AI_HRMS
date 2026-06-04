"""
models/__init__.py — Re-exports all models for easy import
"""
from .user import User, UserRole
from .employee import Employee, Department, EmployeeStatus
from .attendance import Attendance, AttendanceStatus
from .leave import LeaveType, LeaveRequest, LeaveStatus
from .payroll import (
    SalaryStructure, Payslip,
    JobPosting, JobStatus,
    Goal, GoalStatus,
    PerformanceReview,
    OnboardingTask,
)

__all__ = [
    "User", "UserRole",
    "Employee", "Department", "EmployeeStatus",
    "Attendance", "AttendanceStatus",
    "LeaveType", "LeaveRequest", "LeaveStatus",
    "SalaryStructure", "Payslip",
    "JobPosting", "JobStatus",
    "Goal", "GoalStatus",
    "PerformanceReview",
    "OnboardingTask",
]
