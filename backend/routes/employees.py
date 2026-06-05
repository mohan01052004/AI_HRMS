"""
routes/employees.py — Complete Employee Management API
Endpoints:
  GET    /employees              — paginated list with search + filters
  POST   /employees              — create employee (Admin/Manager only)
  GET    /employees/stats        — dashboard statistics
  GET    /employees/departments  — list all departments
  POST   /employees/departments  — create department (Admin/Manager)
  GET    /employees/{id}         — single employee detail
  PUT    /employees/{id}         — update employee (Admin/Manager)
  DELETE /employees/{id}         — soft-delete: set status=inactive (Admin only)
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from typing import List, Optional

from database import get_db
from models.employee import Employee, Department, EmployeeStatus
from models.user import User
from schemas.employee import (
    EmployeeCreate,
    EmployeeUpdate,
    EmployeeOut,
    EmployeeListOut,
    EmployeeStats,
    DepartmentCreate,
    DepartmentOut,
    DepartmentWithCount,
)
from auth.jwt_handler import (
    get_current_user,
    require_admin,
    require_admin_or_manager,
)

router = APIRouter(prefix="/employees", tags=["Employees"])


# ─── Helpers ─────────────────────────────────────────────────────────────────

async def _get_employee_or_404(employee_id: int, db: AsyncSession) -> Employee:
    result = await db.execute(
        select(Employee)
        .options(selectinload(Employee.department))
        .where(Employee.id == employee_id)
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with id={employee_id} not found.",
        )
    return emp


# Role → employee-code prefix mapping
_ROLE_PREFIX = {
    "management_admin": "ADM",
    "senior_manager":   "MGR",
    "hr_recruiter":     "HR",
    "employee":         "EMP",
}

async def _generate_employee_code(db: AsyncSession, role: str) -> str:
    """Generate the next sequential code for the given role, e.g. EMP-0042."""
    role_str = role.value if hasattr(role, "value") else str(role)
    prefix = _ROLE_PREFIX.get(role_str, "EMP")
    # Find the highest existing number for this prefix
    result = await db.execute(
        select(Employee.employee_code)
        .where(Employee.employee_code.like(f"{prefix}-%"))
    )
    codes = result.scalars().all()
    max_num = 0
    for code in codes:
        try:
            num = int(code.split("-")[1])
            if num > max_num:
                max_num = num
        except (IndexError, ValueError):
            pass
    return f"{prefix}-{str(max_num + 1).zfill(4)}"


# ─── Department Endpoints ─────────────────────────────────────────────────────

@router.get("/departments", response_model=List[DepartmentOut], summary="List all departments")
async def list_departments(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Return all departments. Accessible to all authenticated users."""
    result = await db.execute(select(Department).order_by(Department.name))
    return result.scalars().all()


