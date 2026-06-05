"""
schemas/employee.py — Complete Employee & Department Pydantic schemas
"""
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List
from datetime import date, datetime
from models.employee import EmployeeStatus


# ─── Department ──────────────────────────────────────────────────────────────

class DepartmentCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, examples=["Engineering"])
    manager_id: Optional[int] = Field(None, description="Employee ID of the department manager")


class DepartmentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    manager_id: Optional[int] = None


class DepartmentOut(BaseModel):
    id: int
    name: str
    manager_id: Optional[int] = None

    model_config = {"from_attributes": True}


class DepartmentWithCount(DepartmentOut):
    employee_count: int = 0


# ─── Employee ─────────────────────────────────────────────────────────────────

class EmployeeCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150, examples=["Jane Smith"])
    email: EmailStr = Field(..., examples=["jane.smith@company.com"])
    phone: Optional[str] = Field(None, max_length=20, examples=["+91 9876543210"])
    department_id: Optional[int] = Field(None, description="Department ID")
    designation: Optional[str] = Field(None, max_length=150, examples=["Senior Developer"])
    date_of_joining: Optional[date] = Field(None, examples=["2024-01-15"])
    salary: float = Field(default=0.0, ge=0, examples=[75000.0])
    status: EmployeeStatus = Field(default=EmployeeStatus.active)
    manager_id: Optional[int] = Field(None, description="Manager's Employee ID")
    address: Optional[str] = Field(None, max_length=500)
    gender: Optional[str] = Field(None, max_length=10, examples=["female"])
    password: Optional[str] = Field(None, min_length=6, description="Login password for auto-created user")
    role: Optional[str] = Field("employee", description="Role: employee, senior_manager, or hr_recruiter")
    user_id: Optional[int] = Field(None, description="Linked User account ID")



    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v):
        if v and len(v.strip()) < 7:
            raise ValueError("Phone number too short")
        return v.strip() if v else v

    @field_validator("salary")
    @classmethod
    def validate_salary(cls, v):
        if v < 0:
            raise ValueError("Salary cannot be negative")
        return round(v, 2)


class EmployeeUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=150)
    phone: Optional[str] = Field(None, max_length=20)
    department_id: Optional[int] = None
    designation: Optional[str] = Field(None, max_length=150)
    date_of_joining: Optional[date] = None
    salary: Optional[float] = Field(None, ge=0)
    status: Optional[EmployeeStatus] = None
    manager_id: Optional[int] = None
    address: Optional[str] = Field(None, max_length=500)
    gender: Optional[str] = Field(None, max_length=10)


    @field_validator("salary")
    @classmethod
    def validate_salary(cls, v):
        if v is not None:
            return round(v, 2)
        return v


class EmployeeOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    employee_code: Optional[str] = None
    name: str
    email: str
    phone: Optional[str] = None
    department_id: Optional[int] = None
    designation: Optional[str] = None
    date_of_joining: Optional[date] = None
    salary: float
    status: EmployeeStatus
    gender: Optional[str] = None
    is_approved: bool = True
    manager_id: Optional[int] = None


    address: Optional[str] = None
    created_at: datetime
    department: Optional[DepartmentOut] = None

    model_config = {"from_attributes": True}


class EmployeeListOut(BaseModel):
    """Paginated list response."""
    items: List[EmployeeOut]
    total: int
    skip: int
    limit: int
    has_more: bool

    model_config = {"from_attributes": True}


class EmployeeStats(BaseModel):
    total: int
    active: int
    inactive: int
    on_leave: int
    terminated: int
    department_distribution: List[dict]
