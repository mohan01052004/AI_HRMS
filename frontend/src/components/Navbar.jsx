/**
 * components/Navbar.jsx — Top navbar with working notifications, profile & settings
 */
import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useRealtime } from "../context/RealtimeContext";
import {
  Bell, ChevronDown, LogOut, User, Settings,
  CheckCheck, Info, AlertTriangle, CalendarClock, X, Menu, Wifi, WifiOff,
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

const NOTIF_ICON = {
  info:    <Info size={14} className="text-sky-400" />,
  warning: <AlertTriangle size={14} className="text-amber-400" />,
  success: <CalendarClock size={14} className="text-emerald-400" />,
};

export default function Navbar({ onHamburgerClick }) {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAllRead, status: wsStatus } = useRealtime();
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
    <header className="h-16 bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 flex items-center justify-between px-4 sm:px-6 shrink-0 relative z-30">
      {/* Left — Hamburger (mobile) + Page title */}
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          id="navbar-hamburger"
          onClick={onHamburgerClick}
          className="lg:hidden w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center
            justify-center text-slate-400 hover:text-white hover:border-slate-600 transition-all shrink-0"
          aria-label="Toggle navigation menu"
        >
          <Menu size={18} />
        </button>
        <div>
          <h1 className="text-white font-semibold text-base">{pageTitle}</h1>
          <p className="text-slate-500 text-xs hidden sm:block">
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long", year: "numeric", month: "long", day: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* Right — Actions */}
      <div className="flex items-center gap-3">

          {/* ── Notification Bell ── */}
        <div ref={bellRef} className="relative">
          <button
            id="navbar-notifications"
            onClick={() => { setShowBell((v) => !v); setShowMenu(false); }}
            className="relative w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center
              justify-center text-slate-400 hover:text-white hover:border-slate-600 transition-all"
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-violet-600 rounded-full text-[9px]
                text-white flex items-center justify-center font-bold animate-pulse">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
            {/* Real-time connection dot */}
            <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-slate-900 ${
              wsStatus === "connected" ? "bg-emerald-500" :
              wsStatus === "connecting" ? "bg-amber-400 animate-pulse" : "bg-slate-600"
            }`} title={`Real-time: ${wsStatus}`} />
          </button>

          {showBell && (
            <div className="fixed left-4 right-4 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 bg-slate-900 border border-slate-700
              rounded-2xl shadow-2xl shadow-black/40 overflow-hidden z-50">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Bell size={14} className="text-violet-400" />
                  <h4 className="text-sm font-semibold text-white">Notifications</h4>
                  {unreadCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-violet-600/20 text-violet-400 rounded-full font-medium">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-violet-400 transition-colors"
                  >
                    <CheckCheck size={12} />
                    Mark all read
                  </button>
                )}
              </div>

              {/* Notification list */}
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/60">
                {notifications.length === 0 ? (
                  <div className="py-10 text-center">
                    <Bell size={24} className="text-slate-700 mx-auto mb-2" />
                    <p className="text-slate-500 text-xs">All caught up! No new notifications.</p>
                    <p className="text-slate-600 text-[10px] mt-1">Real-time events will appear here.</p>
                  </div>
                ) : (
                  notifications.slice(0, 20).map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`flex gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-slate-800/50
                        ${!n.read ? "bg-violet-500/5" : ""}`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {n.event === "attendance_update" ? <CalendarClock size={14} className="text-emerald-400" /> :
                         n.event === "leave_update" ? <CalendarClock size={14} className="text-violet-400" /> :
                         <Info size={14} className="text-sky-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold leading-tight ${!n.read ? "text-white" : "text-slate-300"}`}>
                          {n.title}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
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
              <div className="border-t border-slate-800 px-4 py-2.5">
                <p className="text-[11px] text-slate-500 text-center">
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
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700
              hover:border-slate-600 transition-all"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500
              flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-white">
                {user?.name?.charAt(0)?.toUpperCase()}
              </span>
            </div>
            <span className="text-sm text-white font-medium hidden sm:block max-w-[100px] truncate">
              {user?.name}
            </span>
            <ChevronDown
              size={13}
              className={`text-slate-400 transition-transform duration-200 ${showMenu ? "rotate-180" : ""}`}
            />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-slate-900 border border-slate-700
              rounded-2xl shadow-2xl shadow-black/40 overflow-hidden py-1.5 z-50">
              {/* User info header */}
              <div className="px-4 py-3 border-b border-slate-800 mb-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500
                    flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-white">
                      {user?.name?.charAt(0)?.toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-white font-semibold truncate">{user?.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                  </div>
                </div>
                <span className="mt-2 inline-block text-[10px] px-2 py-0.5 rounded-full
                  bg-violet-500/10 text-violet-400 font-medium capitalize border border-violet-500/20">
                  {user?.role?.replace(/_/g, " ")}
                </span>
              </div>

              {/* Menu items */}
              <button
                id="navbar-profile"
                onClick={() => goTo("/profile")}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300
                  hover:text-white hover:bg-slate-800 transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center">
                  <User size={13} className="text-violet-400" />
                </div>
                My Profile
              </button>

              <button
                id="navbar-settings"
                onClick={() => goTo("/settings")}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300
                  hover:text-white hover:bg-slate-800 transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center">
                  <Settings size={13} className="text-violet-400" />
                </div>
                Settings
              </button>

              <div className="border-t border-slate-800 mt-1 pt-1">
                <button
                  id="navbar-logout"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-400
                    hover:bg-rose-400/10 transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg bg-rose-500/10 flex items-center justify-center">
                    <LogOut size={13} className="text-rose-400" />
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
