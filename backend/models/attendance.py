"""
models/attendance.py — Attendance tracking model
"""
from sqlalchemy import Column, Integer, Date, Time, Float, ForeignKey, Enum, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from database import Base


class AttendanceStatus(str, enum.Enum):
    present = "present"
    absent = "absent"
    late = "late"
    half_day = "half_day"
    work_from_home = "work_from_home"
    holiday = "holiday"


class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(
        Integer, ForeignKey("employees.id"), nullable=False, index=True
    )
    date = Column(Date, nullable=False, index=True)
    clock_in = Column(Time, nullable=True)
    clock_out = Column(Time, nullable=True)
    status = Column(
        Enum(AttendanceStatus, name="attendancestatus"),
        default=AttendanceStatus.present,
    )
    hours_worked = Column(Float, default=0.0)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    employee = relationship("Employee", back_populates="attendance_records")
