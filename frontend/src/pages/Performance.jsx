/**
 * pages/Performance.jsx — Goals, reviews, and AI performance summaries
 *
 * Roles:
 *   - Admin / Manager / HR  : See ALL goals & reviews, can add reviews, can add goals for any employee
 *   - Employee               : See ONLY their own goals & reviews, can add goals for themselves
 */
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { BarChart3, Plus, Sparkles, Target, Star, Loader2, X, User } from "lucide-react";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

const GOAL_STATUS_COLORS = {
  not_started: "text-slate-400 bg-slate-400/10",
  in_progress:  "text-blue-400 bg-blue-400/10",
  completed:    "text-emerald-400 bg-emerald-400/10",
  cancelled:    "text-rose-400 bg-rose-400/10",
};

const GOAL_STATUS_LABELS = {
  not_started: "Not Started",
  in_progress:  "In Progress",
  completed:    "Completed",
  cancelled:    "Cancelled",
};

export default function Performance() {
  const { user, hasRole, isEmployee } = useAuth();
  const canReview   = hasRole("management_admin", "senior_manager", "hr_recruiter");
  const isPrivileged = !isEmployee; // admins, managers, HR

  const [goals,    setGoals]    = useState([]);
  const [reviews,  setReviews]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showGoalModal,   setShowGoalModal]   = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [aiSummary,         setAiSummary]         = useState("");
  const [generatingSummary, setGeneratingSummary] = useState(false);

  // My employee record (resolved from backend)
  const [myEmployeeId, setMyEmployeeId] = useState(null);

  // Forms
  const [goalForm,   setGoalForm]   = useState({ employee_id: "", title: "", description: "", target_date: "", progress: 0, status: "not_started" });
  const [reviewForm, setReviewForm] = useState({ employee_id: "", period: "", rating: "", comments: "" });

  // Resolve own employee ID (for employees only, so they can pre-fill the goal form)
  useEffect(() => {
    if (isEmployee) {
      api.get("/employees/me")
        .then((res) => {
          const eid = res.data?.id;
          setMyEmployeeId(eid);
          setGoalForm((prev) => ({ ...prev, employee_id: eid ?? "" }));
        })
        .catch(() => {
          // fallback: the backend will enforce it anyway
        });
    }
  }, [isEmployee]);

  // Fetch goals + reviews (backend enforces role-based filtering)
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [goalsRes, reviewsRes] = await Promise.all([
          api.get("/performance/goals"),
          api.get("/performance/reviews"),
        ]);
        setGoals(goalsRes.data);
        setReviews(reviewsRes.data);
      } catch (err) {
        toast.error(err.response?.data?.detail || "Failed to load performance data.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleCreateGoal = async (e) => {
    e.preventDefault();
    if (!goalForm.title) {
      toast.error("Goal title is required.");
      return;
    }
    if (!goalForm.employee_id) {
      toast.error("Employee ID is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await api.post("/performance/goals", {
        ...goalForm,
        employee_id: Number(goalForm.employee_id),
        progress:    Number(goalForm.progress),
      });
      setGoals((prev) => [res.data, ...prev]);
      setShowGoalModal(false);
      setGoalForm({ employee_id: myEmployeeId ?? "", title: "", description: "", target_date: "", progress: 0, status: "not_started" });
      toast.success("Goal created successfully!");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create goal.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateReview = async (e) => {
    e.preventDefault();
    if (!reviewForm.employee_id || !reviewForm.period || !reviewForm.rating) {
      toast.error("Employee ID, period, and rating are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await api.post("/performance/reviews", {
        ...reviewForm,
        employee_id: Number(reviewForm.employee_id),
        rating:      Number(reviewForm.rating),
      });
      setReviews((prev) => [res.data, ...prev]);
      setShowReviewModal(false);
      setReviewForm({ employee_id: "", period: "", rating: "", comments: "" });
      toast.success("Review added successfully!");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create review.");
    } finally {
      setSaving(false);
    }
  };

  const generateAiSummary = async (review) => {
    setGeneratingSummary(true);
    setAiSummary("");
    try {
      const res = await api.post("/ai/performance-summary", {
        review_id:     review.id,
        employee_name: `Employee #${review.employee_id}`,
        period:        review.period,
        rating:        review.rating,
        comments:      review.comments,
        goals:         goals.filter((g) => g.employee_id === review.employee_id),
      });
      setAiSummary(res.data.summary);
      setReviews((prev) =>
        prev.map((r) => (r.id === review.id ? { ...r, ai_summary: res.data.summary } : r))
      );
    } catch (err) {
      toast.error(err.response?.data?.detail || "AI summary failed. Check GROQ_API_KEY.");
    } finally {
      setGeneratingSummary(false);
    }
  };

  // Radar chart — based on the current user's own data
  const completedGoals = goals.filter((g) => g.status === "completed").length;
  const avgRating      = reviews.length
    ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
    : 0;

  const radarData = [
    { subject: "Goals",      value: Math.min(completedGoals * 20, 100) || 40 },
    { subject: "Attendance", value: 85 },
    { subject: "Rating",     value: avgRating ? avgRating * 20 : 60 },
    { subject: "Teamwork",   value: 75 },
    { subject: "Innovation", value: 65 },
  ];

  return (
    <div className="p-6 h-full overflow-y-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">
            {isEmployee ? "My Performance" : "Performance"}
          </h2>
          <p className="text-slate-400 text-sm">
            {goals.length} goal{goals.length !== 1 ? "s" : ""} · {reviews.length} review{reviews.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowGoalModal(true)}
            id="add-goal-btn"
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 hover:border-violet-500 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Target size={15} />
            {isEmployee ? "Add My Goal" : "Add Goal"}
          </button>
          {canReview && (
            <button
              onClick={() => setShowReviewModal(true)}
              id="add-review-btn"
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <Plus size={15} />
              Add Review
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Goals */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-sm font-semibold text-white">
            {isEmployee ? "My Goals" : "Goals"}
          </h3>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4 animate-pulse">
                  <div className="h-4 bg-slate-800 rounded w-3/4 mb-3" />
                  <div className="h-2 bg-slate-800 rounded w-full" />
                </div>
              ))}
            </div>
          ) : goals.length === 0 ? (
            <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-2xl">
              <Target size={36} className="text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400 text-sm font-medium">No goals set yet.</p>
              <p className="text-slate-600 text-xs mt-1">Click "Add{isEmployee ? " My" : ""} Goal" to create your first goal.</p>
            </div>
          ) : (
            goals.map((goal) => (
              <div key={goal.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="font-medium text-white text-sm truncate">{goal.title}</p>
                    {goal.description && <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{goal.description}</p>}
                    {isPrivileged && (
                      <p className="text-xs text-slate-600 mt-1 flex items-center gap-1">
                        <User size={10} /> Employee #{goal.employee_id}
                      </p>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0 ${GOAL_STATUS_COLORS[goal.status]}`}>
                    {GOAL_STATUS_LABELS[goal.status] || goal.status}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-slate-800 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-500 transition-all"
                      style={{ width: `${goal.progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-400 w-10 text-right">{goal.progress}%</span>
                </div>
                {goal.target_date && (
                  <p className="text-xs text-slate-500 mt-2">Target: {goal.target_date}</p>
                )}
              </div>
            ))
          )}
        </div>

        {/* Radar + Reviews */}
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3">
              {isEmployee ? "My Performance Radar" : "Performance Radar"}
            </h3>
            <ResponsiveContainer width="100%" height={180}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#1e293b" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "#64748b", fontSize: 10 }} />
                <Radar dataKey="value" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Reviews */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white">
              {isEmployee ? "My Reviews" : "Recent Reviews"}
            </h3>
            {loading ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 animate-pulse">
                <div className="h-4 bg-slate-800 rounded w-1/2 mb-2" />
                <div className="h-3 bg-slate-800 rounded w-full" />
              </div>
            ) : reviews.length === 0 ? (
              <div className="text-center py-6 bg-slate-900 border border-slate-800 rounded-xl">
                <Star size={24} className="text-slate-700 mx-auto mb-2" />
                <p className="text-slate-500 text-xs">No reviews yet.</p>
              </div>
            ) : (
              reviews.slice(0, 3).map((r) => (
                <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      {isPrivileged && (
                        <p className="text-xs text-slate-500 flex items-center gap-1 mb-0.5">
                          <User size={10} /> Employee #{r.employee_id}
                        </p>
                      )}
                      <p className="text-sm font-medium text-white">{r.period}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star size={12} className="text-amber-400 fill-amber-400" />
                      <span className="text-sm font-bold text-amber-400">{r.rating || "—"}</span>
                    </div>
                  </div>
                  {r.comments && <p className="text-xs text-slate-500 line-clamp-2 mb-2">{r.comments}</p>}
                  {r.ai_summary ? (
                    <div className="text-xs text-violet-400 bg-violet-400/5 border border-violet-400/20 rounded-lg p-3 max-h-40 overflow-y-auto leading-relaxed">
                      {r.ai_summary}
                    </div>
                  ) : canReview && (
                    <button
                      onClick={() => generateAiSummary(r)}
                      disabled={generatingSummary}
                      className="w-full flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg
                        bg-violet-600/10 border border-violet-600/20 text-violet-400 hover:bg-violet-600/20 transition-colors disabled:opacity-50"
                    >
                      {generatingSummary ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                      Generate AI Summary
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Goal Modal ─────────────────────────────────────────────────────── */}
      {showGoalModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h3 className="font-semibold text-white">Add Goal</h3>
              <button onClick={() => setShowGoalModal(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateGoal} className="p-6 space-y-4">
              {/* Employee ID — only shown for privileged users; employees get it auto-filled */}
              {isPrivileged ? (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Employee ID *</label>
                  <input
                    type="number"
                    value={goalForm.employee_id}
                    onChange={(e) => setGoalForm((p) => ({ ...p, employee_id: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                    required
                  />
                </div>
              ) : (
                // Hidden for employees — auto-filled with their own employee ID
                <input type="hidden" value={goalForm.employee_id} />
              )}

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Goal Title *</label>
                <input
                  type="text"
                  value={goalForm.title}
                  onChange={(e) => setGoalForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Complete React certification"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={goalForm.description}
                  onChange={(e) => setGoalForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white resize-none focus:outline-none focus:border-violet-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Target Date</label>
                  <input
                    type="date"
                    value={goalForm.target_date}
                    onChange={(e) => setGoalForm((p) => ({ ...p, target_date: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Progress: {goalForm.progress}%</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={goalForm.progress}
                    onChange={(e) => setGoalForm((p) => ({ ...p, progress: e.target.value }))}
                    className="w-full mt-2 accent-violet-600"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Status</label>
                <select
                  value={goalForm.status}
                  onChange={(e) => setGoalForm((p) => ({ ...p, status: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                >
                  <option value="not_started">Not Started</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowGoalModal(false)}
                  className="flex-1 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm"
                >Cancel</button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  Create Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Review Modal (privileged users only) ─────────────────────────── */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h3 className="font-semibold text-white">Add Performance Review</h3>
              <button onClick={() => setShowReviewModal(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateReview} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Employee ID *</label>
                  <input
                    type="number"
                    value={reviewForm.employee_id}
                    onChange={(e) => setReviewForm((p) => ({ ...p, employee_id: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Period *</label>
                  <input
                    type="text"
                    value={reviewForm.period}
                    onChange={(e) => setReviewForm((p) => ({ ...p, period: e.target.value }))}
                    placeholder="Q2 2026"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Rating (1–5) *</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  step="0.5"
                  value={reviewForm.rating}
                  onChange={(e) => setReviewForm((p) => ({ ...p, rating: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Comments</label>
                <textarea
                  rows={4}
                  value={reviewForm.comments}
                  onChange={(e) => setReviewForm((p) => ({ ...p, comments: e.target.value }))}
                  placeholder="Performance notes, strengths, areas for improvement..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:border-violet-500"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="flex-1 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm"
                >Cancel</button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  Save Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
