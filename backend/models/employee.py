"""
models/employee.py — Employee, Department models
"""
from sqlalchemy import (
    Column, Integer, String, Float, Date, DateTime,
    ForeignKey, Enum, Text, Boolean
)

from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from database import Base


class EmployeeStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    on_leave = "on_leave"
    terminated = "terminated"


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    manager_id = Column(Integer, ForeignKey("employees.id"), nullable=True)

    employees = relationship(
        "Employee",
        back_populates="department",
        foreign_keys="Employee.department_id",
    )
    manager = relationship(
        "Employee",
        foreign_keys=[manager_id],
        uselist=False,
        post_update=True,
    )


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=True)
    employee_code = Column(String(20), unique=True, nullable=True, index=True)
    name = Column(String(150), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone = Column(String(20), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    designation = Column(String(150), nullable=True)
    date_of_joining = Column(Date, nullable=True)
    salary = Column(Float, default=0.0)
    status = Column(
        Enum(EmployeeStatus, name="employeestatus"),
        default=EmployeeStatus.active,
    )
    gender = Column(String(10), nullable=True)  # 'male', 'female', 'other'
    is_approved = Column(Boolean, default=True)
    manager_id = Column(Integer, ForeignKey("employees.id"), nullable=True)


    address = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    user = relationship("User", back_populates="employee")
    department = relationship(
        "Department",
        back_populates="employees",
        foreign_keys=[department_id],
    )
    manager = relationship(
        "Employee",
        remote_side="Employee.id",
        foreign_keys=[manager_id],
    )
    attendance_records = relationship("Attendance", back_populates="employee")
    leave_requests = relationship("LeaveRequest", back_populates="employee")
    payslips = relationship("Payslip", back_populates="employee")
    salary_structure = relationship(
        "SalaryStructure", back_populates="employee", uselist=False
    )
    goals = relationship("Goal", back_populates="employee")
    performance_reviews = relationship(
        "PerformanceReview",
        back_populates="employee",
        foreign_keys="PerformanceReview.employee_id",
    )
