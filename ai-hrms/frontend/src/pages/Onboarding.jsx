/**
 * pages/Onboarding.jsx — Onboarding checklist for new employees
 */
import { useState, useEffect } from "react";
import { ClipboardList, CheckCircle2, Circle, Plus, X, Loader2 } from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

const DEFAULT_TASKS = [
  "Complete employment documentation",
  "IT equipment setup and credentials",
  "Office tour and team introductions",
  "HR policies and handbook review",
  "First week schedule and training plan",
  "Benefits enrollment",
  "Emergency contact information",
  "Security access and badge",
];

export default function Onboarding() {
  const { hasRole } = useAuth();
  const canManage = hasRole("management_admin", "senior_manager");

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ employee_id: "", task_name: "", description: "", due_date: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res = await api.get("/performance/onboarding");
        setTasks(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, []);

  const handleComplete = async (taskId) => {
    try {
      const res = await api.put(`/performance/onboarding/${taskId}/complete`);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? res.data : t)));
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to mark complete.");
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.employee_id || !form.task_name) return;
    setSaving(true);
    try {
      const res = await api.post("/performance/onboarding", {
        ...form,
        employee_id: Number(form.employee_id),
      });
      setTasks((prev) => [...prev, res.data]);
      setShowModal(false);
      setForm({ employee_id: "", task_name: "", description: "", due_date: "" });
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to create task.");
    } finally {
      setSaving(false);
    }
  };

  const completed = tasks.filter((t) => t.is_completed).length;
  const progress = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;

  // Group by employee
  const byEmployee = tasks.reduce((acc, t) => {
    const key = `Employee #${t.employee_id}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  return (
    <div className="p-6 h-full overflow-y-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Onboarding</h2>
          <p className="text-slate-400 text-sm">{completed}/{tasks.length} tasks completed</p>
        </div>
        {canManage && (
          <button id="add-onboarding-task-btn" onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-colors">
            <Plus size={16} />
            Add Task
          </button>
        )}
      </div>

      {/* Overall Progress */}
      {tasks.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-white">Overall Onboarding Progress</p>
            <span className="text-violet-400 font-bold">{progress}%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2.5">
            <div
              className="h-2.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex gap-4 mt-3 text-xs text-slate-400">
            <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-400" />{completed} completed</span>
            <span className="flex items-center gap-1"><Circle size={12} className="text-slate-600" />{tasks.length - completed} pending</span>
          </div>
        </div>
      )}

      {/* Default checklist hint */}
      {tasks.length === 0 && !loading && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Standard Onboarding Checklist</h3>
          <p className="text-xs text-slate-400 mb-4">Add tasks for new employees using the "Add Task" button. Here's a suggested checklist:</p>
          <div className="space-y-2">
            {DEFAULT_TASKS.map((task, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-slate-400">
                <Circle size={14} className="text-slate-600 shrink-0" />
                {task}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tasks by Employee */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 size={22} className="text-violet-400 animate-spin" />
        </div>
      ) : (
        Object.entries(byEmployee).map(([empLabel, empTasks]) => {
          const empCompleted = empTasks.filter((t) => t.is_completed).length;
          return (
            <div key={empLabel} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardList size={15} className="text-slate-400" />
                  <span className="text-sm font-semibold text-white">{empLabel}</span>
                </div>
                <span className="text-xs text-slate-400">{empCompleted}/{empTasks.length} done</span>
              </div>
              <div className="divide-y divide-slate-800/50">
                {empTasks.map((task) => (
                  <div key={task.id}
                    className={`flex items-start gap-3 px-5 py-4 hover:bg-slate-800/30 transition-colors
                      ${task.is_completed ? "opacity-60" : ""}`}
                  >
                    <button
                      id={`complete-task-${task.id}`}
                      onClick={() => !task.is_completed && handleComplete(task.id)}
                      disabled={!!task.is_completed}
                      className="mt-0.5 shrink-0"
                    >
                      {task.is_completed
                        ? <CheckCircle2 size={18} className="text-emerald-400" />
                        : <Circle size={18} className="text-slate-600 hover:text-violet-400 transition-colors" />
                      }
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${task.is_completed ? "line-through text-slate-500" : "text-white"}`}>
                        {task.task_name}
                      </p>
                      {task.description && <p className="text-xs text-slate-500 mt-0.5">{task.description}</p>}
                      {task.due_date && (
                        <p className="text-xs text-slate-600 mt-1">Due: {task.due_date}</p>
                      )}
                    </div>
                    {task.completed_at && (
                      <span className="text-xs text-emerald-400 shrink-0">
                        {new Date(task.completed_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}

      {/* Add Task Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h3 className="font-semibold text-white">Add Onboarding Task</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Employee ID *</label>
                <input type="number" value={form.employee_id} onChange={(e) => setForm((p) => ({ ...p, employee_id: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Task Name *</label>
                <input type="text" value={form.task_name} onChange={(e) => setForm((p) => ({ ...p, task_name: e.target.value }))}
                  placeholder="e.g. Complete employment forms"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Description</label>
                <textarea rows={2} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white resize-none focus:outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Due Date</label>
                <input type="date" value={form.due_date} onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm">Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2">
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  Add Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
