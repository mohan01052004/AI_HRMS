/**
 * pages/Attendance.jsx — Complete Attendance Module
 *
 * Employee view:
 *   - Live clock with large Clock In / Clock Out button
 *   - Today's status card (status, clock_in, clock_out, hours)
 *   - Monthly calendar heatmap with colour-coded day cells
 *   - Monthly summary stat cards + Recharts bar chart
 *   - Month navigation (prev / next)
 *
 * Admin / Manager view:
 *   - Today's full-team attendance table
 *   - Department filter + date picker
 *   - Status distribution bar at top
 *   - CSV export
 */
import { useState, useEffect, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import {
  LogIn, LogOut, Clock, Calendar, ChevronLeft, ChevronRight,
  RefreshCw, Download, Building2, AlertCircle, CheckCircle2,
  XCircle, AlertTriangle, Timer, Users, TrendingUp, Loader2,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const STATUS_CFG = {
  present:        { label: "Present",       color: "#10b981", bg: "bg-emerald-500",   text: "text-emerald-400",  ring: "ring-emerald-500/30", icon: CheckCircle2 },
  late:           { label: "Late",          color: "#f59e0b", bg: "bg-amber-500",     text: "text-amber-400",    ring: "ring-amber-500/30",   icon: AlertTriangle },
  absent:         { label: "Absent",        color: "#f43f5e", bg: "bg-rose-500",      text: "text-rose-400",     ring: "ring-rose-500/30",    icon: XCircle },
  half_day:       { label: "Half Day",      color: "#8b5cf6", bg: "bg-violet-500",    text: "text-violet-400",   ring: "ring-violet-500/30",  icon: Timer },
  work_from_home: { label: "WFH",           color: "#3b82f6", bg: "bg-blue-500",      text: "text-blue-400",     ring: "ring-blue-500/30",    icon: CheckCircle2 },
  holiday:        { label: "Holiday",       color: "#64748b", bg: "bg-slate-500",     text: "text-slate-400",    ring: "ring-slate-500/30",   icon: Calendar },
  not_started:    { label: "Not Started",   color: "#475569", bg: "bg-slate-600",     text: "text-slate-400",    ring: "ring-slate-500/20",   icon: Clock },
};

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

const fmtMonth = (y, m) => `${y}-${String(m).padStart(2, "0")}`;
const today    = () => new Date();

function useNow() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, colorClass, icon: Icon }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${colorClass} bg-opacity-10 border border-current border-opacity-20`}>
        <Icon size={20} className={colorClass} />
      </div>
      <div>
        <p className="text-slate-400 text-xs">{label}</p>
        <p className="text-white font-bold text-xl leading-tight">{value}</p>
        {sub && <p className="text-slate-500 text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Calendar Heatmap ─────────────────────────────────────────────────────────

function CalendarHeatmap({ year, month, records }) {
  // Build a map: day → status
  const dayMap = {};
  records.forEach(r => {
    const d = new Date(r.date + "T00:00:00");
    dayMap[d.getDate()] = r.status;
  });

  const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayDate = today();
  const isCurrentMonth = year === todayDate.getFullYear() && month === todayDate.getMonth() + 1;

  const cells = [];
  // Empty leading cells
  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={`e-${i}`} />);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dayOfWeek = new Date(year, month - 1, d).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isFuture  = isCurrentMonth && d > todayDate.getDate();
    const isToday   = isCurrentMonth && d === todayDate.getDate();
    const status    = dayMap[d];

    let bg = "bg-slate-800/50";
    let title = isWeekend ? "Weekend" : isFuture ? "Future" : "No record";

    if (isWeekend)       bg = "bg-slate-800/30";
    else if (isFuture)   bg = "bg-slate-800/20";
    else if (status === "present")        { bg = "bg-emerald-500/80"; title = "Present"; }
    else if (status === "late")           { bg = "bg-amber-500/80";   title = "Late"; }
    else if (status === "absent")         { bg = "bg-rose-500/80";    title = "Absent"; }
    else if (status === "half_day")       { bg = "bg-violet-500/80";  title = "Half Day"; }
    else if (status === "work_from_home") { bg = "bg-blue-500/80";    title = "WFH"; }
    else if (status === "holiday")        { bg = "bg-slate-500/70";   title = "Holiday"; }
    else if (!isFuture && !isWeekend)     { bg = "bg-rose-900/40";    title = "Absent"; }

    cells.push(
      <div
        key={d}
        title={`${d} ${MONTHS[month - 1]}: ${title}`}
        className={`aspect-square rounded-md ${bg} flex items-center justify-center
          text-xs font-medium transition-transform hover:scale-110 cursor-default
          ${isToday ? "ring-2 ring-violet-400 ring-offset-1 ring-offset-slate-900" : ""}
          ${isWeekend || isFuture ? "opacity-40" : ""}`}
      >
        <span className={isToday ? "text-violet-300 font-bold" : "text-slate-400 text-[10px]"}>
          {d}
        </span>
      </div>
    );
  }

  return (
    <div>
      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {["S","M","T","W","T","F","S"].map((d, i) => (
          <div key={i} className="text-center text-slate-600 text-[10px] font-medium py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">{cells}</div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-slate-800">
        {[
          { color: "bg-emerald-500", label: "Present" },
          { color: "bg-amber-500",   label: "Late" },
          { color: "bg-rose-500",    label: "Absent" },
          { color: "bg-violet-500",  label: "Half Day" },
          { color: "bg-blue-500",    label: "WFH" },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className={`w-2.5 h-2.5 rounded-sm ${color}`} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Clock In/Out Button ──────────────────────────────────────────────────────

function ClockButton({ todayData, loading, onClockIn, onClockOut }) {
  const now = useNow();
  const status = todayData?.status || "not_started";
  const cfg = STATUS_CFG[status] || STATUS_CFG.not_started;
  const canIn  = todayData?.can_clock_in  ?? true;
  const canOut = todayData?.can_clock_out ?? false;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center">
      {/* Live clock */}
      <p className="text-4xl font-bold font-mono text-white tracking-widest mb-1">
        {now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </p>
      <p className="text-slate-500 text-sm mb-6">
        {now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      </p>

      {/* Status badge */}
      <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-sm
        font-semibold mb-6 ${cfg.text} ${cfg.ring} ring-1 bg-slate-800`}>
        <span className={`w-2 h-2 rounded-full ${cfg.bg} animate-pulse`} />
        {cfg.label}
      </div>

      {/* Clock In / Out times */}
      {(todayData?.clock_in || todayData?.clock_out) && (
        <div className="flex justify-center gap-8 mb-6 text-sm">
          {todayData.clock_in && (
            <div>
              <p className="text-slate-500 text-xs mb-0.5">Clock In</p>
              <p className="text-emerald-400 font-semibold font-mono">{todayData.clock_in}</p>
            </div>
          )}
          {todayData.clock_out && (
            <div>
              <p className="text-slate-500 text-xs mb-0.5">Clock Out</p>
              <p className="text-rose-400 font-semibold font-mono">{todayData.clock_out}</p>
            </div>
          )}
          {todayData.hours_worked > 0 && (
            <div>
              <p className="text-slate-500 text-xs mb-0.5">Hours</p>
              <p className="text-violet-400 font-semibold font-mono">
                {todayData.hours_worked.toFixed(2)}h
              </p>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 justify-center">
        {canIn && (
          <button
            id="clock-in-btn"
            onClick={onClockIn}
            disabled={loading}
            className="flex items-center gap-2.5 px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500
              text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/25
              disabled:opacity-60 disabled:cursor-not-allowed active:scale-95 text-base"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
            Clock In
          </button>
        )}
        {canOut && (
          <button
            id="clock-out-btn"
            onClick={onClockOut}
            disabled={loading}
            className="flex items-center gap-2.5 px-8 py-3.5 bg-rose-600 hover:bg-rose-500
              text-white font-bold rounded-xl transition-all shadow-lg shadow-rose-500/25
              disabled:opacity-60 disabled:cursor-not-allowed active:scale-95 text-base"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />}
            Clock Out
          </button>
        )}
        {!canIn && !canOut && (
          <div className="flex items-center gap-2 px-6 py-3 bg-slate-800 rounded-xl text-slate-400 text-sm">
            <CheckCircle2 size={16} />
            Day complete — see you tomorrow!
          </div>
        )}
      </div>

      {/* Late warning */}
      {canIn && now.getHours() >= 9 && now.getMinutes() >= 30 && (
        <p className="text-amber-500 text-xs mt-3 flex items-center justify-center gap-1">
          <AlertTriangle size={12} />
          Clocking in now will mark you as <strong className="ml-1">Late</strong>
        </p>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Attendance() {
  const { user, hasRole } = useAuth();
  const isAdminOrManager = hasRole("management_admin", "senior_manager", "hr_recruiter");

  // ── Shared state ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab]       = useState(isAdminOrManager ? "admin" : "employee");
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshKey, setRefreshKey]     = useState(0);

  // ── Employee view state ─────────────────────────────────────────────────────
  const [todayData, setTodayData]       = useState(null);
  const [monthRecords, setMonthRecords] = useState([]);
  const [monthlySummary, setMonthlySummary] = useState(null);
  const [empLoading, setEmpLoading]     = useState(true);

  const now = new Date();
  const [viewYear,  setViewYear]  = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);

  // ── Admin view state ────────────────────────────────────────────────────────
  const [adminDate, setAdminDate]       = useState(now.toISOString().split("T")[0]);
  const [adminData, setAdminData]       = useState(null);
  const [departments, setDepartments]   = useState([]);
  const [deptFilter, setDeptFilter]     = useState("");
  const [adminLoading, setAdminLoading] = useState(false);

  // ── Fetch departments ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAdminOrManager) return;
    api.get("/employees/departments")
      .then(r => setDepartments(r.data))
      .catch(() => {});
  }, [isAdminOrManager]);

  // ── Employee data fetching ──────────────────────────────────────────────────
  const fetchEmployeeData = useCallback(async () => {
    setEmpLoading(true);
    const monthStr = fmtMonth(viewYear, viewMonth);
    try {
      const [todayRes, recordsRes, summaryRes] = await Promise.all([
        api.get("/attendance/today"),
        api.get("/attendance/my", { params: { month: monthStr } }),
        api.get("/attendance/my/summary", { params: { month: monthStr } }),
      ]);
      setTodayData(todayRes.data);
      setMonthRecords(Array.isArray(recordsRes.data) ? recordsRes.data : []);
      setMonthlySummary(summaryRes.data);
    } catch (err) {
      const detail = err.response?.data?.detail;
      // 404 means no employee linked — show friendly message, don't crash
      if (err.response?.status !== 404) {
        toast.error(detail || "Failed to load attendance data.");
      }
      setTodayData({ status: "not_started", can_clock_in: false, can_clock_out: false });
    } finally {
      setEmpLoading(false);
    }
  }, [viewYear, viewMonth, refreshKey]);

  useEffect(() => {
    if (activeTab === "employee") fetchEmployeeData();
  }, [activeTab, fetchEmployeeData]);

  // ── Admin data fetching ─────────────────────────────────────────────────────
  const fetchAdminData = useCallback(async () => {
    if (!isAdminOrManager) return;
    setAdminLoading(true);
    try {
      const params = { date: adminDate };
      if (deptFilter) params.department_id = deptFilter;
      const res = await api.get("/attendance/all", { params });
      setAdminData(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to load team attendance.");
    } finally {
      setAdminLoading(false);
    }
  }, [adminDate, deptFilter, refreshKey, isAdminOrManager]);

  useEffect(() => {
    if (activeTab === "admin") fetchAdminData();
  }, [activeTab, fetchAdminData]);

  // ── Clock actions ───────────────────────────────────────────────────────────
  const handleClockIn = async () => {
    setActionLoading(true);
    try {
      await api.post("/attendance/clockin");
      toast.success("Clocked in successfully!");
      setRefreshKey(k => k + 1);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Clock in failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleClockOut = async () => {
    setActionLoading(true);
    try {
      await api.post("/attendance/clockout");
      toast.success("Clocked out successfully!");
      setRefreshKey(k => k + 1);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Clock out failed.");
    } finally {
      setActionLoading(false);
    }
  };

  // ── Month navigation ────────────────────────────────────────────────────────
  const prevMonth = () => {
    if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    const n = new Date();
    if (viewYear === n.getFullYear() && viewMonth === n.getMonth() + 1) return;
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1); }
    else setViewMonth(m => m + 1);
  };
  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth() + 1;

  // ── CSV Export ──────────────────────────────────────────────────────────────
  const exportCSV = () => {
    if (!adminData?.records?.length) return;
    const headers = ["Employee", "Department", "Designation", "Status", "Clock In", "Clock Out", "Hours"];
    const rows = adminData.records.map(r => [
      r.employee_name, r.department || "", r.designation || "",
      r.status, r.clock_in || "", r.clock_out || "", r.hours_worked,
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `attendance_${adminDate}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Chart data ──────────────────────────────────────────────────────────────
  const chartData = monthlySummary
    ? [
        { name: "Present", value: monthlySummary.present_days,  color: "#10b981" },
        { name: "Late",    value: monthlySummary.late_days,      color: "#f59e0b" },
        { name: "Absent",  value: monthlySummary.absent_days,    color: "#f43f5e" },
        { name: "Half Day",value: monthlySummary.half_days,      color: "#8b5cf6" },
        { name: "WFH",     value: monthlySummary.wfh_days || 0,  color: "#3b82f6" },
      ]
    : [];

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Page Header ── */}
      <div className="px-6 pt-6 pb-4 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">Attendance</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="refresh-attendance-btn"
              onClick={() => setRefreshKey(k => k + 1)}
              className="p-2 rounded-xl border border-slate-700 text-slate-400 hover:text-white
                hover:border-slate-600 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={16} className={(empLoading || adminLoading) ? "animate-spin" : ""} />
            </button>

            {/* Tab switcher for Admin/Manager */}
            {isAdminOrManager && (
              <div className="flex bg-slate-800 rounded-xl p-1 gap-1">
                <button
                  onClick={() => setActiveTab("employee")}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all
                    ${activeTab === "employee"
                      ? "bg-violet-600 text-white shadow"
                      : "text-slate-400 hover:text-white"}`}
                >
                  My Attendance
                </button>
                <button
                  onClick={() => setActiveTab("admin")}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all
                    ${activeTab === "admin"
                      ? "bg-violet-600 text-white shadow"
                      : "text-slate-400 hover:text-white"}`}
                >
                  Team View
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          EMPLOYEE VIEW
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "employee" && (
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {empLoading && !todayData ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 size={32} className="text-violet-500 animate-spin" />
            </div>
          ) : (
            <div className="space-y-5">
              {/* Clock In/Out */}
              <ClockButton
                todayData={todayData}
                loading={actionLoading}
                onClockIn={handleClockIn}
                onClockOut={handleClockOut}
              />

              {/* Stats cards */}
              {monthlySummary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard
                    label="Present Days"
                    value={monthlySummary.present_days}
                    sub={`of ${monthlySummary.working_days} working days`}
                    colorClass="text-emerald-400"
                    icon={CheckCircle2}
                  />
                  <StatCard
                    label="Absent Days"
                    value={monthlySummary.absent_days}
                    sub="this month"
                    colorClass="text-rose-400"
                    icon={XCircle}
                  />
                  <StatCard
                    label="Late Arrivals"
                    value={monthlySummary.late_days}
                    sub="this month"
                    colorClass="text-amber-400"
                    icon={AlertTriangle}
                  />
                  <StatCard
                    label="Total Hours"
                    value={`${monthlySummary.total_hours_worked}h`}
                    sub={`avg ${monthlySummary.avg_hours_per_day}h/day`}
                    colorClass="text-violet-400"
                    icon={Timer}
                  />
                </div>
              )}

              {/* Attendance % badge */}
              {monthlySummary && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex
                  items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Attendance Rate</p>
                    <p className="text-white font-bold text-2xl">{monthlySummary.attendance_pct}%</p>
                  </div>
                  <div className="flex-1 mx-6">
                    <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400
                          transition-all duration-700"
                        style={{ width: `${monthlySummary.attendance_pct}%` }}
                      />
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ${
                    monthlySummary.attendance_pct >= 90 ? "text-emerald-400"
                    : monthlySummary.attendance_pct >= 75 ? "text-amber-400"
                    : "text-rose-400"
                  }`}>
                    {monthlySummary.attendance_pct >= 90 ? "Excellent"
                     : monthlySummary.attendance_pct >= 75 ? "Good" : "Needs Improvement"}
                  </span>
                </div>
              )}

              {/* Calendar Heatmap */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                {/* Month navigator */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-white">
                    {MONTHS[viewMonth - 1]} {viewYear}
                  </h3>
                  <div className="flex items-center gap-1">
                    <button
                      id="prev-month-btn"
                      onClick={prevMonth}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      id="next-month-btn"
                      onClick={nextMonth}
                      disabled={isCurrentMonth}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800
                        disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>

                {empLoading
                  ? <div className="flex justify-center py-10"><Loader2 size={24} className="text-violet-500 animate-spin" /></div>
                  : <CalendarHeatmap year={viewYear} month={viewMonth} records={monthRecords} />
                }
              </div>

              {/* Bar chart */}
              {chartData.length > 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                  <h3 className="font-semibold text-white mb-4">Monthly Breakdown</h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={chartData} barSize={36}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "12px", color: "#fff" }}
                        cursor={{ fill: "rgba(255,255,255,0.04)" }}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {chartData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ADMIN / MANAGER VIEW
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "admin" && (
        <div className="flex-1 overflow-hidden flex flex-col px-6 pb-6 gap-4">

          {/* Filters bar */}
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <input
              id="admin-date-picker"
              type="date"
              value={adminDate}
              onChange={e => setAdminDate(e.target.value)}
              max={now.toISOString().split("T")[0]}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm
                text-white focus:outline-none focus:border-violet-500 transition-all"
            />
            <select
              id="admin-dept-filter"
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm
                text-white focus:outline-none focus:border-violet-500 transition-all min-w-[170px]"
            >
              <option value="">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <button
              id="export-csv-btn"
              onClick={exportCSV}
              disabled={!adminData?.records?.length}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700
                text-slate-300 hover:text-white hover:border-slate-600 text-sm transition-colors
                disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download size={14} /> Export CSV
            </button>
          </div>

          {/* Summary status pills */}
          {adminData && (
            <div className="flex flex-wrap gap-2 shrink-0">
              {Object.entries(adminData.status_counts || {}).map(([s, count]) => {
                const cfg = STATUS_CFG[s] || STATUS_CFG.not_started;
                return (
                  <span key={s} className={`flex items-center gap-1.5 text-xs px-3 py-1.5
                    rounded-full border ${cfg.text} ${cfg.ring} ring-1 bg-slate-900 font-medium`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.bg}`} />
                    {cfg.label}: {count}
                  </span>
                );
              })}
              {adminData.total > 0 && (
                <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full
                  border border-slate-700 text-slate-400 bg-slate-900">
                  <Users size={11} /> Total: {adminData.total}
                </span>
              )}
            </div>
          )}

          {/* Table */}
          <div className="flex-1 overflow-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden min-w-[600px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800">
                  <tr className="text-slate-400 text-xs uppercase tracking-wider">
                    <th className="text-left px-5 py-3.5 font-medium">Employee</th>
                    <th className="text-left px-5 py-3.5 font-medium hidden md:table-cell">Department</th>
                    <th className="text-left px-5 py-3.5 font-medium hidden lg:table-cell">Designation</th>
                    <th className="text-left px-5 py-3.5 font-medium">Status</th>
                    <th className="text-left px-5 py-3.5 font-medium hidden sm:table-cell">Clock In</th>
                    <th className="text-left px-5 py-3.5 font-medium hidden sm:table-cell">Clock Out</th>
                    <th className="text-left px-5 py-3.5 font-medium hidden xl:table-cell">Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {adminLoading && (
                    [1,2,3,4,5,6].map(i => (
                      <tr key={i} className="border-b border-slate-800/50">
                        {[1,2,3,4,5,6,7].map(j => (
                          <td key={j} className="px-5 py-4">
                            <div className="h-4 bg-slate-800 rounded animate-pulse" style={{ width: `${50 + j * 7}%` }} />
                          </td>
                        ))}
                      </tr>
                    ))
                  )}

                  {!adminLoading && (!adminData?.records?.length) && (
                    <tr>
                      <td colSpan={7} className="text-center py-16 text-slate-500">
                        <Calendar size={40} className="text-slate-700 mx-auto mb-3" />
                        No attendance records for this date
                      </td>
                    </tr>
                  )}

                  {!adminLoading && adminData?.records?.map((rec, i) => {
                    const cfg = STATUS_CFG[rec.status] || STATUS_CFG.not_started;
                    const StatusIcon = cfg.icon;
                    return (
                      <tr key={i} className="hover:bg-slate-800/20 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500
                              to-indigo-500 flex items-center justify-center shrink-0">
                              <span className="text-xs font-bold text-white">
                                {rec.employee_name.split(" ").map(w => w[0]).slice(0,2).join("")}
                              </span>
                            </div>
                            <span className="font-medium text-white text-sm">{rec.employee_name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-400 text-sm hidden md:table-cell">
                          {rec.department || <span className="text-slate-600">—</span>}
                        </td>
                        <td className="px-5 py-3.5 text-slate-400 text-sm hidden lg:table-cell">
                          {rec.designation || <span className="text-slate-600">—</span>}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1
                            rounded-full border font-medium ${cfg.text} ${cfg.ring} ring-1 bg-slate-900`}>
                            <StatusIcon size={11} />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 hidden sm:table-cell">
                          <span className="font-mono text-xs text-emerald-400">
                            {rec.clock_in || <span className="text-slate-600">—</span>}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 hidden sm:table-cell">
                          <span className="font-mono text-xs text-rose-400">
                            {rec.clock_out || <span className="text-slate-600">—</span>}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 hidden xl:table-cell">
                          <span className="font-mono text-xs text-violet-400">
                            {rec.hours_worked > 0 ? `${rec.hours_worked}h` : <span className="text-slate-600">—</span>}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

