/**
 * pages/Leave.jsx — Complete Leave Management Module
 *
 * Employee view:
 *   - Leave balance cards (Casual, Sick, Earned/Annual, etc.)
 *   - Apply Leave form (Leave type, from date, to date, reason)
 *   - Past leave requests history table with status badges
 *
 * Manager/Admin view:
 *   - Pending team leave requests table
 *   - Approve & Reject actions per request
 *   - Reject button triggers a modal to input rejection reason
 *   - Department filter for team requests
 */
import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import {
  CalendarOff, Plus, X, Loader2, CheckCircle2, XCircle, Clock,
  AlertCircle, ChevronRight, User, Building, Calendar, Info, Check, AlertTriangle
} from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

const STATUS_CFG = {
  pending:   { label: "Pending",   color: "text-amber-400 bg-amber-400/10 border-amber-500/20", icon: Clock },
  approved:  { label: "Approved",  color: "text-emerald-400 bg-emerald-400/10 border-emerald-500/20", icon: CheckCircle2 },
  rejected:  { label: "Rejected",  color: "text-rose-400 bg-rose-400/10 border-rose-500/20", icon: XCircle },
  cancelled: { label: "Cancelled", color: "text-slate-400 bg-slate-400/10 border-slate-500/20", icon: XCircle },
};


