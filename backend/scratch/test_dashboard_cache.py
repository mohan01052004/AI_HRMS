import asyncio
import os
import sys

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from main import app
from database import cache_get, cache_set, cache_delete

def test_caching():
    print("[TEST] Starting dashboard caching tests...")
    
    # 1. Test basic caching operations
    print("[TEST] Testing basic cache operations...")
    cache_set("test_key", "hello_world")
    assert cache_get("test_key") == "hello_world", "Cache get should match set value"
    cache_delete("test_key")
    assert cache_get("test_key") is None, "Cache delete should evict value"
    print("[TEST] Basic cache operations verified.")

    # 2. Test route caching using TestClient
    print("[TEST] Testing route caching via TestClient...")
    with TestClient(app) as client:
        # Log in with admin credentials
        login_res = client.post("/auth/login/json", json={
            "email": "admin@hrms.com",
            "password": "HrMs@2026!Sec"
        })
        if login_res.status_code != 200:
            print(f"[ERROR] Login failed: {login_res.json()}")
            sys.exit(1)
        
        auth_data = login_res.json()
        token = auth_data["access_token"]
        user_id = auth_data["user"]["id"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Now test /dashboard/admin caching
        print("[TEST] Requesting /dashboard/admin...")
        # Clear cache first to ensure it's fresh
        cache_delete("admin_dashboard")
        
        res1 = client.get("/dashboard/admin", headers=headers)
        assert res1.status_code == 200, f"Dashboard call failed: {res1.text}"
        data1 = res1.json()
        
        # Verify it exists in cache
        cached_admin = cache_get("admin_dashboard")
        assert cached_admin is not None, "Dashboard data should be cached"
        assert cached_admin["total_employees"] == data1["total_employees"], "Cached data mismatch"
        
        # Modify the cache value directly and call dashboard again to prove cache hit
        print("[TEST] Modifying cache directly...")
        modified_data = data1.copy()
        modified_data["total_employees"] = 9999
        cache_set("admin_dashboard", modified_data)
        
        res2 = client.get("/dashboard/admin", headers=headers)
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["total_employees"] == 9999, "Response should have come from modified cache value"
        print("[TEST] Admin dashboard caching verified.")
        
        # Verify manual delete/eviction
        print("[TEST] Evicting admin dashboard cache...")
        cache_delete("admin_dashboard")
        assert cache_get("admin_dashboard") is None, "Cache should be empty after deletion"
        
        res3 = client.get("/dashboard/admin", headers=headers)
        assert res3.status_code == 200
        data3 = res3.json()
        assert data3["total_employees"] != 9999, "Cache should have been refreshed after eviction"
        print("[TEST] Admin dashboard eviction verified.")

        # Test /dashboard/employee caching
        print("[TEST] Requesting /dashboard/employee...")
        emp_cache_key = f"employee_dashboard_{user_id}"
        cache_delete(emp_cache_key)
        
        emp_res1 = client.get("/dashboard/employee", headers=headers)
        assert emp_res1.status_code == 200, f"Employee dashboard call failed: {emp_res1.text}"
        emp_data1 = emp_res1.json()
        
        # Verify it's cached
        cached_emp = cache_get(emp_cache_key)
        assert cached_emp is not None, "Employee dashboard should be cached"
        
        # Modify cached value
        modified_emp = emp_data1.copy()
        modified_emp["my_attendance_this_month"] = 8888
        cache_set(emp_cache_key, modified_emp)
        
        emp_res2 = client.get("/dashboard/employee", headers=headers)
        assert emp_res2.status_code == 200
        emp_data2 = emp_res2.json()
        assert emp_data2["my_attendance_this_month"] == 8888, "Should return cached data"
        
        # Test eviction
        cache_delete(emp_cache_key)
        emp_res3 = client.get("/dashboard/employee", headers=headers)
        assert emp_res3.status_code == 200
        emp_data3 = emp_res3.json()
        assert emp_data3["my_attendance_this_month"] != 8888, "Cache should be refreshed after eviction"
        print("[TEST] Employee dashboard caching and eviction verified.")
        
    print("[TEST] All dashboard caching tests passed successfully!")

if __name__ == "__main__":
    test_caching()
