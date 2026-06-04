/**
 * context/AuthContext.jsx — Global auth state with login/logout
 */
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../api/axios";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("hrms_token");
    const savedUser = localStorage.getItem("hrms_user");
    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.clear();
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email, password) => {
    const response = await api.post("/auth/login/json", { email, password });
    const { access_token, user: userData } = response.data;
    localStorage.setItem("hrms_token", access_token);
    localStorage.setItem("hrms_user", JSON.stringify(userData));
    setToken(access_token);
    setUser(userData);
    return userData;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("hrms_token");
    localStorage.removeItem("hrms_user");
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const response = await api.get("/auth/me");
      const userData = response.data;
      localStorage.setItem("hrms_user", JSON.stringify(userData));
      setUser(userData);
    } catch {
      logout();
    }
  }, [logout]);

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    refreshUser,
    isAdmin: user?.role === "management_admin",
    isManager: user?.role === "senior_manager",
    isHR: user?.role === "hr_recruiter",
    isEmployee: user?.role === "employee",
    hasRole: (...roles) => roles.includes(user?.role),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export default AuthContext;
