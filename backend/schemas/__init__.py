"""
schemas/__init__.py
"""
from .auth import UserCreate, UserLogin, UserOut, Token, TokenData
from .employee import (
    EmployeeCreate, EmployeeUpdate, EmployeeOut, EmployeeListOut, EmployeeStats,
    DepartmentCreate, DepartmentUpdate, DepartmentOut, DepartmentWithCount,
)
from .attendance import AttendanceCreate, AttendanceOut, ClockInOut
from .leave import LeaveTypeCreate, LeaveTypeOut, LeaveRequestCreate, LeaveRequestOut, LeaveApproval
from .payroll import (
    SalaryStructureCreate, SalaryStructureOut,
    PayslipOut, PayslipCreate,
    JobPostingCreate, JobPostingUpdate, JobPostingOut,
    GoalCreate, GoalUpdate, GoalOut,
    PerformanceReviewCreate, PerformanceReviewOut,
    OnboardingTaskCreate, OnboardingTaskOut,
)