// ─── Leave Balance Card ────────────────────────────────────────────────────────
function BalanceCard({ name, allowed, used, remaining }) {
  const pct = allowed > 0 ? Math.round((remaining / allowed) * 100) : 0;
  
  // Custom color schemes based on leave type names
  let themeCls = "text-violet-400 border-violet-500/10 bg-violet-500/5";
  let barCls = "bg-violet-500";
  if (name.toLowerCase().includes("sick")) {
    themeCls = "text-amber-400 border-amber-500/10 bg-amber-500/5";
    barCls = "bg-amber-500";
  } else if (name.toLowerCase().includes("casual")) {
    themeCls = "text-sky-400 border-sky-500/10 bg-sky-500/5";
    barCls = "bg-sky-400";
  } else if (name.toLowerCase().includes("annual") || name.toLowerCase().includes("earned")) {
    themeCls = "text-emerald-400 border-emerald-500/10 bg-emerald-500/5";
    barCls = "bg-emerald-500";
  }

  return (
    <div className={`border rounded-2xl p-4 flex flex-col justify-between ${themeCls}`}>
      <div>
        <span className="text-xs opacity-80 uppercase font-semibold tracking-wider">{name}</span>
        <div className="flex items-baseline gap-1 mt-2">
          <span className="text-3xl font-extrabold text-white">{remaining}</span>
          <span className="text-xs opacity-60">/ {allowed} days left</span>
        </div>
      </div>
      <div className="mt-4 space-y-1.5">
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${barCls}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="flex justify-between text-[10px] opacity-60">
          <span>{used} days used</span>
          <span>{pct}% remaining</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Leave() {
  const { hasRole } = useAuth();
  const isAdminOrManager = hasRole("management_admin", "senior_manager");

  // State controls
  const [activeTab, setActiveTab] = useState(isAdminOrManager ? "pending" : "my");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Data storage
  const [myHistory, setMyHistory] = useState([]);
  const [balances, setBalances] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [departments, setDepartments] = useState([]);

  // Filters & Form
  const [deptFilter, setDeptFilter] = useState("");
  const [form, setForm] = useState({ leave_type_id: "", from_date: "", to_date: "", reason: "" });


  // Fetch departments (for filter)
  useEffect(() => {
    if (isAdminOrManager) {
      api.get("/employees/departments")
        .then(res => setDepartments(res.data))
        .catch(() => {});
    }
  }, [isAdminOrManager]);

  // Fetch leave types (for dropdown selection)
  const fetchLeaveTypes = useCallback(async () => {
    try {
      const res = await api.get("/leave/types");
      setLeaveTypes(res.data);
    } catch (err) {
      console.error("Failed to fetch leave types:", err);
    }
  }, []);

  useEffect(() => {
    fetchLeaveTypes();
  }, [fetchLeaveTypes]);

  // Fetch data depending on active tab
  const fetchTabData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === "my") {
        const res = await api.get("/leave/my");
        setMyHistory(res.data.requests || []);
        setBalances(res.data.balances || []);
      } else if (activeTab === "pending") {
        const params = {};
        if (deptFilter) params.department_id = deptFilter;
        const res = await api.get("/leave/pending", { params });
        setPendingRequests(res.data || []);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to load leave records.");
    } finally {
      setLoading(false);
    }
  }, [activeTab, deptFilter]);

  useEffect(() => {
    fetchTabData();
  }, [fetchTabData]);

  // Form submission handler (Employee Apply Leave)
  const handleApply = async (e) => {
    e.preventDefault();
    if (!form.leave_type_id || !form.from_date || !form.to_date) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/leave/apply", {
        leave_type_id: parseInt(form.leave_type_id, 10),
        from_date: form.from_date,
        to_date: form.to_date,
        reason: form.reason,
      });
      toast.success("Leave application submitted successfully!");
      setShowApplyModal(false);
      setForm({ leave_type_id: "", from_date: "", to_date: "", reason: "" });
      fetchTabData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to submit leave request.");
    } finally {
      setSubmitting(false);
    }
  };

  // Manager Approve Action
  const handleApprove = async (id) => {
    try {
      await api.put(`/leave/${id}/approve`);
      toast.success("Leave request approved successfully.");
      fetchTabData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to approve leave request.");
    }
  };

  // Manager Reject Form trigger
  const triggerRejectModal = (id) => {
    setRejectingId(id);
    setRejectionReason("");
    setShowRejectModal(true);
  };

  // Manager Reject Action submit
  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      toast.error("Rejection reason is required.");
      return;
    }
    try {
      await api.put(`/leave/${rejectingId}/reject`, { reason: rejectionReason });
      toast.success("Leave request rejected.");
      setShowRejectModal(false);
      fetchTabData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to reject leave request.");
    }
  };

  // Calculate day difference for UI displaying
  const getDaysCount = (from, to) => {
    if (!from || !to) return 0;
    const diff = new Date(to) - new Date(from);
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Page Header ── */}
      <div className="px-6 pt-6 pb-4 shrink-0 border-b border-slate-900 bg-slate-950/40">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">Leave Management</h1>
            <p className="text-slate-400 text-sm mt-0.5">Manage leave policies, applications, and balances</p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* View toggle for Managers/Admins */}
            {isAdminOrManager && (
              <div className="flex bg-slate-900 rounded-xl p-1 gap-1 border border-slate-800">
                <button
                  onClick={() => setActiveTab("my")}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all
                    ${activeTab === "my"
                      ? "bg-violet-600 text-white shadow"
                      : "text-slate-400 hover:text-white"}`}
                >
                  My Leaves
                </button>
                <button
                  onClick={() => setActiveTab("pending")}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all
                    ${activeTab === "pending"
                      ? "bg-violet-600 text-white shadow"
                      : "text-slate-400 hover:text-white"}`}
                >
                  Team Requests
                </button>
              </div>
            )}

            <button
              id="apply-leave-modal-btn"
              onClick={() => setShowApplyModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 
                text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-violet-500/20"
            >
              <Plus size={16} />
              Apply Leave
            </button>
          </div>
        </div>
      </div>

      {/* ── Tab Content Container ── */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2">
            <Loader2 size={32} className="text-violet-500 animate-spin" />
            <p className="text-slate-500 text-sm">Retrieving leave data...</p>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* ══════════════════════════════════════════════════════════════════
                EMPLOYEE / MY LEAVES VIEW
            ══════════════════════════════════════════════════════════════════ */}
            {activeTab === "my" && (
              <>
                {/* Balance cards */}
                <div>
                  <h3 className="text-white font-semibold text-sm mb-3">Leave Balances</h3>
                  {balances.length === 0 ? (
                    <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 text-center text-slate-500 text-xs">
                      No leave balance limits found.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {balances.map((b) => (
                        <BalanceCard
                          key={b.leave_type_id}
                          name={b.leave_type_name}
                          allowed={b.days_allowed}
                          used={b.days_used}
                          remaining={b.days_remaining}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* History table */}
                <div className="bg-slate-900 border border-slate-855 rounded-2xl overflow-hidden shadow-xl">
                  <div className="px-5 py-4 border-b border-slate-800/80 bg-slate-900/40">
                    <h3 className="text-sm font-semibold text-white">Leave History</h3>
                  </div>
                  
                  {myHistory.length === 0 ? (
                    <div className="text-center py-16">
                      <CalendarOff size={40} className="text-slate-700 mx-auto mb-3" />
                      <p className="text-slate-400 text-sm font-medium">No leave requests found</p>
                      <p className="text-slate-600 text-xs mt-1">Submit your first application using the button above.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-900/20 text-slate-400 text-xs uppercase tracking-wider">
                          <tr className="border-b border-slate-800">
                            <th className="text-left px-5 py-3.5 font-medium">Leave Type</th>
                            <th className="text-left px-5 py-3.5 font-medium">Duration</th>
                            <th className="text-left px-5 py-3.5 font-medium hidden sm:table-cell">Dates</th>
                            <th className="text-left px-5 py-3.5 font-medium hidden md:table-cell">Reason</th>
                            <th className="text-left px-5 py-3.5 font-medium">Status</th>
                            <th className="text-left px-5 py-3.5 font-medium hidden lg:table-cell">Approver Remarks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/40">
                          {myHistory.map((r) => {
                            const cfg = STATUS_CFG[r.status] || STATUS_CFG.pending;
                            const StatusIcon = cfg.icon;
                            const days = getDaysCount(r.from_date, r.to_date);
                            
                            return (
                              <tr key={r.id} className="hover:bg-slate-800/10 transition-colors">
                                <td className="px-5 py-4">
                                  <div className="font-semibold text-white">{r.leave_type?.name || "Leave"}</div>
                                  <div className="text-slate-500 text-xs mt-0.5 sm:hidden">
                                    {r.from_date} to {r.to_date} ({days} days)
                                  </div>
                                </td>
                                <td className="px-5 py-4 text-white font-medium">
                                  {days} {days === 1 ? "day" : "days"}
                                </td>
                                <td className="px-5 py-4 text-slate-300 font-mono text-xs hidden sm:table-cell">
                                  {r.from_date} <ChevronRight size={10} className="inline mx-1 text-slate-500" /> {r.to_date}
                                </td>
                                <td className="px-5 py-4 text-slate-400 text-xs max-w-xs truncate hidden md:table-cell" title={r.reason}>
                                  {r.reason || <span className="text-slate-600 italic">No reason specified</span>}
                                </td>
                                <td className="px-5 py-4">
                                  <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 
                                    rounded-full border font-semibold ${cfg.color}`}>
                                    <StatusIcon size={11} />
                                    {cfg.label}
                                  </span>
                                </td>
                                <td className="px-5 py-4 text-xs hidden lg:table-cell">
                                  {r.status === "rejected" && r.rejection_reason && (
                                    <div className="text-rose-400/90 flex items-start gap-1">
                                      <Info size={12} className="shrink-0 mt-0.5" />
                                      <span>{r.rejection_reason}</span>
                                    </div>
                                  )}
                                  {r.status === "approved" && (
                                    <span className="text-slate-500 italic">Approved</span>
                                  )}
                                  {r.status === "pending" && (
                                    <span className="text-slate-600 italic">Awaiting review</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ══════════════════════════════════════════════════════════════════
                MANAGER / PENDING REQUESTS VIEW
            ══════════════════════════════════════════════════════════════════ */}
            {activeTab === "pending" && (
              <>
                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <select
                    id="dept-filter-leave"
                    value={deptFilter}
                    onChange={(e) => setDeptFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-750 rounded-xl px-3.5 py-2.5 text-sm
                      text-white focus:outline-none focus:border-violet-500 transition-all min-w-[200px]"
                  >
                    <option value="">All Departments</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                {/* Pending requests table */}
                <div className="bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden shadow-xl">
                  <div className="px-5 py-4 border-b border-slate-800/80 bg-slate-900/40">
                    <h3 className="text-sm font-semibold text-white">Pending Approval</h3>
                  </div>

                  {pendingRequests.length === 0 ? (
                    <div className="text-center py-16">
                      <CheckCircle2 size={40} className="text-emerald-500/20 mx-auto mb-3" />
                      <p className="text-slate-400 text-sm font-medium">All caught up!</p>
                      <p className="text-slate-600 text-xs mt-1">There are no pending leave requests to review.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-900/20 text-slate-400 text-xs uppercase tracking-wider">
                          <tr className="border-b border-slate-800">
                            <th className="text-left px-5 py-3.5 font-medium">Employee</th>
                            <th className="text-left px-5 py-3.5 font-medium">Leave Type</th>
                            <th className="text-left px-5 py-3.5 font-medium">Duration</th>
                            <th className="text-left px-5 py-3.5 font-medium hidden md:table-cell">Dates</th>
                            <th className="text-left px-5 py-3.5 font-medium hidden lg:table-cell">Reason</th>
                            <th className="text-right px-5 py-3.5 font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/40">
                          {pendingRequests.map((r) => {
                            const days = getDaysCount(r.from_date, r.to_date);

                            return (
                              <tr key={r.id} className="hover:bg-slate-800/10 transition-colors">
                                <td className="px-5 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500
                                      to-indigo-650 flex items-center justify-center shrink-0">
                                      <User size={14} className="text-white" />
                                    </div>
                                    <div>
                                      <div className="font-semibold text-white">{r.employee_name || `Employee #${r.employee_id}`}</div>
                                      <div className="text-slate-500 text-xs flex items-center gap-1 mt-0.5">
                                        <Building size={10} />
                                        {r.department_name || "General Staff"}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-5 py-4">
                                  <span className="text-white font-medium">{r.leave_type?.name || "Leave"}</span>
                                </td>
                                <td className="px-5 py-4 text-white font-medium">
                                  {days} {days === 1 ? "day" : "days"}
                                </td>
                                <td className="px-5 py-4 text-slate-300 font-mono text-xs hidden md:table-cell">
                                  {r.from_date} <ChevronRight size={10} className="inline mx-1 text-slate-500" /> {r.to_date}
                                </td>
                                <td className="px-5 py-4 text-slate-400 text-xs max-w-xs truncate hidden lg:table-cell" title={r.reason}>
                                  {r.reason || <span className="text-slate-600 italic">No reason specified</span>}
                                </td>
                                <td className="px-5 py-4 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      id={`approve-btn-${r.id}`}
                                      onClick={() => handleApprove(r.id)}
                                      className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-emerald-600/10 
                                        text-emerald-400 border border-emerald-500/20 hover:bg-emerald-600/20 transition-all font-semibold"
                                    >
                                      <Check size={12} />
                                      Approve
                                    </button>
                                    <button
                                      id={`reject-btn-${r.id}`}
                                      onClick={() => triggerRejectModal(r.id)}
                                      className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-rose-600/10 
                                        text-rose-400 border border-rose-500/20 hover:bg-rose-600/20 transition-all font-semibold"
                                    >
                                      <X size={12} />
                                      Reject
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

          </div>
        )}
      </div>

      {/* ── Apply Leave Modal ── */}
      {showApplyModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/20">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Calendar size={18} className="text-violet-500" />
                Apply for Leave
              </h3>
              <button onClick={() => setShowApplyModal(false)} className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleApply} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Leave Type *</label>
                <select
                  value={form.leave_type_id}
                  onChange={(e) => setForm((p) => ({ ...p, leave_type_id: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                  required
                >
                  <option value="">Select leave type...</option>
                  {leaveTypes.map((lt) => (
                    <option key={lt.id} value={lt.id}>{lt.name} ({lt.days_allowed} days/yr)</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">From Date *</label>
                  <input
                    type="date"
                    value={form.from_date}
                    onChange={(e) => setForm((p) => ({ ...p, from_date: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">To Date *</label>
                  <input
                    type="date"
                    value={form.to_date}
                    onChange={(e) => setForm((p) => ({ ...p, to_date: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                    required
                  />
                </div>
              </div>

              {form.from_date && form.to_date && (
                <div className="bg-violet-950/20 border border-violet-500/10 rounded-xl px-3 py-2 flex items-center justify-between text-xs text-violet-400">
                  <span className="flex items-center gap-1.5">
                    <Info size={13} />
                    Calculated duration:
                  </span>
                  <span className="font-bold">{getDaysCount(form.from_date, form.to_date)} day(s)</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Reason for Leave</label>
                <textarea
                  rows={3}
                  value={form.reason}
                  onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                  placeholder="Provide details about your leave application..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-850 text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  id="submit-leave-request-btn"
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2 transition-all shadow-lg shadow-violet-500/20"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Reject Reason Input Modal ── */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-850 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/20">
              <h3 className="font-semibold text-white flex items-center gap-1.5 text-sm">
                <AlertTriangle size={16} className="text-rose-500" />
                Reject Leave Request
              </h3>
              <button onClick={() => setShowRejectModal(false)} className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg">
                <X size={16} />
              </button>
            </div>
            
            <form onSubmit={handleRejectSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Reason for Rejection *</label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Provide reason for rejecting this leave request..."
                  className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:border-violet-500"
                  required
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="flex-1 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-855 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  id="confirm-reject-btn"
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors"
                >
                  Confirm Reject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
