/**
 * pages/Analytics.jsx — Advanced Data Analytics Dashboard for HR & Admin
 */
import { useState, useEffect } from "react";
import {
  TrendingUp, Users, Clock, Briefcase, Calendar, Award, Loader2,
  PieChart as PieIcon, ArrowRight, BarChart2
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, Legend, CartesianGrid, Cell, FunnelChart, Funnel, LabelList
} from "recharts";
import api from "../api/axios";
import toast from "react-hot-toast";

const FUNNEL_COLORS = ["#8b5cf6", "#6366f1", "#3b82f6", "#06b6d4", "#10b981"];

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await api.get("/dashboard/analytics");
        setData(res.data);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load analytics dashboard data.");
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  const getHeatmapColor = (val) => {
    if (val >= 97) return "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20";
    if (val >= 94) return "bg-blue-500/10 text-blue-400 border border-blue-500/20";
    return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-3">
        <Loader2 size={32} className="text-violet-500 animate-spin" />
        <p className="text-slate-400 text-sm">Loading advanced metrics & visualisations...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400">
        <TrendingUp size={48} className="text-slate-700 mb-3" />
        <p>Could not load analytics. Please check backend connection.</p>
      </div>
    );
  }

  // Format Recharts data keys
  const funnelData = (data.hiring_funnel || []).map((f) => ({
    value: f.count,
    name: f.stage
  }));

  const timeToHireData = data.time_to_hire || [];
  const departmentTrends = data.department_trends || [];
  const retentionTrends = data.retention_trends || [];
  const attendanceHeatmap = data.attendance_heatmap || [];

  return (
    <div className="p-6 h-full overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-left">
          <h2 className="text-lg font-semibold text-white">Advanced Data Analytics</h2>
          <p className="text-slate-400 text-sm">Hiring funnel, headcount trends, and workforce statistics</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-600/10 border border-violet-500/10 rounded-xl">
          <TrendingUp size={14} className="text-violet-400 animate-bounce" />
          <span className="text-xs text-violet-400 font-semibold tracking-wide uppercase">HR Analytical Mode</span>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* Hiring Funnel Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col h-[350px]">
          <div className="flex items-center gap-2 mb-4 text-left">
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
              <Briefcase size={15} className="text-violet-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">Recruitment Hiring Funnel</h3>
              <p className="text-[10px] text-slate-400">Pipeline progression stages from Application to Hire</p>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <FunnelChart>
                <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", color: "#f8fafc" }} />
                <Funnel
                  dataKey="value"
                  data={funnelData}
                  isAnimationActive
                >
                  <LabelList position="right" fill="#94a3b8" stroke="none" dataKey="name" fontStyle="Inter, sans-serif" fontSize={11} />
                  {funnelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={FUNNEL_COLORS[index % FUNNEL_COLORS.length]} />
                  ))}
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Time-to-Hire Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col h-[350px]">
          <div className="flex items-center gap-2 mb-4 text-left">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
              <Clock size={15} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">Time-to-Hire per Department</h3>
              <p className="text-[10px] text-slate-400">Average number of days to fill open positions</p>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={timeToHireData} margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis type="number" stroke="#94a3b8" fontSize={10} />
                <YAxis dataKey="department" type="category" stroke="#94a3b8" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", color: "#f8fafc" }} />
                <Bar dataKey="days" fill="#10b981" radius={[0, 6, 6, 0]}>
                  {timeToHireData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={FUNNEL_COLORS[index % FUNNEL_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Department Headcount Trends */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col h-[380px]">
          <div className="flex items-center gap-2 mb-4 text-left">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center shrink-0">
              <Users size={15} className="text-sky-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">Department Headcount Trends</h3>
              <p className="text-[10px] text-slate-400">Headcount changes over the last 6 months</p>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={departmentTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorEng" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorMkt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", color: "#f8fafc" }} />
                <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
                <Area type="monotone" dataKey="Engineering" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorEng)" />
                <Area type="monotone" dataKey="Sales" stroke="#3b82f6" fillOpacity={1} fill="url(#colorSales)" />
                <Area type="monotone" dataKey="Marketing" stroke="#10b981" fillOpacity={1} fill="url(#colorMkt)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Retention Trends Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col h-[380px]">
          <div className="flex items-center gap-2 mb-4 text-left">
            <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center shrink-0">
              <Award size={15} className="text-pink-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">Year-over-Year Retention Rates</h3>
              <p className="text-[10px] text-slate-400">Percentage of employee retention over 5 years</p>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={retentionTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="year" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} domain={[80, 100]} />
                <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", color: "#f8fafc" }} />
                <Area type="monotone" dataKey="rate" stroke="#ec4899" fillOpacity={1} fill="url(#colorRate)" name="Retention Rate (%)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Attendance Heatmap Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-left">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
            <Calendar size={15} className="text-amber-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm">Department Attendance Heatmap</h3>
            <p className="text-[10px] text-slate-400">Weekly attendance rate distribution by department</p>
          </div>
        </div>

        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/50">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-800/40 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                  <th className="py-3 px-4 text-left">Department</th>
                  <th className="py-3 px-4 text-center">Monday</th>
                  <th className="py-3 px-4 text-center">Tuesday</th>
                  <th className="py-3 px-4 text-center">Wednesday</th>
                  <th className="py-3 px-4 text-center">Thursday</th>
                  <th className="py-3 px-4 text-center">Friday</th>
                </tr>
              </thead>
              <tbody>
                {attendanceHeatmap.map((item, idx) => (
                  <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors text-xs text-slate-300">
                    <td className="py-3 px-4 font-semibold text-white text-left">{item.department}</td>
                    {["Mon", "Tue", "Wed", "Thu", "Fri"].map((day) => (
                      <td key={day} className="py-3 px-4 text-center">
                        <span className={`inline-block px-3 py-1.5 rounded-lg text-xs font-semibold w-16 text-center ${getHeatmapColor(item[day])}`}>
                          {item[day]}%
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
