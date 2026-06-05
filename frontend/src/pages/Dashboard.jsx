/**
 * pages/Dashboard.jsx — Role-specific dashboard with real API data (Redesigned with Premium Glassmorphism & High-Fi Aesthetics)
 */
import { useState, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  Users, Clock, CalendarOff, Briefcase, TrendingUp, Target,
  AlertTriangle, CheckCircle2, Sparkles, Loader2, IndianRupee,
  UserCheck, FileText, Star, Building2, ClipboardList,
} from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

const COLORS = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];
const TOOLTIP_STYLE = {
  contentStyle: { background: "rgba(15, 23, 42, 0.95)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 12, backdropFilter: "blur(8px)" },
  labelStyle: { color: "#fff", fontWeight: "bold", fontFamily: "var(--font-display)" },
  itemStyle: { color: "#c084fc", fontSize: "12px", fontFamily: "var(--font-sans)" },
};

// ─── Reusable sub-components ─────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color, loading }) {
  return (
    <div className="glass-card glass-card-hover rounded-2xl p-5 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">{label}</p>
        {loading ? (
          <div className="h-7 w-20 bg-white/5 rounded-lg animate-pulse mt-1.5" />
        ) : (
          <p className="text-2xl font-extrabold text-white mt-1 leading-tight font-display tracking-tight text-glow-violet">{value}</p>
        )}
        {sub && <p className="text-[10px] text-slate-500 font-medium mt-1 tracking-wide">{sub}</p>}
      </div>
    </div>
  );
}

