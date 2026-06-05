/**
 * App.jsx — Router setup with all pages, protected routes, and real-time context
 */
import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";
import { RealtimeProvider } from "./context/RealtimeContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";
import ChatBot from "./components/ChatBot";

// Pages
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import Attendance from "./pages/Attendance";
import Leave from "./pages/Leave";
import Payroll from "./pages/Payroll";
import Recruitment from "./pages/Recruitment";
import Performance from "./pages/Performance";
import Onboarding from "./pages/Onboarding";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import Analytics from "./pages/Analytics";

// Layout wrapper for authenticated pages
function AppLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Navbar onHamburgerClick={() => setMobileMenuOpen((v) => !v)} />
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
      <ChatBot />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RealtimeProvider>
          {/* Global toast notifications */}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: "#0f172a",
                color: "#f8fafc",
                border: "1px solid #1e293b",
                borderRadius: "12px",
                fontSize: "13px",
                fontFamily: "Inter, sans-serif",
                padding: "12px 16px",
                boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
              },
              success: {
                iconTheme: { primary: "#10b981", secondary: "#0f172a" },
              },
              error: {
                iconTheme: { primary: "#f43f5e", secondary: "#0f172a" },
              },
            }}
          />
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* Protected layout routes */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/leave" element={<Leave />} />
              <Route path="/performance" element={<Performance />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/settings" element={<Settings />} />

              {/* Admin/Manager/HR */}
              <Route
                path="/employees"
                element={
                  <ProtectedRoute allowedRoles={["management_admin", "senior_manager", "hr_recruiter"]}>
                    <Employees />
                  </ProtectedRoute>
                }
              />

              {/* Per-employee drill-down dashboard */}
              <Route
                path="/employees/:employeeId/dashboard"
                element={
                  <ProtectedRoute allowedRoles={["management_admin", "senior_manager", "hr_recruiter"]}>
                    <EmployeeDashboard />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/payroll"
                element={
                  <ProtectedRoute allowedRoles={["management_admin", "hr_recruiter"]}>
                    <Payroll />
                  </ProtectedRoute>
                }
              />

              {/* HR / Admin only */}
              <Route
                path="/recruitment"
                element={
                  <ProtectedRoute allowedRoles={["management_admin", "hr_recruiter"]}>
                    <Recruitment />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/analytics"
                element={
                  <ProtectedRoute allowedRoles={["management_admin", "hr_recruiter"]}>
                    <Analytics />
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* 404 page */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </RealtimeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
