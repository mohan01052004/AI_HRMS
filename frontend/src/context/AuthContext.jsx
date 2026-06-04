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

  // Initialize from sessionStorage on mount
  useEffect(() => {
    const savedToken = sessionStorage.getItem("hrms_token");
    const savedUser = sessionStorage.getItem("hrms_user");
    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch {
        sessionStorage.clear();
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email, password) => {
    const response = await api.post("/auth/login/json", { email, password });
    const { access_token, user: userData } = response.data;
    sessionStorage.setItem("hrms_token", access_token);
    sessionStorage.setItem("hrms_user", JSON.stringify(userData));
    setToken(access_token);
    setUser(userData);
    return userData;
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem("hrms_token");
    sessionStorage.removeItem("hrms_user");
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const response = await api.get("/auth/me");
      const userData = response.data;
      sessionStorage.setItem("hrms_user", JSON.stringify(userData));
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
