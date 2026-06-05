/**
 * components/Sidebar.jsx — Collapsible sidebar with premium Glassmorphism & role-aware navigation
 */
import { useState, useEffect } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import {
  LayoutDashboard, Users, Clock, CalendarOff, DollarSign,
  Briefcase, BarChart3, ClipboardList, LogOut, ChevronLeft,
  ChevronRight, Building2, Bot, X, PieChart,
} from "lucide-react";

const ALL_NAV_ITEMS = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["management_admin", "senior_manager", "hr_recruiter", "employee"] },
  { path: "/employees", label: "Employees", icon: Users, roles: ["management_admin", "senior_manager", "hr_recruiter"] },
  { path: "/attendance", label: "Attendance", icon: Clock, roles: ["management_admin", "senior_manager", "hr_recruiter", "employee"] },
  { path: "/leave", label: "Leave", icon: CalendarOff, roles: ["management_admin", "senior_manager", "hr_recruiter", "employee"] },
  { path: "/payroll", label: "Payroll", icon: DollarSign, roles: ["management_admin", "hr_recruiter"] },
  { path: "/recruitment", label: "Recruitment", icon: Briefcase, roles: ["management_admin", "hr_recruiter"] },
  { path: "/analytics", label: "Analytics", icon: PieChart, roles: ["management_admin", "hr_recruiter"] },
  { path: "/performance", label: "Performance", icon: BarChart3, roles: ["management_admin", "senior_manager", "hr_recruiter", "employee"] },
  { path: "/onboarding", label: "Onboarding", icon: ClipboardList, roles: ["management_admin", "senior_manager", "employee"] },
];

const ROLE_LABELS = {
  management_admin: "Admin",
  senior_manager: "Sr. Manager",
  hr_recruiter: "HR Recruiter",
  employee: "Employee",
};

const ROLE_COLORS = {
  management_admin: "text-violet-400 bg-violet-400/10 border-violet-500/20",
  senior_manager: "text-blue-400 bg-blue-400/10 border-blue-500/20",
  hr_recruiter: "text-emerald-400 bg-emerald-400/10 border-emerald-500/20",
  employee: "text-amber-400 bg-amber-400/10 border-amber-500/20",
};

export default function Sidebar({ mobileOpen, onMobileClose }) {
  const [collapsed, setCollapsed] = useState(false);
  const [empCode, setEmpCode] = useState(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Fetch this user's employee code once on mount
  useEffect(() => {
    api.get("/employees/me")
      .then(res => setEmpCode(res.data.employee_code || null))
      .catch(() => {});
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    if (onMobileClose) onMobileClose();
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const navItems = ALL_NAV_ITEMS.filter((item) =>
    item.roles.includes(user?.role)
  );

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const sidebarContent = (
    <aside
      className={`
        relative flex flex-col bg-slate-900 border-r border-slate-800
        transition-all duration-300 ease-in-out shrink-0 h-full
        ${collapsed ? "w-16" : "w-60"}
      `}
    >
      {/* Sidebar background visual blob */}
      <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-violet-600/5 to-transparent pointer-events-none" />

      {/* Logo Section */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-slate-800 relative z-10 ${collapsed ? "justify-center" : ""}`}>
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shrink-0 shadow-md shadow-violet-500/10">
          <Building2 size={16} className="text-white" />
        </div>
        {!collapsed && (
          <div>
            <p className="font-extrabold text-white text-sm leading-tight tracking-tight font-display text-glow-violet">
              AI-HRMS
            </p>
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">HR Platform</p>
          </div>
        )}
        {/* Mobile close button */}
        {onMobileClose && (
          <button
            onClick={onMobileClose}
            className="ml-auto lg:hidden p-1 rounded-lg text-slate-400 hover:text-white"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Collapse toggle button — desktop only */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-[4.5rem] w-6 h-6 rounded-full bg-slate-900 border border-slate-800
          hidden lg:flex items-center justify-center text-slate-400 hover:text-white hover:border-violet-500/30 transition-colors z-20"
        id="sidebar-toggle"
      >
        {collapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
      </button>

      {/* User profile widget */}
      {!collapsed && (
        <div className="px-4 py-4 border-b border-slate-800 relative z-10">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shadow-md shadow-violet-500/15">
                <span className="text-sm font-bold text-white">
                  {user?.name?.charAt(0)?.toUpperCase()}
                </span>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-slate-950 rounded-full" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate font-display leading-tight">{user?.name}</p>
              <span className={`inline-block mt-0.5 text-[9px] px-2 py-0.5 rounded-full font-semibold border uppercase tracking-wider ${ROLE_COLORS[user?.role]}`}>
                {ROLE_LABELS[user?.role]}
              </span>
              {empCode && (
                <p className="text-[9px] text-slate-500 font-mono mt-0.5 tracking-wider">{empCode}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Navigation Links */}
      <nav className="flex-1 px-2.5 py-4 space-y-1 overflow-y-auto relative z-10">
        {navItems.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            id={`nav-${label.toLowerCase()}`}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 relative group
              ${isActive
                ? "bg-gradient-to-r from-violet-600/15 to-fuchsia-600/5 text-violet-300 border border-violet-500/20 shadow-sm shadow-violet-500/5"
                : "text-slate-400 hover:text-white hover:bg-slate-950/20 border border-transparent hover:border-slate-800"
              }
              ${collapsed ? "justify-center" : ""}
            `
            }
            title={collapsed ? label : undefined}
          >
            <Icon size={16} className="shrink-0 group-hover:scale-105 transition-transform duration-200" />
            {!collapsed && <span className="font-display tracking-wide">{label}</span>}
            
            {/* Glowing active indicator line */}
            {({ isActive }) => isActive && !collapsed && (
              <span className="absolute right-3 w-1.5 h-1.5 rounded-full bg-violet-400 shadow-md shadow-violet-400/50" />
            )}
          </NavLink>
        ))}
      </nav>

      {/* AI Assistant active indicator widget */}
      {!collapsed && (
        <div className="px-3 pb-3 relative z-10">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-violet-600/5 border border-violet-500/10">
            <Bot size={13} className="text-violet-400 shrink-0 animate-pulse" />
            <p className="text-[10px] text-violet-400 font-semibold uppercase tracking-wider">AI Assistant Online</p>
          </div>
        </div>
      )}

      {/* Logout Button */}
      <div className="px-2.5 pb-4 border-t border-slate-800 pt-3 relative z-10">
        <button
          onClick={handleLogout}
          id="sidebar-logout"
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold
            text-slate-400 hover:text-rose-400 hover:bg-rose-500/5 border border-transparent hover:border-rose-500/10 transition-all duration-300
            ${collapsed ? "justify-center" : ""}
          `}
          title={collapsed ? "Logout" : undefined}
        >
          <LogOut size={16} className="shrink-0" />
          {!collapsed && <span className="font-display tracking-wide">Logout</span>}
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar — always visible */}
      <div className="hidden lg:flex h-screen bg-slate-950">
        {sidebarContent}
      </div>

      {/* Mobile sidebar — slide-in overlay */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden transition-all"
            onClick={onMobileClose}
          />
          {/* Drawer */}
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden flex h-screen">
            {sidebarContent}
          </div>
        </>
      )}
    </>
  );
}
