"""
routes/auth.py — Register, login, and profile endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models.user import User
from schemas.auth import UserCreate, UserOut, Token
from auth.jwt_handler import hash_password, verify_password, create_access_token, get_current_user
from slowapi import Limiter
from slowapi.util import get_remote_address

router = APIRouter(prefix="/auth", tags=["Authentication"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/register", response_model=UserOut, status_code=201)
@limiter.limit("10/minute")
async def register(request: Request, payload: UserCreate, db: AsyncSession = Depends(get_db)):
    """Register a new user account."""
    # Check duplicate email
    result = await db.execute(select(User).where(User.email == payload.email))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


@router.post("/login", response_model=Token)
@limiter.limit("10/minute")
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Login with email and password — returns JWT token."""
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account is inactive. Contact your administrator.",
        )

    token = create_access_token(data={"sub": str(user.id), "role": user.role})
    return Token(access_token=token, user=UserOut.model_validate(user))


@router.post("/login/json", response_model=Token)
@limiter.limit("10/minute")
async def login_json(request: Request, payload: dict, db: AsyncSession = Depends(get_db)):
    """JSON-based login (for frontend Axios calls)."""
    email = payload.get("email")
    password = payload.get("password")

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=400,
            detail="Account is inactive. Contact your administrator.",
        )

    token = create_access_token(data={"sub": str(user.id), "role": user.role})
    return Token(access_token=token, user=UserOut.model_validate(user))


@router.post("/change-password")
async def change_password(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Change user password after validating current password."""
    current_password = payload.get("current_password")
    new_password = payload.get("new_password")

    if not current_password or not new_password:
        raise HTTPException(
            status_code=400,
            detail="Current password and new password are required.",
        )

    if not verify_password(current_password, current_user.password_hash):
        raise HTTPException(
            status_code=400,
            detail="Incorrect current password.",
        )

    current_user.password_hash = hash_password(new_password)
    db.add(current_user)
    await db.flush()
    return {"message": "Password changed successfully."}


@router.get("/me", response_model=UserOut)
async def get_profile(current_user: User = Depends(get_current_user)):
    """Get the current user's profile."""
    return current_user


@router.put("/me", response_model=UserOut)
async def update_profile(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update name or password."""
    if "name" in payload:
        current_user.name = payload["name"]
    if "password" in payload and payload["password"]:
        current_user.password_hash = hash_password(payload["password"])
    db.add(current_user)
    await db.flush()
    await db.refresh(current_user)
    return current_user
