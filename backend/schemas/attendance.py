"""
schemas/attendance.py — Attendance schemas
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, time, datetime
from models.attendance import AttendanceStatus


class ClockInOut(BaseModel):
    employee_id: int


class AttendanceCreate(BaseModel):
    employee_id: int
    date: date
    clock_in: Optional[time] = None
    clock_out: Optional[time] = None
    status: AttendanceStatus = AttendanceStatus.present
    hours_worked: float = Field(default=0.0, ge=0)


class AttendanceOut(BaseModel):
    id: int
    employee_id: int
    date: date
    clock_in: Optional[time] = None
    clock_out: Optional[time] = None
    status: AttendanceStatus
    hours_worked: float
    clock_history: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