function InsightCard({ insight }) {
  const colors = {
    positive: "border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/30",
    warning: "border-amber-500/20 bg-amber-500/5 hover:border-amber-500/30",
    neutral: "border-white/5 bg-slate-950/20 hover:border-violet-500/20",
  };
  const icons = {
    positive: <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />,
    warning: <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />,
    neutral: <TrendingUp size={14} className="text-slate-400 shrink-0 mt-0.5" />,
  };
  return (
    <div className={`rounded-xl border p-4 transition-all duration-300 ${colors[insight.type] || colors.neutral}`}>
      <div className="flex items-start gap-2.5">
        {icons[insight.type] || icons.neutral}
        <div>
          <p className="text-xs font-bold text-white font-display tracking-wide">{insight.title}</p>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{insight.description}</p>
          {insight.action && (
            <p className="text-[10px] text-violet-400 mt-2 font-bold flex items-center gap-1 group cursor-pointer hover:text-violet-300">
              <span className="group-hover:translate-x-0.5 transition-transform">→</span> {insight.action}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, className = "" }) {
  return (
    <div className={`glass-card rounded-2xl p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-5 border-b border-white/5 pb-3">
        {Icon && <Icon size={14} className="text-violet-400" />}
        <h3 className="text-xs font-bold text-white uppercase tracking-wider font-display">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function LoadingPulse({ rows = 3 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 bg-white/5 rounded-xl animate-pulse" />
      ))}
    </div>
  );
}

// ─── Greeting helper ─────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ─── Role views ──────────────────────────────────────────────────────────────

function AdminDashboard() {
  const [data, setData] = useState(null);
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [insightsLoading, setInsightsLoading] = useState(true);

  useEffect(() => {
    api.get("/dashboard/admin")
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));

    api.get("/ai/insights")
      .then(r => setInsights(r.data.insights || []))
      .catch(() => setInsights([]))
      .finally(() => setInsightsLoading(false));
  }, []);

  const deptData = data?.dept_headcount || [];
  const attendanceData = data?.monthly_attendance_rate || [];

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users}       label="Active Employees"   value={data?.total_employees ?? "—"}  sub="All departments"          color="bg-gradient-to-br from-violet-600 to-indigo-600 shadow-violet-500/10"  loading={loading} />
        <StatCard icon={UserCheck}   label="Present Today"      value={data?.present_today ?? "—"}    sub="Clocked in today"         color="bg-gradient-to-br from-emerald-500 to-teal-500 shadow-emerald-500/10" loading={loading} />
        <StatCard icon={CalendarOff} label="On Leave Today"     value={data?.on_leave_today ?? "—"}   sub="Approved absences"        color="bg-gradient-to-br from-amber-500 to-orange-500 shadow-amber-500/10"   loading={loading} />
        <StatCard icon={Briefcase}   label="Open Positions"     value={data?.open_positions ?? "—"}   sub="Active job postings"      color="bg-gradient-to-br from-rose-500 to-pink-500 shadow-rose-500/10"    loading={loading} />
        <StatCard icon={ClipboardList} label="Pending Leaves"   value={data?.pending_leaves ?? "—"}  sub="Awaiting approval"        color="bg-gradient-to-br from-sky-500 to-blue-500 shadow-sky-500/10"     loading={loading} />
        <StatCard icon={IndianRupee} label="Payroll This Month" value={data ? `₹${(data.payroll_this_month / 100000).toFixed(1)}L` : "—"} sub="Net disbursed" color="bg-gradient-to-br from-teal-500 to-emerald-500 shadow-teal-500/10" loading={loading} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Attendance Trend */}
        <SectionCard title="Attendance Rate — Last 6 Months" icon={TrendingUp} className="lg:col-span-2">
          {loading ? <LoadingPulse rows={1} /> : (
            <div className="h-[210px] w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={attendanceData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="attGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.03)" />
                  <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 10, fontWeight: 500 }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 10, fontWeight: 500 }} unit="%" domain={[0, 100]} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [`${v}%`, "Rate"]} />
                  <Area type="monotone" dataKey="rate" stroke="#8b5cf6" fill="url(#attGrad)" strokeWidth={2.5} name="Attendance %" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        {/* Dept Distribution */}
        <SectionCard title="Dept. Headcount" icon={Building2}>
          {loading ? <LoadingPulse rows={1} /> : deptData.length === 0 ? (
            <p className="text-slate-500 text-xs text-center py-8">No department data</p>
          ) : (
            <>
              <div className="h-[140px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={deptData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" stroke="none" paddingAngle={2}>
                      {deptData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip {...TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-4 max-h-[80px] overflow-y-auto pr-1">
                {deptData.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px] font-medium">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-slate-400 truncate max-w-[120px]">{d.name}</span>
                    </div>
                    <span className="text-slate-200 font-bold">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </SectionCard>
      </div>

      {/* AI Insights */}
      <SectionCard title="AI Workforce Insights" icon={Sparkles}>
        {insightsLoading ? <LoadingPulse /> : insights.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {insights.map((ins, i) => <InsightCard key={i} insight={ins} />)}
          </div>
        ) : (
          <p className="text-slate-500 text-xs text-center py-6">Set GROQ_API_KEY to enable AI insights.</p>
        )}
      </SectionCard>
    </div>
  );
}

function ManagerDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/dashboard/manager")
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const perfScore = data?.team_performance_avg || 0;
  const perfPercent = ((perfScore / 5) * 100).toFixed(0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users}         label="My Team Size"        value={data?.my_team_count ?? "—"}      sub="Direct reports"         color="bg-gradient-to-br from-violet-600 to-indigo-600"  loading={loading} />
        <StatCard icon={UserCheck}     label="Team Present Today"  value={data?.team_present_today ?? "—"} sub="Clocked in"             color="bg-gradient-to-br from-emerald-500 to-teal-500" loading={loading} />
        <StatCard icon={ClipboardList} label="Pending Approvals"   value={data?.pending_approvals ?? "—"}  sub="Leave requests"         color="bg-gradient-to-br from-amber-500 to-orange-500"   loading={loading} />
        <StatCard icon={Star}          label="Team Perf. Avg"      value={data ? `${perfScore}/5` : "—"}   sub="Based on reviews"       color="bg-gradient-to-br from-rose-500 to-pink-500"    loading={loading} />
      </div>

      {/* Team performance gauge */}
      {!loading && data && (
        <SectionCard title="Team Performance Score" icon={TrendingUp}>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="flex-1 w-full">
              <div className="flex justify-between text-xs text-slate-400 mb-1.5 font-medium">
                <span>Average Rating</span>
                <span className="text-white font-bold">{perfScore} / 5.0</span>
              </div>
              <div className="h-2.5 bg-slate-950/65 border border-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 transition-all duration-700 shadow-md shadow-violet-500/20"
                  style={{ width: `${perfPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-600 mt-1.5 font-bold">
                <span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
              </div>
            </div>
            <div className="text-center shrink-0 px-4 py-2 rounded-2xl bg-white/5 border border-white/5">
              <p className="text-4xl font-black text-white font-display text-glow-violet">{perfPercent}<span className="text-sm text-slate-500">%</span></p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mt-1">Team score</p>
            </div>
          </div>

          {/* Attendance vs team size bar */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              { label: "Team Size",    value: data.my_team_count,       color: "bg-violet-500" },
              { label: "Present",      value: data.team_present_today,  color: "bg-emerald-500" },
              { label: "Pending Reqs", value: data.pending_approvals,   color: "bg-amber-500" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-slate-950/45 rounded-2xl p-4 text-center border border-white/5 hover:border-violet-500/10 transition-colors">
                <div className={`w-1.5 h-1.5 rounded-full ${color} mx-auto mb-2`} />
                <p className="text-2xl font-extrabold text-white font-display tracking-tight text-glow-violet">{value}</p>
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-1">{label}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function RecruiterDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/dashboard/recruiter")
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const REC_COLOR = {
    "Strong Hire": "text-emerald-400 bg-emerald-400/10 border-emerald-500/20",
    "Hire":        "text-teal-400 bg-teal-400/10 border-teal-500/20",
    "Maybe":       "text-amber-400 bg-amber-400/10 border-amber-500/20",
    "Reject":      "text-rose-400 bg-rose-400/10 border-rose-500/20",
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Briefcase}   label="Open Positions"    value={data?.open_positions ?? "—"}    sub="Active job postings"  color="bg-gradient-to-br from-violet-600 to-indigo-600"  loading={loading} />
        <StatCard icon={FileText}    label="Total Applicants"  value={data?.total_applicants ?? "—"}  sub="Screened via AI"      color="bg-gradient-to-br from-emerald-500 to-teal-500" loading={loading} />
        <StatCard icon={UserCheck}   label="Interviews Today"  value={data?.interviews_today ?? 0}    sub="Scheduled"            color="bg-gradient-to-br from-amber-500 to-orange-500"   loading={loading} />
        <StatCard icon={Star}        label="Top Candidates"    value={data?.top_candidates?.length ?? "—"} sub="High AI score"   color="bg-gradient-to-br from-rose-500 to-pink-500"    loading={loading} />
      </div>

      {/* Top Candidates Table */}
      <SectionCard title="Top AI-Screened Candidates" icon={Sparkles}>
        {loading ? <LoadingPulse /> : !data?.top_candidates?.length ? (
          <div className="text-center py-10">
            <Sparkles size={26} className="text-slate-700 mx-auto mb-3 animate-pulse" />
            <p className="text-slate-500 text-sm font-semibold">No candidates screened yet.</p>
            <p className="text-slate-600 text-xs mt-1">Use the Recruitment page to screen PDF resumes with AI.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-white/5 text-slate-400 font-semibold">
                  <th className="pb-3 pr-4 uppercase tracking-wider text-[10px]">Rank</th>
                  <th className="pb-3 pr-4 uppercase tracking-wider text-[10px]">Candidate</th>
                  <th className="pb-3 pr-4 uppercase tracking-wider text-[10px]">Job Title</th>
                  <th className="pb-3 pr-4 uppercase tracking-wider text-[10px]">AI Score</th>
                  <th className="pb-3 uppercase tracking-wider text-[10px]">Recommendation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.top_candidates.map((c, i) => (
                  <tr key={i} className="hover:bg-white/5 transition-colors">
                    <td className="py-3.5 pr-4 font-bold text-slate-500 font-display">#{i + 1}</td>
                    <td className="py-3.5 pr-4 text-white font-bold">{c.candidate_name}</td>
                    <td className="py-3.5 pr-4 text-slate-400 font-medium">{c.job_title || "—"}</td>
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-950 border border-white/5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${c.score >= 75 ? "bg-emerald-500" : c.score >= 50 ? "bg-amber-500" : "bg-rose-500"}`}
                            style={{ width: `${c.score}%` }}
                          />
                        </div>
                        <span className={`font-bold font-display ${c.score >= 75 ? "text-emerald-400" : c.score >= 50 ? "text-amber-400" : "text-rose-400"}`}>
                          {c.score}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5">
                      <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-bold border uppercase tracking-wider ${REC_COLOR[c.recommendation] || "text-slate-400 bg-white/5 border-white/5"}`}>
                        {c.recommendation || "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function EmployeeDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/dashboard/employee")
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const payslip = data?.latest_payslip_summary;
  const leaveBalance = data?.leave_balance || {};
  const leaveEntries = Object.entries(leaveBalance);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Clock}       label="Days Present (Month)" value={data?.my_attendance_this_month ?? "—"} sub="This month so far"  color="bg-gradient-to-br from-violet-600 to-indigo-600"  loading={loading} />
        <StatCard icon={Target}      label="Active Goals"         value={data?.my_goals_count ?? "—"}            sub="In progress"        color="bg-gradient-to-br from-emerald-500 to-teal-500" loading={loading} />
        <StatCard icon={IndianRupee} label="Last Net Salary"      value={payslip ? `₹${payslip.net?.toLocaleString("en-IN")}` : (loading ? "—" : "N/A")} sub={payslip ? `${payslip.month} ${payslip.year}` : "No payslip yet"} color="bg-gradient-to-br from-amber-500 to-orange-500" loading={loading} />
        <StatCard icon={CalendarOff} label="Leave Types"          value={leaveEntries.length || "—"}             sub="Available leaves"   color="bg-gradient-to-br from-rose-500 to-pink-500"    loading={loading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Leave Balance */}
        <SectionCard title="Leave Balance" icon={CalendarOff}>
          {loading ? <LoadingPulse /> : leaveEntries.length === 0 ? (
            <p className="text-slate-500 text-xs text-center py-8">No leave types configured.</p>
          ) : (
            <div className="space-y-4">
              {leaveEntries.map(([name, bal]) => {
                const pct = bal.allowed > 0 ? ((bal.remaining / bal.allowed) * 100) : 0;
                return (
                  <div key={name}>
                    <div className="flex justify-between text-xs mb-1.5 font-medium">
                      <span className="text-slate-300">{name}</span>
                      <span className="text-slate-400">
                        <span className="text-white font-bold">{bal.remaining}</span> / {bal.allowed} days
                      </span>
                    </div>
                    <div className="h-2 bg-slate-950 border border-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-550 ${pct > 50 ? "bg-emerald-500" : pct > 20 ? "bg-amber-500" : "bg-rose-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-500 font-bold mt-1 uppercase tracking-wider">
                      <span>{bal.used} used</span>
                      <span>{bal.remaining} remaining</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* Latest Payslip */}
        <SectionCard title="Latest Payslip Summary" icon={IndianRupee}>
          {loading ? <LoadingPulse rows={2} /> : !payslip ? (
            <div className="text-center py-10">
              <IndianRupee size={26} className="text-slate-700 mx-auto mb-2" />
              <p className="text-slate-500 text-sm font-semibold">No payslip generated yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Period: <span className="text-white font-bold">{payslip.month} {payslip.year}</span>
              </p>
              {[
                { label: "Gross Salary",  value: payslip.gross,      color: "text-emerald-400" },
                { label: "Deductions",    value: payslip.deductions,  color: "text-rose-400" },
                { label: "Net Pay",       value: payslip.net,         color: "text-violet-400 text-glow-violet" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between items-center border-b border-white/5 pb-2 last:border-0">
                  <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">{label}</span>
                  <span className={`font-black text-base font-display ${color}`}>
                    ₹{value?.toLocaleString("en-IN") ?? "—"}
                  </span>
                </div>
              ))}

              {/* Mini bar chart */}
              <div className="pt-2 h-[95px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: "Gross", value: payslip.gross },
                      { name: "Deductions", value: payslip.deductions },
                      { name: "Net", value: payslip.net },
                    ]}
                    margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                  >
                    <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 9, fontWeight: 500 }} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 9, fontWeight: 500 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
                    <Tooltip {...TOOLTIP_STYLE} formatter={v => [`₹${v?.toLocaleString("en-IN")}`, ""]} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {["#10b981", "#ef4444", "#8b5cf6"].map((c, i) => (
                        <Cell key={i} fill={c} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user, isAdmin, isManager, isHR, isEmployee } = useAuth();

  const roleLabel = {
    management_admin: "Administrator",
    senior_manager:   "Senior Manager",
    hr_recruiter:     "HR Recruiter",
    employee:         "Employee",
  }[user?.role] || "User";

  const roleColor = {
    management_admin: "text-violet-400 bg-violet-400/10 border-violet-500/25",
    senior_manager:   "text-sky-400 bg-sky-400/10 border-sky-500/25",
    hr_recruiter:     "text-teal-400 bg-teal-400/10 border-teal-500/25",
    employee:         "text-emerald-400 bg-emerald-400/10 border-emerald-500/25",
  }[user?.role] || "text-slate-400 bg-white/5 border-white/5";

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full font-sans">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-violet-600/10 via-fuchsia-600/5 to-slate-950/20 border border-white/10 rounded-3xl p-5 flex items-center justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-full blur-2xl pointer-events-none" />
        <div>
          <h2 className="text-xl font-bold text-white font-display text-glow-violet">
            {greeting()}, {user?.name?.split(" ")[0]}! 👋
          </h2>
          <p className="text-slate-400 text-xs mt-1.5 font-medium">
            Personalised workspace summary --{" "}
            <span className="text-violet-300 font-semibold">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </span>
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-3">
          <span className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border ${roleColor}`}>
            {roleLabel}
          </span>
          <div className="flex items-center gap-1.5 text-violet-400">
            <Sparkles size={13} className="animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-wider">AI Platform</span>
          </div>
        </div>
      </div>

      {/* Role-specific content */}
      {isAdmin    && <AdminDashboard />}
      {isManager  && !isAdmin && <ManagerDashboard />}
      {isHR       && !isAdmin && <RecruiterDashboard />}
      {isEmployee && !isAdmin && !isManager && !isHR && <EmployeeDashboard />}
    </div>
  );
}
