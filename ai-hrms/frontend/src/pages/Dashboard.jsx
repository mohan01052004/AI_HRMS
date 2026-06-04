/**
 * pages/Dashboard.jsx — Role-specific dashboard with real API data
 * Roles: management_admin | senior_manager | hr_recruiter | employee
 */
import { useState, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import {
  Users, Clock, CalendarOff, Briefcase, TrendingUp, Target,
  AlertTriangle, CheckCircle2, Sparkles, Loader2, IndianRupee,
  UserCheck, FileText, Star, Building2, ClipboardList,
} from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

const COLORS = ["#7c3aed", "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];
const TOOLTIP_STYLE = {
  contentStyle: { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 },
  labelStyle: { color: "#fff" },
  itemStyle: { color: "#a78bfa" },
};

// ─── Reusable sub-components ─────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color, loading }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-start gap-4 hover:border-slate-700 transition-colors">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-slate-400 text-sm">{label}</p>
        {loading ? (
          <div className="h-7 w-20 bg-slate-800 rounded-lg animate-pulse mt-1" />
        ) : (
          <p className="text-2xl font-bold text-white leading-tight">{value}</p>
        )}
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function InsightCard({ insight }) {
  const colors = {
    positive: "border-emerald-500/30 bg-emerald-500/5",
    warning: "border-amber-500/30 bg-amber-500/5",
    neutral: "border-slate-700 bg-slate-800/50",
  };
  const icons = {
    positive: <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />,
    warning: <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />,
    neutral: <TrendingUp size={15} className="text-slate-400 shrink-0 mt-0.5" />,
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[insight.type] || colors.neutral}`}>
      <div className="flex items-start gap-2">
        {icons[insight.type] || icons.neutral}
        <div>
          <p className="text-sm font-medium text-white">{insight.title}</p>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">{insight.description}</p>
          {insight.action && (
            <p className="text-xs text-violet-400 mt-1.5 font-medium">→ {insight.action}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, className = "" }) {
  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-2xl p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        {Icon && <Icon size={15} className="text-violet-400" />}
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function LoadingPulse({ rows = 3 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 bg-slate-800 rounded-xl animate-pulse" />
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
        <StatCard icon={Users}       label="Active Employees"   value={data?.total_employees ?? "—"}  sub="All departments"          color="bg-violet-600"  loading={loading} />
        <StatCard icon={UserCheck}   label="Present Today"      value={data?.present_today ?? "—"}    sub="Clocked in today"         color="bg-emerald-600" loading={loading} />
        <StatCard icon={CalendarOff} label="On Leave Today"     value={data?.on_leave_today ?? "—"}   sub="Approved absences"        color="bg-amber-600"   loading={loading} />
        <StatCard icon={Briefcase}   label="Open Positions"     value={data?.open_positions ?? "—"}   sub="Active job postings"      color="bg-rose-600"    loading={loading} />
        <StatCard icon={ClipboardList} label="Pending Leaves"   value={data?.pending_leaves ?? "—"}  sub="Awaiting approval"        color="bg-sky-600"     loading={loading} />
        <StatCard icon={IndianRupee} label="Payroll This Month" value={data ? `₹${(data.payroll_this_month / 100000).toFixed(1)}L` : "—"} sub="Net disbursed" color="bg-teal-600" loading={loading} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Attendance Trend */}
        <SectionCard title="Attendance Rate — Last 6 Months" icon={TrendingUp} className="lg:col-span-2">
          {loading ? <LoadingPulse rows={1} /> : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={attendanceData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="attGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 11 }} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} unit="%" domain={[0, 100]} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [`${v}%`, "Rate"]} />
                <Area type="monotone" dataKey="rate" stroke="#7c3aed" fill="url(#attGrad)" strokeWidth={2} name="Attendance %" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        {/* Dept Distribution */}
        <SectionCard title="Dept. Headcount" icon={Building2}>
          {loading ? <LoadingPulse rows={1} /> : deptData.length === 0 ? (
            <p className="text-slate-500 text-xs text-center py-8">No department data</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={deptData} cx="50%" cy="50%" outerRadius={60} dataKey="value" stroke="none">
                    {deptData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip {...TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {deptData.slice(0, 5).map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-slate-400 truncate max-w-[100px]">{d.name}</span>
                    </div>
                    <span className="text-slate-200 font-semibold">{d.value}</span>
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
        <StatCard icon={Users}         label="My Team Size"        value={data?.my_team_count ?? "—"}      sub="Direct reports"         color="bg-violet-600"  loading={loading} />
        <StatCard icon={UserCheck}     label="Team Present Today"  value={data?.team_present_today ?? "—"} sub="Clocked in"             color="bg-emerald-600" loading={loading} />
        <StatCard icon={ClipboardList} label="Pending Approvals"   value={data?.pending_approvals ?? "—"}  sub="Leave requests"         color="bg-amber-600"   loading={loading} />
        <StatCard icon={Star}          label="Team Perf. Avg"      value={data ? `${perfScore}/5` : "—"}   sub="Based on reviews"       color="bg-rose-600"    loading={loading} />
      </div>

      {/* Team performance gauge */}
      {!loading && data && (
        <SectionCard title="Team Performance Score" icon={TrendingUp}>
          <div className="flex items-center gap-6">
            <div className="flex-1">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Average Rating</span>
                <span className="text-white font-semibold">{perfScore} / 5.0</span>
              </div>
              <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-500 transition-all duration-700"
                  style={{ width: `${perfPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                <span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold text-white">{perfPercent}<span className="text-lg text-slate-400">%</span></p>
              <p className="text-xs text-slate-500 mt-1">Team score</p>
            </div>
          </div>

          {/* Attendance vs team size bar */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              { label: "Team Size",    value: data.my_team_count,       color: "bg-violet-500" },
              { label: "Present",      value: data.team_present_today,  color: "bg-emerald-500" },
              { label: "Pending Reqs", value: data.pending_approvals,   color: "bg-amber-500" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-slate-800/60 rounded-xl p-4 text-center border border-slate-700/50">
                <div className={`w-2 h-2 rounded-full ${color} mx-auto mb-2`} />
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{label}</p>
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
    "Strong Hire": "text-emerald-400 bg-emerald-400/10",
    "Hire":        "text-teal-400 bg-teal-400/10",
    "Maybe":       "text-amber-400 bg-amber-400/10",
    "Reject":      "text-rose-400 bg-rose-400/10",
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Briefcase}   label="Open Positions"    value={data?.open_positions ?? "—"}    sub="Active job postings"  color="bg-violet-600"  loading={loading} />
        <StatCard icon={FileText}    label="Total Applicants"  value={data?.total_applicants ?? "—"}  sub="Screened via AI"      color="bg-emerald-600" loading={loading} />
        <StatCard icon={UserCheck}   label="Interviews Today"  value={data?.interviews_today ?? 0}    sub="Scheduled"            color="bg-amber-600"   loading={loading} />
        <StatCard icon={Star}        label="Top Candidates"    value={data?.top_candidates?.length ?? "—"} sub="High AI score"   color="bg-rose-600"    loading={loading} />
      </div>

      {/* Top Candidates Table */}
      <SectionCard title="Top AI-Screened Candidates" icon={Sparkles}>
        {loading ? <LoadingPulse /> : !data?.top_candidates?.length ? (
          <div className="text-center py-10">
            <Sparkles size={28} className="text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No candidates screened yet.</p>
            <p className="text-slate-600 text-xs mt-1">Use the Recruitment page to screen PDF resumes with AI.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="pb-3 pr-4">Rank</th>
                  <th className="pb-3 pr-4">Candidate</th>
                  <th className="pb-3 pr-4">Job Title</th>
                  <th className="pb-3 pr-4">AI Score</th>
                  <th className="pb-3">Recommendation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {data.top_candidates.map((c, i) => (
                  <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 pr-4 font-bold text-slate-400">#{i + 1}</td>
                    <td className="py-3 pr-4 text-white font-medium">{c.candidate_name}</td>
                    <td className="py-3 pr-4 text-slate-400">{c.job_title || "—"}</td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${c.score >= 75 ? "bg-emerald-500" : c.score >= 50 ? "bg-amber-500" : "bg-rose-500"}`}
                            style={{ width: `${c.score}%` }}
                          />
                        </div>
                        <span className={`font-bold ${c.score >= 75 ? "text-emerald-400" : c.score >= 50 ? "text-amber-400" : "text-rose-400"}`}>
                          {c.score}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${REC_COLOR[c.recommendation] || "text-slate-400 bg-slate-800"}`}>
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
        <StatCard icon={Clock}       label="Days Present (Month)" value={data?.my_attendance_this_month ?? "—"} sub="This month so far"  color="bg-violet-600"  loading={loading} />
        <StatCard icon={Target}      label="Active Goals"         value={data?.my_goals_count ?? "—"}            sub="In progress"        color="bg-emerald-600" loading={loading} />
        <StatCard icon={IndianRupee} label="Last Net Salary"      value={payslip ? `₹${payslip.net?.toLocaleString("en-IN")}` : (loading ? "—" : "N/A")} sub={payslip ? `${payslip.month} ${payslip.year}` : "No payslip yet"} color="bg-amber-600" loading={loading} />
        <StatCard icon={CalendarOff} label="Leave Types"          value={leaveEntries.length || "—"}             sub="Available leaves"   color="bg-rose-600"    loading={loading} />
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
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300 font-medium">{name}</span>
                      <span className="text-slate-400">
                        <span className="text-white font-semibold">{bal.remaining}</span> / {bal.allowed} days
                      </span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${pct > 50 ? "bg-emerald-500" : pct > 20 ? "bg-amber-500" : "bg-rose-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
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
              <IndianRupee size={28} className="text-slate-700 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No payslip generated yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-slate-400 text-xs font-medium">
                Period: <span className="text-white">{payslip.month} {payslip.year}</span>
              </p>
              {[
                { label: "Gross Salary",  value: payslip.gross,      color: "text-emerald-400" },
                { label: "Deductions",    value: payslip.deductions,  color: "text-rose-400" },
                { label: "Net Pay",       value: payslip.net,         color: "text-violet-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between items-center border-b border-slate-800/60 pb-2 last:border-0">
                  <span className="text-slate-400 text-sm">{label}</span>
                  <span className={`font-bold text-base ${color}`}>
                    ₹{value?.toLocaleString("en-IN") ?? "—"}
                  </span>
                </div>
              ))}

              {/* Mini bar chart */}
              <div className="pt-2">
                <ResponsiveContainer width="100%" height={90}>
                  <BarChart
                    data={[
                      { name: "Gross", value: payslip.gross },
                      { name: "Deductions", value: payslip.deductions },
                      { name: "Net", value: payslip.net },
                    ]}
                    margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                  >
                    <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 10 }} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
                    <Tooltip {...TOOLTIP_STYLE} formatter={v => [`₹${v?.toLocaleString("en-IN")}`, ""]} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {["#10b981", "#ef4444", "#7c3aed"].map((c, i) => (
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
    management_admin: "text-violet-400 bg-violet-400/10",
    senior_manager:   "text-sky-400 bg-sky-400/10",
    hr_recruiter:     "text-teal-400 bg-teal-400/10",
    employee:         "text-emerald-400 bg-emerald-400/10",
  }[user?.role] || "text-slate-400 bg-slate-800";

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-violet-600/20 via-indigo-600/10 to-transparent border border-violet-500/20 rounded-2xl p-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">
            {greeting()}, {user?.name?.split(" ")[0]}! 👋
          </h2>
          <p className="text-slate-400 text-sm mt-0.5">
            Here's your personalised overview for today —{" "}
            <span className="text-slate-300">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </span>
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-3">
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${roleColor}`}>
            {roleLabel}
          </span>
          <div className="flex items-center gap-1.5 text-violet-400">
            <Sparkles size={14} />
            <span className="text-xs font-medium">AI-Powered</span>
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
