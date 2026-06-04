import asyncio
from database import AsyncSessionLocal
from sqlalchemy import select
from models.user import User
from auth.jwt_handler import hash_password

async def reset():
    async with AsyncSessionLocal() as db:
        user_res = await db.execute(select(User).where(User.email == 'suhas@hrms.com'))
        user = user_res.scalar_one_or_none()
        if user:
            new_pwd = "HrMs@2026!Sec"
            user.password_hash = hash_password(new_pwd)
            db.add(user)
            await db.flush()
            print(f"Successfully reset password for suhas@hrms.com to '{new_pwd}'")
        else:
            print("User suhas@hrms.com not found")

if __name__ == "__main__":
    asyncio.run(reset())
