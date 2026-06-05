/**
 * components/Navbar.jsx — Top navbar with working notifications, profile, settings, and Theme Switcher
 */
import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useRealtime } from "../context/RealtimeContext";
import { useTheme } from "../context/ThemeContext";
import {
  Bell, ChevronDown, LogOut, User, Settings,
  CheckCheck, Info, AlertTriangle, CalendarClock, Menu,
  Sun, Moon,
} from "lucide-react";

const PAGE_TITLES = {
  "/dashboard":   "Dashboard",
  "/employees":   "Employees",
  "/attendance":  "Attendance",
  "/leave":       "Leave Management",
  "/payroll":     "Payroll",
  "/recruitment": "Recruitment",
  "/performance": "Performance",
  "/onboarding":  "Onboarding",
  "/profile":     "My Profile",
  "/settings":    "Settings",
};

export default function Navbar({ onHamburgerClick }) {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAllRead, status: wsStatus } = useRealtime();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [showMenu, setShowMenu]   = useState(false);
  const [showBell, setShowBell]   = useState(false);

  const bellRef = useRef(null);
  const menuRef = useRef(null);

  const pageTitle = PAGE_TITLES[location.pathname] ||
    (location.pathname.includes("/employees/") && location.pathname.includes("/dashboard")
      ? "Employee Dashboard" : "Dashboard");

  // Close panels when clicking outside
  useEffect(() => {
    function handler(e) {
      if (bellRef.current && !bellRef.current.contains(e.target)) setShowBell(false);
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleNotificationClick = (n) => {
    setShowBell(false);
    const title = n.title.toLowerCase();
    if (title.includes("leave")) navigate("/leave");
    else if (title.includes("payroll") || title.includes("payslip")) navigate("/payroll");
    else if (title.includes("goal") || title.includes("performance")) navigate("/performance");
    else if (title.includes("attendance") || title.includes("clock")) navigate("/attendance");
  };

  const handleLogout = () => {
    setShowMenu(false);
    logout();
    navigate("/login");
  };

  const goTo = (path) => {
    setShowMenu(false);
    navigate(path);
  };

  return (
    <header className="h-16 bg-slate-900 backdrop-blur-xl border-b border-slate-800 flex items-center justify-between px-4 sm:px-6 shrink-0 relative z-30">
      {/* Left — Hamburger (mobile) + Page title */}
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          id="navbar-hamburger"
          onClick={onHamburgerClick}
          className="lg:hidden w-9 h-9 rounded-xl bg-slate-900/60 border border-white/5 flex items-center
            justify-center text-slate-400 hover:text-white hover:border-violet-500/30 transition-all shrink-0"
          aria-label="Toggle navigation menu"
        >
          <Menu size={16} />
        </button>
        <div>
          <h1 className="text-white font-bold text-base font-display tracking-wide">{pageTitle}</h1>
          <p className="text-slate-500 text-[10px] hidden sm:block font-semibold uppercase tracking-wider">
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long", year: "numeric", month: "long", day: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* Right — Actions */}
      <div className="flex items-center gap-3">

        {/* ── Theme Toggle Button ── */}
        <button
          onClick={toggleTheme}
          className="w-9 h-9 rounded-xl bg-slate-900/60 border border-white/5 flex items-center
            justify-center text-slate-400 hover:text-white hover:border-violet-500/30 transition-all duration-300"
          aria-label="Toggle theme mode"
          title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
        >
          {theme === "light" ? <Moon size={15} /> : <Sun size={15} />}
        </button>

        {/* ── Notification Bell ── */}
        <div ref={bellRef} className="relative">
          <button
            id="navbar-notifications"
            onClick={() => { setShowBell((v) => !v); setShowMenu(false); }}
            className="relative w-9 h-9 rounded-xl bg-slate-900/60 border border-white/5 flex items-center
              justify-center text-slate-400 hover:text-white hover:border-violet-500/30 transition-all duration-300"
          >
            <Bell size={15} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-violet-600 rounded-full text-[8px]
                text-white flex items-center justify-center font-bold animate-pulse shadow-md shadow-violet-600/35">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
            {/* Real-time connection dot */}
            <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-slate-950 ${
              wsStatus === "connected" ? "bg-emerald-500" :
              wsStatus === "connecting" ? "bg-amber-400 animate-pulse" : "bg-slate-600"
            }`} title={`Real-time: ${wsStatus}`} />
          </button>

          {showBell && (
            <div className="fixed left-4 right-4 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 glass-card
              rounded-2xl shadow-2xl shadow-black/50 overflow-hidden z-50 border border-white/10 animate-fade-in">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <Bell size={13} className="text-violet-400" />
                  <h4 className="text-xs font-bold text-white font-display tracking-wider uppercase">Notifications</h4>
                  {unreadCount > 0 && (
                    <span className="text-[9px] px-1.5 py-0.5 bg-violet-600/20 text-violet-400 rounded-full font-bold">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-violet-400 font-semibold transition-colors"
                  >
                    <CheckCheck size={11} />
                    Mark all read
                  </button>
                )}
              </div>

              {/* Notification list */}
              <div className="max-h-72 overflow-y-auto divide-y divide-white/5">
                {notifications.length === 0 ? (
                  <div className="py-10 text-center">
                    <Bell size={22} className="text-slate-700 mx-auto mb-2" />
                    <p className="text-slate-500 text-xs font-medium font-sans">All caught up!</p>
                    <p className="text-slate-600 text-[10px] mt-0.5 font-sans">Real-time alerts will appear here.</p>
                  </div>
                ) : (
                  notifications.slice(0, 20).map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`flex gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-white/5
                        ${!n.read ? "bg-violet-500/5" : ""}`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {n.event === "attendance_update" ? <CalendarClock size={13} className="text-emerald-400" /> :
                         n.event === "leave_update" ? <CalendarClock size={13} className="text-violet-400" /> :
                         <Info size={13} className="text-sky-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold leading-snug ${!n.read ? "text-white" : "text-slate-300"}`}>
                          {n.title}
                        </p>
                        <p className="text-[9px] text-slate-500 mt-1 font-medium font-sans">
                          {new Date(n.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      {!n.read && (
                        <div className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0 mt-1.5" />
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-white/5 px-4 py-2.5 bg-slate-950/30">
                <p className="text-[10px] text-slate-500 text-center font-medium font-sans">
                  Notifications are cleared on logout
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── User Menu ── */}
        <div ref={menuRef} className="relative">
          <button
            id="navbar-user-menu"
            onClick={() => { setShowMenu((v) => !v); setShowBell(false); }}
            className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl bg-slate-900/60 border border-white/5
              hover:border-violet-500/30 transition-all duration-300"
          >
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500
              flex items-center justify-center shrink-0 shadow-md shadow-violet-500/10">
              <span className="text-xs font-bold text-white font-sans">
                {user?.name?.charAt(0)?.toUpperCase()}
              </span>
            </div>
            <span className="text-xs text-white font-bold hidden sm:block max-w-[100px] truncate font-display">
              {user?.name}
            </span>
            <ChevronDown
              size={12}
              className={`text-slate-500 transition-transform duration-200 ${showMenu ? "rotate-180" : ""}`}
            />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full mt-2 w-52 glass-card
              rounded-2xl shadow-2xl shadow-black/50 overflow-hidden py-1.5 z-50 border border-white/10 animate-fade-in">
              {/* User info header */}
              <div className="px-4 py-3 border-b border-white/5 mb-1.5 bg-slate-950/20">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500
                    flex items-center justify-center shrink-0 shadow-md shadow-violet-500/10">
                    <span className="text-xs font-bold text-white font-sans">
                      {user?.name?.charAt(0)?.toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-white font-bold truncate leading-tight font-display">{user?.name}</p>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5 font-sans">{user?.email}</p>
                  </div>
                </div>
                <span className="mt-2 inline-block text-[9px] px-2 py-0.5 rounded-full
                  bg-violet-500/10 text-violet-400 font-bold border border-violet-500/20 uppercase tracking-wider">
                  {user?.role?.replace(/_/g, " ")}
                </span>
              </div>

              {/* Menu items */}
              <button
                id="navbar-profile"
                onClick={() => goTo("/profile")}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-slate-300
                  hover:text-white hover:bg-white/5 transition-colors font-display"
              >
                <div className="w-6 h-6 rounded-lg bg-slate-950 flex items-center justify-center border border-white/5">
                  <User size={11} className="text-violet-400" />
                </div>
                My Profile
              </button>

              <button
                id="navbar-settings"
                onClick={() => goTo("/settings")}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-slate-300
                  hover:text-white hover:bg-white/5 transition-colors font-display"
              >
                <div className="w-6 h-6 rounded-lg bg-slate-950 flex items-center justify-center border border-white/5">
                  <Settings size={11} className="text-violet-400" />
                </div>
                Settings
              </button>

              <div className="border-t border-white/5 mt-1.5 pt-1.5 bg-slate-950/20">
                <button
                  id="navbar-logout"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-rose-400
                    hover:bg-rose-500/5 transition-colors font-display"
                >
                  <div className="w-6 h-6 rounded-lg bg-rose-500/10 flex items-center justify-center">
                    <LogOut size={11} className="text-rose-400" />
                  </div>
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
