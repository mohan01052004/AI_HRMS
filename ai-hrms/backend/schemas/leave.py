"""
schemas/leave.py — Leave schemas
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime
from models.leave import LeaveStatus


class LeaveTypeCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    days_allowed: int = Field(default=12, ge=1)
    is_paid: bool = True


class LeaveTypeOut(BaseModel):
    id: int
    name: str
    days_allowed: int
    is_paid: bool

    model_config = {"from_attributes": True}


class LeaveRequestCreate(BaseModel):
    leave_type_id: int
    from_date: date
    to_date: date
    reason: Optional[str] = None

    def validate_dates(self):
        if self.to_date < self.from_date:
            raise ValueError("to_date must be >= from_date")
        return self


class LeaveRequestOut(BaseModel):
    id: int
    employee_id: int
    leave_type_id: int
    from_date: date
    to_date: date
    reason: Optional[str] = None
    status: LeaveStatus
    approved_by: Optional[int] = None
    approved_at: Optional[datetime] = None
    created_at: datetime
    leave_type: Optional[LeaveTypeOut] = None

    model_config = {"from_attributes": True}


class LeaveApproval(BaseModel):
    status: LeaveStatus  # approved or rejected
