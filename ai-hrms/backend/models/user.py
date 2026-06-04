"""
models/user.py — User account model (auth + role)
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from database import Base


class UserRole(str, enum.Enum):
    management_admin = "management_admin"
    senior_manager = "senior_manager"
    hr_recruiter = "hr_recruiter"
    employee = "employee"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(
        Enum(UserRole, name="userrole"),
        default=UserRole.employee,
        nullable=False,
    )
    is_active = Column(Boolean, default=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    employee = relationship("Employee", back_populates="user", uselist=False)
