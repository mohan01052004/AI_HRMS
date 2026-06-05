/**
 * pages/EmployeeDashboard.jsx — Per-employee drill-down dashboard (Redesigned with Premium Glassmorphism & High-Fi Aesthetics)
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  ArrowLeft, Building2, Mail, Phone, Calendar,
  Clock, Target, Star, IndianRupee, TrendingUp,
  CheckCircle2, AlertTriangle, CalendarOff,
} from "lucide-react";
import api from "../api/axios";

const TOOLTIP_STYLE = {
  contentStyle: { background: "rgba(15, 23, 42, 0.95)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 12, backdropFilter: "blur(8px)" },
  labelStyle: { color: "#fff", fontWeight: "bold", fontFamily: "var(--font-display)" },
  itemStyle: { color: "#c084fc", fontSize: "12px", fontFamily: "var(--font-sans)" },
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
    <div className="glass-card glass-card-hover rounded-2xl p-5 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-extrabold text-white mt-1 leading-tight font-display tracking-tight text-glow-violet">{value}</p>
        {sub && <p className="text-[10px] text-slate-500 font-medium mt-1 tracking-wide">{sub}</p>}
      </div>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-5 border-b border-white/5 pb-3">
        {Icon && <Icon size={14} className="text-violet-400" />}
        <h3 className="text-xs font-bold text-white uppercase tracking-wider font-display">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-32 bg-white/5 border border-white/5 rounded-2xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-white/5 border border-white/5 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => <div key={i} className="h-48 bg-white/5 border border-white/5 rounded-2xl" />)}
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
        setData(prev => prev); // dummy to force dependency triggers
        setLoading(false);
      }
    };
    fetchData();
  }, [employeeId]);

  if (loading) {
    return (
      <div className="h-full overflow-y-auto p-6 bg-[#030712]">
        <LoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-[#030712]">
        <div className="text-center p-6 glass-card rounded-3xl border border-white/10 max-w-sm">
          <AlertTriangle size={36} className="text-rose-400 mx-auto mb-3" />
          <p className="text-white font-bold font-display">{error}</p>
          <button onClick={() => navigate("/employees")} className="mt-4 text-xs font-bold text-violet-400 hover:text-violet-300 uppercase tracking-wider">
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
    <div className="h-full overflow-y-auto bg-[#030712] font-sans">
      <div className="p-6 space-y-6 max-w-6xl mx-auto">

        {/* Back button */}
        <button
          onClick={() => navigate("/employees")}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-xs font-semibold uppercase tracking-wider transition-colors"
        >
          <ArrowLeft size={13} />
          Back to Employees
        </button>

        {/* Profile Header Card */}
        <div className="bg-gradient-to-r from-violet-600/10 via-indigo-600/5 to-slate-950/20 border border-white/10 rounded-3xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex flex-col md:flex-row items-start md:items-center gap-5 justify-between">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0 text-2xl font-black text-white shadow-lg shadow-violet-500/15">
                {employee.name?.charAt(0)?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-extrabold text-white tracking-tight font-display text-glow-violet">{employee.name}</h1>
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-bold uppercase tracking-wider ${STATUS_COLORS[employee.status] || STATUS_COLORS.inactive}`}>
                    {employee.status?.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="text-violet-400 font-semibold text-sm mt-1">{employee.designation || "—"}</p>
                
                <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 text-xs text-slate-400 font-medium">
                  {employee.department && (
                    <span className="flex items-center gap-1.5">
                      <Building2 size={12} className="text-violet-400" />
                      {employee.department}
                    </span>
                  )}
                  {employee.email && (
                    <span className="flex items-center gap-1.5">
                      <Mail size={12} />
                      {employee.email}
                    </span>
                  )}
                  {employee.phone && (
                    <span className="flex items-center gap-1.5">
                      <Phone size={12} />
                      {employee.phone}
                    </span>
                  )}
                  {employee.join_date && (
                    <span className="flex items-center gap-1.5">
                      <Calendar size={12} />
                      Joined {new Date(employee.join_date).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {avg_rating && (
              <div className="text-left md:text-right shrink-0 mt-3 md:mt-0 p-3 rounded-2xl bg-white/5 border border-white/5">
                <div className="text-3xl font-black text-amber-400 font-display leading-none">{avg_rating}</div>
                <div className="flex items-center gap-0.5 justify-start md:justify-end mt-1.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={11} className={i < Math.round(avg_rating) ? "text-amber-400 fill-amber-400" : "text-slate-700"} />
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1.5">Avg Rating</p>
              </div>
            )}
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Clock} label="Days Present (This Month)" value={attendance_this_month} color="bg-gradient-to-br from-emerald-500 to-teal-500" />
          <StatCard icon={Target} label="Active Goals" value={goals.filter(g => g.status !== "completed").length} color="bg-gradient-to-br from-violet-600 to-indigo-600" />
          <StatCard icon={Star} label="Performance Reviews" value={reviews.length} color="bg-gradient-to-br from-amber-500 to-orange-500" />
          <StatCard icon={IndianRupee} label="Latest Net Pay"
            value={payroll_history[0] ? `₹${(payroll_history[0].net / 1000).toFixed(1)}K` : "N/A"}
            color="bg-gradient-to-br from-teal-500 to-emerald-500"
            sub={payroll_history[0] ? `${payroll_history[0].month} ${payroll_history[0].year}` : ""}
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Attendance Trend */}
          <SectionCard title="Attendance — Last 6 Months" icon={TrendingUp}>
            {attendance_trend.length === 0 ? (
              <p className="text-slate-500 text-xs text-center py-8">No attendance data available.</p>
            ) : (
              <div className="h-[180px] w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attendance_trend} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.03)" />
                    <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 10, fontWeight: 500 }} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10, fontWeight: 500 }} allowDecimals={false} />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Bar dataKey="present" name="Present" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={25} />
                    <Bar dataKey="late" name="Late" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={25} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </SectionCard>

          {/* Payroll Trend */}
          <SectionCard title="Net Salary Trend — Last 6 Months" icon={IndianRupee}>
            {payrollChartData.length === 0 ? (
              <p className="text-slate-500 text-xs text-center py-8">No payroll data available.</p>
            ) : (
              <div className="h-[180px] w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={payrollChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.03)" />
                    <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 10, fontWeight: 500 }} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10, fontWeight: 500 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
                    <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [`₹${v.toLocaleString()}`, "Net"]} />
                    <Line type="monotone" dataKey="net" stroke="#8b5cf6" strokeWidth={2.5} dot={{ fill: "#8b5cf6", r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </SectionCard>
        </div>

        {/* Leave Balance + Goals + Reviews */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Leave Balance */}
          <SectionCard title="Leave Balance" icon={CalendarOff}>
            {Object.entries(leave_balance).length === 0 ? (
              <p className="text-slate-500 text-xs font-semibold">No leave types configured.</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(leave_balance).map(([name, bal]) => (
                  <div key={name}>
                    <div className="flex justify-between text-xs mb-1.5 font-medium">
                      <span className="text-slate-300">{name}</span>
                      <span className="text-slate-400">{bal.used}/{bal.allowed} used</span>
                    </div>
                    <div className="h-1.5 bg-slate-950 border border-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-violet-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min((bal.used / bal.allowed) * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1.5 font-bold uppercase tracking-wider">{bal.remaining} days remaining</p>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Goals */}
          <SectionCard title="Recent Goals" icon={Target}>
            {goals.length === 0 ? (
              <p className="text-slate-500 text-xs font-semibold">No goals set yet.</p>
            ) : (
              <div className="space-y-4">
                {goals.map((g) => (
                  <div key={g.id} className="flex items-start gap-2.5">
                    <CheckCircle2 size={13} className={`mt-0.5 shrink-0 ${GOAL_STATUS_COLORS[g.status] || "text-slate-400"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white font-bold truncate leading-none">{g.title}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 h-1 bg-slate-950 border border-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-violet-500 rounded-full" style={{ width: `${g.progress || 0}%` }} />
                        </div>
                        <span className="text-[9px] font-bold text-slate-500 shrink-0">{g.progress || 0}%</span>
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
              <p className="text-slate-500 text-xs font-semibold">No performance reviews yet.</p>
            ) : (
              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                {reviews.map((r) => (
                  <div key={r.id} className="bg-slate-950/45 border border-white/5 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-white font-display">{r.period}</p>
                      <div className="flex items-center gap-1 font-bold text-amber-400">
                        <Star size={11} className="fill-amber-400" />
                        <span className="text-xs leading-none">{r.rating || "—"}</span>
                      </div>
                    </div>
                    {r.comments && (
                      <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-3">{r.comments}</p>
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