@router.get(
    "/departments/with-count",
    response_model=List[DepartmentWithCount],
    summary="Departments with employee count",
)
async def list_departments_with_count(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Departments annotated with their employee headcount."""
    rows = await db.execute(
        select(
            Department,
            func.count(Employee.id).label("employee_count"),
        )
        .outerjoin(Employee, Employee.department_id == Department.id)
        .group_by(Department.id)
        .order_by(Department.name)
    )
    results = []
    for dept, count in rows:
        out = DepartmentWithCount.model_validate(dept)
        out.employee_count = count
        results.append(out)
    return results


@router.post(
    "/departments",
    response_model=DepartmentOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a department (Admin/Manager)",
)
async def create_department(
    payload: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_or_manager),
):
    """Create a new department. Requires Admin or Manager role."""
    existing = await db.execute(
        select(Department).where(Department.name == payload.name)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Department '{payload.name}' already exists.",
        )
    dept = Department(**payload.model_dump())
    db.add(dept)
    await db.flush()
    await db.refresh(dept)
    return dept


# ─── Employee Stats ───────────────────────────────────────────────────────────

@router.get("/stats", response_model=EmployeeStats, summary="Employee dashboard statistics")
async def employee_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Returns total, active, inactive, on_leave, terminated counts
    plus department distribution. Used by Dashboard.
    """
    total = (await db.execute(select(func.count(Employee.id)))).scalar() or 0

    status_counts = {}
    for s in EmployeeStatus:
        count = (
            await db.execute(
                select(func.count(Employee.id)).where(Employee.status == s)
            )
        ).scalar() or 0
        status_counts[s.value] = count

    dept_rows = await db.execute(
        select(Department.name, func.count(Employee.id).label("count"))
        .outerjoin(Employee, Employee.department_id == Department.id)
        .group_by(Department.id, Department.name)
        .order_by(func.count(Employee.id).desc())
    )
    dept_distribution = [
        {"department": row.name, "count": row.count} for row in dept_rows
    ]

    return EmployeeStats(
        total=total,
        active=status_counts.get("active", 0),
        inactive=status_counts.get("inactive", 0),
        on_leave=status_counts.get("on_leave", 0),
        terminated=status_counts.get("terminated", 0),
        department_distribution=dept_distribution,
    )



# ─── My Employee Record ───────────────────────────────────────────────────────

@router.get("/me", response_model=EmployeeOut, summary="Get the current user's employee record")
async def get_my_employee(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns the Employee record linked to the authenticated user.
    Used by employees to get their own employee_id for goals, attendance, etc.
    """
    result = await db.execute(
        select(Employee)
        .options(selectinload(Employee.department))
        .where(Employee.user_id == current_user.id)
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No employee profile linked to your account.",
        )
    return emp


# ─── List Employees (paginated) ───────────────────────────────────────────────

@router.get("", response_model=EmployeeListOut, summary="List employees with pagination & filters")
async def list_employees(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=200, description="Max records to return"),
    search: Optional[str] = Query(None, description="Search by name, email, or designation"),
    department_id: Optional[int] = Query(None, description="Filter by department ID"),
    status_filter: Optional[EmployeeStatus] = Query(None, alias="status", description="Filter by status"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Paginated employee list with optional search and filters.
    - `search`: matches name, email, or designation (case-insensitive)
    - `status`: active | inactive | on_leave | terminated
    - `department_id`: filter by specific department
    """
    # Base query with department eager-loaded
    base = select(Employee).options(selectinload(Employee.department))
    count_q = select(func.count(Employee.id))

    filters = []
    if department_id is not None:
        filters.append(Employee.department_id == department_id)
    if status_filter is not None:
        filters.append(Employee.status == status_filter)
    if search:
        term = f"%{search.strip()}%"
        filters.append(
            or_(
                Employee.name.ilike(term),
                Employee.email.ilike(term),
                Employee.designation.ilike(term),
            )
        )

    for f in filters:
        base = base.where(f)
        count_q = count_q.where(f)

    total = (await db.execute(count_q)).scalar() or 0
    result = await db.execute(
        base.order_by(Employee.name).offset(skip).limit(limit)
    )
    items = result.scalars().all()

    return EmployeeListOut(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
        has_more=(skip + limit) < total,
    )


# ─── Get Single Employee ──────────────────────────────────────────────────────

@router.get("/{employee_id}", response_model=EmployeeOut, summary="Get employee by ID")
async def get_employee(
    employee_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Fetch a single employee's full profile including department info."""
    return await _get_employee_or_404(employee_id, db)


# ─── Create Employee ──────────────────────────────────────────────────────────

@router.post(
    "",
    response_model=EmployeeOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new employee (Admin/HR)",
)
async def create_employee(
    payload: EmployeeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new employee record and associated login details.
    - Admins can create Senior Manager, HR Recruiter, or Employee accounts.
    - HR Recruiters can only create Employee accounts, which require Admin approval.
    """
    # Authorization check
    if current_user.role not in ["management_admin", "hr_recruiter"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to create employee accounts.",
        )

    # Unique email check
    dup = await db.execute(select(Employee).where(Employee.email == payload.email))
    if dup.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An employee with email '{payload.email}' already exists.",
        )

    # Validate department_id
    if payload.department_id is not None:
        dept = await db.execute(
            select(Department).where(Department.id == payload.department_id)
        )
        if not dept.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Department with id={payload.department_id} does not exist.",
            )

    # Validate manager_id
    if payload.manager_id is not None:
        mgr = await db.execute(
            select(Employee).where(Employee.id == payload.manager_id)
        )
        if not mgr.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Manager with id={payload.manager_id} does not exist.",
            )

    # Resolve approval status:
    # HR creations require Admin approval (is_approved=False, user.is_active=False)
    # Admin/Manager creations are auto-approved.
    needs_approval = (current_user.role == "hr_recruiter")
    is_approved = not needs_approval
    is_active = is_approved

    # Auto-create User login details if not linked already
    user_id = payload.user_id
    if not user_id:
        target_role = payload.role or "employee"
        
        # HR can only create logins for the "employee" role
        if current_user.role == "hr_recruiter" and target_role != "employee":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="HR Recruiters are only allowed to create logins for the 'employee' role.",
            )

        # Check duplicate email in User table
        user_dup = await db.execute(select(User).where(User.email == payload.email))
        if user_dup.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A user login account with email '{payload.email}' already exists.",
            )

        from auth.jwt_handler import hash_password
        default_pwd = payload.password or "Company@2026!"
        
        new_user = User(
            name=payload.name,
            email=payload.email,
            password_hash=hash_password(default_pwd),
            role=target_role,
            is_active=is_active,
        )
        db.add(new_user)
        await db.flush()
        user_id = new_user.id

    # Create employee record
    target_role_for_code = payload.role or "employee"
    if current_user.role == "hr_recruiter":
        target_role_for_code = "employee"
    elif payload.user_id:
        user_res = await db.execute(select(User).where(User.id == payload.user_id))
        existing_user = user_res.scalar_one_or_none()
        if existing_user:
            target_role_for_code = existing_user.role

    emp_code = await _generate_employee_code(db, target_role_for_code)

    emp = Employee(
        user_id=user_id,
        employee_code=emp_code,
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
        department_id=payload.department_id,
        designation=payload.designation,
        date_of_joining=payload.date_of_joining,
        salary=payload.salary,
        status=payload.status,
        manager_id=payload.manager_id,
        address=payload.address,
        gender=payload.gender,
        is_approved=is_approved,
    )
    db.add(emp)
    await db.flush()

    # Reload with relationships
    result = await db.execute(
        select(Employee)
        .options(selectinload(Employee.department))
        .where(Employee.id == emp.id)
    )
    return result.scalar_one()


@router.put(
    "/{employee_id}/approve",
    response_model=EmployeeOut,
    summary="Approve a pending employee login (Admin only)",
)
async def approve_employee(
    employee_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """
    Approve an employee created by HR. Activates their login details and sets is_approved=True.
    Requires Admin role.
    """
    result = await db.execute(
        select(Employee)
        .options(selectinload(Employee.department), selectinload(Employee.user))
        .where(Employee.id == employee_id)
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with id={employee_id} not found.",
        )

    emp.is_approved = True
    if emp.user:
        emp.user.is_active = True
        db.add(emp.user)

    db.add(emp)
    await db.flush()
    return emp



# ─── Update Employee ──────────────────────────────────────────────────────────

@router.patch(
    "/{employee_id}",
    response_model=EmployeeOut,
    summary="Partially update employee details (Profile / Admin)",
)
@router.put(
    "/{employee_id}",
    response_model=EmployeeOut,
    summary="Update employee details (Admin/Manager)",
)
async def update_employee(
    employee_id: int,
    payload: EmployeeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Partially update an employee. Only provided fields are changed.
    - Admins/Managers can update any employee record and any fields.
    - Regular employees can update ONLY their own phone and address.
    """
    emp = await _get_employee_or_404(employee_id, db)

    is_self = (emp.user_id == current_user.id)
    is_admin_or_mgr = current_user.role in ["management_admin", "senior_manager"]

    if not is_admin_or_mgr and not is_self:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to update this employee profile.",
        )

    update_data = payload.model_dump(exclude_unset=True)

    if not is_admin_or_mgr:
        # Regular employee check: can only update 'phone' and 'address'
        allowed_keys = {"phone", "address"}
        disallowed_keys = set(update_data.keys()) - allowed_keys
        if disallowed_keys:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You are only allowed to update your own: {', '.join(allowed_keys)}.",
            )


    # Validate department_id if being changed
    if "department_id" in update_data and update_data["department_id"] is not None:
        dept = await db.execute(
            select(Department).where(Department.id == update_data["department_id"])
        )
        if not dept.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Department with id={update_data['department_id']} does not exist.",
            )

    # Validate manager_id if being changed (prevent self-reference)
    if "manager_id" in update_data and update_data["manager_id"] is not None:
        if update_data["manager_id"] == employee_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="An employee cannot be their own manager.",
            )
        mgr = await db.execute(
            select(Employee).where(Employee.id == update_data["manager_id"])
        )
        if not mgr.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Manager with id={update_data['manager_id']} does not exist.",
            )

    for key, value in update_data.items():
        setattr(emp, key, value)

    db.add(emp)
    await db.flush()

    # Reload with relationships
    result = await db.execute(
        select(Employee)
        .options(selectinload(Employee.department))
        .where(Employee.id == emp.id)
    )
    return result.scalar_one()


# ─── Soft-Delete Employee ─────────────────────────────────────────────────────

@router.delete(
    "/{employee_id}",
    status_code=status.HTTP_200_OK,
    summary="Soft-delete employee — sets status to inactive (Admin only)",
)
async def delete_employee(
    employee_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """
    Soft-delete: marks the employee as `inactive` rather than removing the record.
    This preserves historical data (attendance, payroll, leave).
    Requires Admin role only.
    """
    emp = await _get_employee_or_404(employee_id, db)

    if emp.status == EmployeeStatus.inactive:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Employee is already inactive.",
        )

    emp.status = EmployeeStatus.inactive
    db.add(emp)
    await db.flush()

    return {
        "message": f"Employee '{emp.name}' (id={emp.id}) has been deactivated.",
        "id": emp.id,
        "status": emp.status,
    }
