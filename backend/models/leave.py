"""
models/leave.py — Leave types and leave request models
"""
from sqlalchemy import (
    Column, Integer, String, Text, Date, ForeignKey,
    Enum, DateTime, Boolean
)
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from database import Base


class LeaveStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    cancelled = "cancelled"


class LeaveType(Base):
    __tablename__ = "leave_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    days_allowed = Column(Integer, default=12)
    is_paid = Column(Boolean, default=True)

    leave_requests = relationship("LeaveRequest", back_populates="leave_type")


class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(
        Integer, ForeignKey("employees.id"), nullable=False, index=True
    )
    leave_type_id = Column(Integer, ForeignKey("leave_types.id"), nullable=False)
    from_date = Column(Date, nullable=False)
    to_date = Column(Date, nullable=False)
    reason = Column(Text, nullable=True)
    status = Column(
        Enum(LeaveStatus, name="leavestatus"),
        default=LeaveStatus.pending,
    )
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    employee = relationship("Employee", back_populates="leave_requests")
    leave_type = relationship("LeaveType", back_populates="leave_requests")
    approver = relationship("User", foreign_keys=[approved_by])
