/**
 * pages/EmployeeDashboard.jsx — Per-employee drill-down dashboard (Admin/Manager)
 * Route: /employees/:employeeId/dashboard
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import {
  ArrowLeft, User, Building2, Mail, Phone, Calendar,
  Clock, Target, Star, IndianRupee, TrendingUp,
  CheckCircle2, AlertTriangle, Loader2, CalendarOff,
} from "lucide-react";
import api from "../api/axios";

const TOOLTIP_STYLE = {
  contentStyle: { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 },
  labelStyle: { color: "#fff" },
  itemStyle: { color: "#a78bfa" },
};

const STATUS_COLORS = {
  active: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  inactive: "text-slate-400 bg-slate-400/10 border-slate-400/20",
  on_leave: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  terminated: "text-rose-400 bg-rose-400/10 border-rose-400/20",
};

const GOAL_STATUS_COLORS = {
  completed: "text-emerald-400",
  in_progress: "text-violet-400",
  not_started: "text-slate-400",
};

function StatCard({ icon: Icon, label, value, color = "bg-violet-600", sub }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
      <div>
        <p className="text-slate-400 text-xs">{label}</p>
        <p className="text-xl font-bold text-white leading-tight">{value}</p>
        {sub && <p className="text-xs text-slate-500">{sub}</p>}
      </div>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        {Icon && <Icon size={15} className="text-violet-400" />}
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-32 bg-slate-900 border border-slate-800 rounded-2xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-slate-900 border border-slate-800 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-48 bg-slate-900 border border-slate-800 rounded-2xl" />)}
      </div>
    </div>
  );
}

export default function EmployeeDashboard() {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get(`/dashboard/employee/${employeeId}`);
        setData(res.data);
      } catch (err) {
        setError(err.response?.data?.detail || "Failed to load employee dashboard.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [employeeId]);

  if (loading) {
    return (
      <div className="h-full overflow-y-auto p-6">
        <LoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle size={40} className="text-rose-400 mx-auto mb-3" />
          <p className="text-white font-semibold">{error}</p>
          <button onClick={() => navigate("/employees")} className="mt-4 text-violet-400 hover:text-violet-300 text-sm">
            ← Back to Employees
          </button>
        </div>
      </div>
    );
  }

  const { employee, attendance_this_month, attendance_trend, leave_balance,
          goals, reviews, avg_rating, payroll_history } = data;

  const payrollChartData = [...payroll_history].reverse();

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-6 max-w-6xl mx-auto">

        {/* Back button */}
        <button
          onClick={() => navigate("/employees")}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
        >
          <ArrowLeft size={15} />
          Back to Employees
        </button>

        {/* Profile Header */}
        <div className="bg-gradient-to-r from-violet-600/15 via-indigo-600/10 to-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0 text-2xl font-bold text-white">
              {employee.name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-white">{employee.name}</h1>
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${STATUS_COLORS[employee.status] || STATUS_COLORS.inactive}`}>
                  {employee.status?.replace(/_/g, " ")}
                </span>
              </div>
              <p className="text-violet-400 font-medium mt-0.5">{employee.designation || "—"}</p>
              <div className="flex flex-wrap gap-4 mt-3 text-sm text-slate-400">
                {employee.department && (
                  <span className="flex items-center gap-1.5">
                    <Building2 size={13} className="text-violet-400" />
                    {employee.department}
                  </span>
                )}
                {employee.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail size={13} />
                    {employee.email}
                  </span>
                )}
                {employee.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone size={13} />
                    {employee.phone}
                  </span>
                )}
                {employee.join_date && (
                  <span className="flex items-center gap-1.5">
                    <Calendar size={13} />
                    Joined {new Date(employee.join_date).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                  </span>
                )}
              </div>
            </div>
            {avg_rating && (
              <div className="text-right shrink-0">
                <div className="text-3xl font-bold text-amber-400">{avg_rating}</div>
                <div className="flex items-center gap-1 justify-end mt-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={12} className={i < Math.round(avg_rating) ? "text-amber-400 fill-amber-400" : "text-slate-700"} />
                  ))}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Avg Rating</p>
              </div>
            )}
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Clock} label="Days Present (This Month)" value={attendance_this_month} color="bg-emerald-600" />
          <StatCard icon={Target} label="Active Goals" value={goals.filter(g => g.status !== "completed").length} color="bg-violet-600" />
          <StatCard icon={Star} label="Performance Reviews" value={reviews.length} color="bg-amber-600" />
          <StatCard icon={IndianRupee} label="Latest Net Pay"
            value={payroll_history[0] ? `₹${(payroll_history[0].net / 1000).toFixed(1)}K` : "N/A"}
            color="bg-teal-600"
            sub={payroll_history[0] ? `${payroll_history[0].month} ${payroll_history[0].year}` : ""}
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Attendance Trend */}
          <SectionCard title="Attendance — Last 6 Months" icon={TrendingUp}>
            {attendance_trend.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">No attendance data available.</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={attendance_trend} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} allowDecimals={false} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Bar dataKey="present" name="Present" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={30} />
                  <Bar dataKey="late" name="Late" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </SectionCard>

          {/* Payroll Trend */}
          <SectionCard title="Net Salary Trend — Last 6 Months" icon={IndianRupee}>
            {payrollChartData.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">No payroll data available.</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={payrollChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [`₹${v.toLocaleString()}`, "Net"]} />
                  <Line type="monotone" dataKey="net" stroke="#7c3aed" strokeWidth={2} dot={{ fill: "#7c3aed", r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </SectionCard>
        </div>

        {/* Leave Balance + Goals + Reviews */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Leave Balance */}
          <SectionCard title="Leave Balance" icon={CalendarOff}>
            {Object.entries(leave_balance).length === 0 ? (
              <p className="text-slate-500 text-sm">No leave types configured.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(leave_balance).map(([name, bal]) => (
                  <div key={name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300">{name}</span>
                      <span className="text-slate-400">{bal.used}/{bal.allowed} used</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-violet-500 rounded-full transition-all"
                        style={{ width: `${Math.min((bal.used / bal.allowed) * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">{bal.remaining} days remaining</p>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Goals */}
          <SectionCard title="Recent Goals" icon={Target}>
            {goals.length === 0 ? (
              <p className="text-slate-500 text-sm">No goals set yet.</p>
            ) : (
              <div className="space-y-3">
                {goals.map((g) => (
                  <div key={g.id} className="flex items-start gap-2">
                    <CheckCircle2 size={13} className={`mt-0.5 shrink-0 ${GOAL_STATUS_COLORS[g.status] || "text-slate-400"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white font-medium truncate">{g.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-violet-500 rounded-full" style={{ width: `${g.progress || 0}%` }} />
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0">{g.progress || 0}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Performance Reviews */}
          <SectionCard title="Recent Reviews" icon={Star}>
            {reviews.length === 0 ? (
              <p className="text-slate-500 text-sm">No performance reviews yet.</p>
            ) : (
              <div className="space-y-3">
                {reviews.map((r) => (
                  <div key={r.id} className="bg-slate-800/60 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-white">{r.period}</p>
                      <div className="flex items-center gap-1">
                        <Star size={11} className="text-amber-400 fill-amber-400" />
                        <span className="text-xs font-bold text-amber-400">{r.rating || "—"}</span>
                      </div>
                    </div>
                    {r.comments && (
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{r.comments}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
