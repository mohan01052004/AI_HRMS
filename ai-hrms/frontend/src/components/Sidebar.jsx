/**
 * components/Sidebar.jsx — Collapsible sidebar with role-aware navigation
 * - Desktop: icon-collapse toggle button
 * - Mobile: hidden by default, opened via hamburger in Navbar (uses mobileOpen prop)
 */
import { useState, useEffect } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard, Users, Clock, CalendarOff, DollarSign,
  Briefcase, BarChart3, ClipboardList, LogOut, ChevronLeft,
  ChevronRight, Building2, Bot, X,
} from "lucide-react";

const ALL_NAV_ITEMS = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["management_admin", "senior_manager", "hr_recruiter", "employee"] },
  { path: "/employees", label: "Employees", icon: Users, roles: ["management_admin", "senior_manager", "hr_recruiter"] },
  { path: "/attendance", label: "Attendance", icon: Clock, roles: ["management_admin", "senior_manager", "hr_recruiter", "employee"] },
  { path: "/leave", label: "Leave", icon: CalendarOff, roles: ["management_admin", "senior_manager", "hr_recruiter", "employee"] },
  { path: "/payroll", label: "Payroll", icon: DollarSign, roles: ["management_admin", "hr_recruiter"] },
  { path: "/recruitment", label: "Recruitment", icon: Briefcase, roles: ["management_admin", "hr_recruiter"] },
  { path: "/performance", label: "Performance", icon: BarChart3, roles: ["management_admin", "senior_manager", "hr_recruiter", "employee"] },
  { path: "/onboarding", label: "Onboarding", icon: ClipboardList, roles: ["management_admin", "senior_manager", "employee"] },
];

const ROLE_LABELS = {
  management_admin: "Management Admin",
  senior_manager: "Senior Manager",
  hr_recruiter: "HR Recruiter",
  employee: "Employee",
};

const ROLE_COLORS = {
  management_admin: "text-violet-400 bg-violet-400/10",
  senior_manager: "text-blue-400 bg-blue-400/10",
  hr_recruiter: "text-emerald-400 bg-emerald-400/10",
  employee: "text-amber-400 bg-amber-400/10",
};

export default function Sidebar({ mobileOpen, onMobileClose }) {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-slate-800 ${collapsed ? "justify-center" : ""}`}>
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0">
          <Building2 size={16} className="text-white" />
        </div>
        {!collapsed && (
          <div>
            <p className="font-bold text-white text-sm leading-tight">AI-HRMS</p>
            <p className="text-xs text-slate-500">HR Platform</p>
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

      {/* Collapse toggle — desktop only */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-[4.5rem] w-6 h-6 rounded-full bg-slate-800 border border-slate-700
          hidden lg:flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors z-10"
        id="sidebar-toggle"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* User info */}
      {!collapsed && (
        <div className="px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
              <span className="text-xs font-bold text-white">
                {user?.name?.charAt(0)?.toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ROLE_COLORS[user?.role]}`}>
                {ROLE_LABELS[user?.role]}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            id={`nav-${label.toLowerCase()}`}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
              ${isActive
                ? "bg-violet-600/20 text-violet-400 border border-violet-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
              }
              ${collapsed ? "justify-center" : ""}
            `
            }
            title={collapsed ? label : undefined}
          >
            <Icon size={18} className="shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* AI Chat hint */}
      {!collapsed && (
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-600/10 border border-violet-600/20">
            <Bot size={14} className="text-violet-400 shrink-0" />
            <p className="text-xs text-violet-400">AI Assistant active</p>
          </div>
        </div>
      )}

      {/* Logout */}
      <div className="px-2 pb-3 border-t border-slate-800 pt-2">
        <button
          onClick={handleLogout}
          id="sidebar-logout"
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm
            text-slate-400 hover:text-rose-400 hover:bg-rose-400/10 transition-all
            ${collapsed ? "justify-center" : ""}
          `}
          title={collapsed ? "Logout" : undefined}
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar — always visible */}
      <div className="hidden lg:flex h-screen">
        {sidebarContent}
      </div>

      {/* Mobile sidebar — slide-in overlay */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
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
