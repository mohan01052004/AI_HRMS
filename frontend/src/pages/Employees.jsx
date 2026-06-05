/**
 * pages/Employees.jsx — Complete Employee Management
 *
 * Features:
 * - Paginated table: name, email, department, designation, status, actions
 * - Live search (debounced 300ms) by name, email, or designation
 * - Department dropdown filter
 * - Status filter (active/inactive/on_leave/terminated)
 * - Add Employee modal — full form with all fields
 * - Edit Employee modal — pre-filled, partial update
 * - Soft-Delete (deactivate) with confirmation dialog
 * - Role-gated: Add/Edit/Delete only for Admin & Manager
 * - Pagination with prev/next controls
 * - Loading skeleton + empty state
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, Plus, Search, Pencil, Trash2, X, Loader2,
  AlertCircle, ChevronLeft, ChevronRight, RefreshCw,
  Building2, Phone, Mail, Calendar, DollarSign, MapPin,
  UserCheck, Filter, Eye, User, Check, LayoutDashboard,
  Hash,
} from "lucide-react";


import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  active:     { label: "Active",     cls: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
  inactive:   { label: "Inactive",   cls: "text-slate-400  bg-slate-400/10  border-slate-400/20"  },
  on_leave:   { label: "On Leave",   cls: "text-amber-400  bg-amber-400/10  border-amber-400/20"  },
  terminated: { label: "Terminated", cls: "text-rose-400   bg-rose-400/10   border-rose-400/20"   },
};

const EMPTY_FORM = {
  name: "", email: "", phone: "", designation: "",
  department_id: "", manager_id: "", date_of_joining: "",
  salary: "", status: "active", address: "", gender: "",
  role: "employee", password: "",
};



const PAGE_SIZE = 15;

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.inactive;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium border ${cfg.cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {cfg.label}
    </span>
  );
}

function Avatar({ name }) {
  const initials = name
    ? name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";
  const colors = [
    "from-violet-500 to-indigo-500",
    "from-emerald-500 to-teal-500",
    "from-amber-500 to-orange-500",
    "from-rose-500 to-pink-500",
    "from-blue-500 to-cyan-500",
  ];
  const color = colors[name?.charCodeAt(0) % colors.length] || colors[0];
  return (
    <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${color} flex items-center justify-center shrink-0`}>
      <span className="text-xs font-bold text-white">{initials}</span>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-800/50">
      {[1,2,3,4,5,6].map(i => (
        <td key={i} className="px-5 py-4">
          <div className="h-4 bg-slate-800 rounded-lg animate-pulse" style={{ width: `${60 + i * 8}%` }} />
        </td>
      ))}
    </tr>
  );
}

function FormField({ label, required, error, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">
        {label} {required && <span className="text-rose-400">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-rose-400 mt-1">{error}</p>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Employees() {
  const { hasRole, user } = useAuth();
  const navigate = useNavigate();
  const canCreate = hasRole("management_admin", "hr_recruiter");
  const canEdit   = hasRole("management_admin", "senior_manager", "hr_recruiter");

  const canDelete = hasRole("management_admin");

  // ── State ────────────────────────────────────────────────────────────────

  const [employees, setEmployees]     = useState([]);
  const [total, setTotal]             = useState(0);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [refreshKey, setRefreshKey]   = useState(0);

  // Filters
  const [search, setSearch]           = useState("");
  const [deptFilter, setDeptFilter]   = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage]               = useState(0);

  // Modals
  const [showModal, setShowModal]     = useState(false);
  const [editingEmp, setEditingEmp]   = useState(null);   // null = create mode
  const [showDetail, setShowDetail]   = useState(null);   // employee to preview
  const [deleteTarget, setDeleteTarget] = useState(null); // employee to deactivate

  // Form
  const [form, setForm]               = useState(EMPTY_FORM);
  const [formErrors, setFormErrors]   = useState({});
  const [saving, setSaving]           = useState(false);
  const [saveError, setSaveError]     = useState("");
  const [deleting, setDeleting]       = useState(false);

  const searchTimer = useRef(null);

  // ── Data Fetching ────────────────────────────────────────────────────────

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await api.get("/employees/departments");
      setDepartments(res.data);
    } catch { /* silent */ }
  }, []);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        skip:  page * PAGE_SIZE,
        limit: PAGE_SIZE,
        ...(search      && { search }),
        ...(deptFilter  && { department_id: deptFilter }),
        ...(statusFilter && { status: statusFilter }),
      };
      const res = await api.get("/employees", { params });
      // Handle both paginated {items, total} and plain array (backwards compat)
      if (Array.isArray(res.data)) {
        setEmployees(res.data);
        setTotal(res.data.length);
      } else {
        setEmployees(res.data.items ?? []);
        setTotal(res.data.total ?? 0);
      }
    } catch (err) {
      console.error("Failed to fetch employees:", err);
    } finally {
      setLoading(false);
    }
  }, [search, deptFilter, statusFilter, page, refreshKey]);

  useEffect(() => { fetchDepartments(); }, [fetchDepartments]);

  // Debounce search
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(0);
    }, 300);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  // ── Modal Helpers ────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingEmp(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setSaveError("");
    setShowModal(true);
  };

  const openEdit = (emp) => {
    setEditingEmp(emp);
    setForm({
      name:             emp.name             || "",
      email:            emp.email            || "",
      phone:            emp.phone            || "",
      designation:      emp.designation      || "",
      department_id:    emp.department_id    ?? "",
      manager_id:       emp.manager_id       ?? "",
      date_of_joining:  emp.date_of_joining  || "",
      salary:           emp.salary           ?? "",
      status:           emp.status           || "active",
      address:          emp.address          || "",
      gender:           emp.gender           || "",
    });

    setFormErrors({});
    setSaveError("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingEmp(null);
    setSaveError("");
  };

  // ── Form Validation ──────────────────────────────────────────────────────

  const validate = () => {
    const errs = {};
    if (!form.name.trim())                          errs.name  = "Name is required.";
    if (!form.email.trim())                         errs.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
                                                    errs.email = "Invalid email format.";
    if (form.salary !== "" && Number(form.salary) < 0)
                                                    errs.salary = "Salary cannot be negative.";
    return errs;
  };

  // ── Save (Create / Update) ───────────────────────────────────────────────

  const handleSave = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setFormErrors(errs); return; }

    setSaving(true);
    setSaveError("");
    setFormErrors({});

    const payload = {
      name:            form.name.trim(),
      email:           form.email.trim(),
      phone:           form.phone.trim()       || null,
      designation:     form.designation.trim() || null,
      department_id:   form.department_id !== "" ? Number(form.department_id) : null,
      manager_id:      form.manager_id    !== "" ? Number(form.manager_id)    : null,
      date_of_joining: form.date_of_joining    || null,
      salary:          form.salary !== ""       ? Number(form.salary)         : 0,
      status:          form.status,
      address:         form.address.trim()     || null,
      gender:          form.gender             || null,
      ...(!editingEmp && {
        role: form.role,
        password: form.password || null
      })
    };



    try {
      if (editingEmp) {
        // Remove email from update payload (not editable)
        const { email, ...updatePayload } = payload;
        await api.put(`/employees/${editingEmp.id}`, updatePayload);
      } else {
        await api.post("/employees", payload);
      }
      closeModal();
      setRefreshKey(k => k + 1);
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        // Pydantic validation errors
        const fieldErrs = {};
        detail.forEach(d => {
          const field = d.loc?.[d.loc.length - 1];
          if (field) fieldErrs[field] = d.msg;
        });
        setFormErrors(fieldErrs);
      } else {
        setSaveError(detail || "Failed to save. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Permanent Hard Delete ──────────────────────────────────────────────────

  const handleDeleteEmployee = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/employees/${deleteTarget.id}`);
      setDeleteTarget(null);
      setRefreshKey(k => k + 1);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to delete employee.");
    } finally {
      setDeleting(false);
    }
  };

  const handleApproveEmployee = async (id) => {
    try {
      await api.put(`/employees/${id}/approve`);
      setRefreshKey(k => k + 1);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to approve employee.");
    }
  };


  // ── Pagination ───────────────────────────────────────────────────────────

  const totalPages   = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canPrev      = page > 0;
  const canNext      = (page + 1) < totalPages;
  const startRecord  = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const endRecord    = Math.min((page + 1) * PAGE_SIZE, total);

  // ── Field change helper ──────────────────────────────────────────────────

  const setField = (key, val) => {
    setForm(p => ({ ...p, [key]: val }));
    setFormErrors(p => { const n = { ...p }; delete n[key]; return n; });
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Page Header ── */}
      <div className="px-6 pt-6 pb-4 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white">Employee Directory</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              {loading ? "Loading…" : `${total} employee${total !== 1 ? "s" : ""} found`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="refresh-employees-btn"
              onClick={() => setRefreshKey(k => k + 1)}
              title="Refresh"
              className="p-2 rounded-xl border border-slate-700 text-slate-400 hover:text-white
                hover:border-slate-600 transition-colors"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
            {canCreate && (
              <button
                id="add-employee-btn"
                onClick={openCreate}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500
                  text-white text-sm font-semibold rounded-xl transition-colors shadow-lg
                  shadow-violet-500/20"
              >
                <Plus size={16} />
                Add Employee
              </button>
            )}
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              id="employee-search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, email, designation…"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5
                text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500
                focus:ring-1 focus:ring-violet-500/20 transition-all"
            />
          </div>

          {/* Department filter */}
          <select
            id="dept-filter"
            value={deptFilter}
            onChange={e => { setDeptFilter(e.target.value); setPage(0); }}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white
              focus:outline-none focus:border-violet-500 transition-all min-w-[160px]"
          >
            <option value="">All Departments</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          {/* Status filter */}
          <select
            id="status-filter"
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white
              focus:outline-none focus:border-violet-500 transition-all min-w-[140px]"
          >
            <option value="">All Statuses</option>
            {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
              <option key={val} value={val}>{cfg.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto px-6 pb-0">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-900">
                <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="text-left px-5 py-3.5 font-medium">Employee</th>
                  <th className="text-left px-5 py-3.5 font-medium hidden md:table-cell">Department</th>
                  <th className="text-left px-5 py-3.5 font-medium hidden lg:table-cell">Designation</th>
                  <th className="text-left px-5 py-3.5 font-medium hidden xl:table-cell">Joined</th>
                  <th className="text-left px-5 py-3.5 font-medium hidden xl:table-cell">Salary</th>
                  <th className="text-left px-5 py-3.5 font-medium">Status</th>
                  <th className="text-right px-5 py-3.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {/* Loading skeletons */}
                {loading && employees.length === 0 && (
                  [1,2,3,4,5,6,7,8].map(i => <SkeletonRow key={i} />)
                )}

                {/* Empty state */}
                {!loading && employees.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-20">
                      <Users size={44} className="text-slate-700 mx-auto mb-3" />
                      <p className="text-slate-400 font-medium">No employees found</p>
                      <p className="text-slate-600 text-xs mt-1">
                        {search || deptFilter || statusFilter
                          ? "Try adjusting your search or filters"
                          : "Add your first employee to get started"}
                      </p>
                    </td>
                  </tr>
                )}

                {/* Data rows */}
                {employees.map(emp => (
                  <tr
                    key={emp.id}
                    className={`hover:bg-slate-800/30 transition-colors group
                      ${loading ? "opacity-50" : ""}`}
                  >
                    {/* Employee name + email */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={emp.name} />
                        <div className="min-w-0">
                          <p className="font-semibold text-white truncate">{emp.name}</p>
                          {emp.employee_code && (
                            <span className="text-[10px] font-mono text-violet-400/80 bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.5 rounded">
                              {emp.employee_code}
                            </span>
                          )}
                          <p className="text-slate-500 text-xs flex items-center gap-1 mt-0.5">
                            <Mail size={10} />
                            {emp.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Department */}
                    <td className="px-5 py-4 hidden md:table-cell">
                      {emp.department ? (
                        <span className="flex items-center gap-1.5 text-slate-300">
                          <Building2 size={12} className="text-slate-500" />
                          {emp.department.name}
                        </span>
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>

                    {/* Designation */}
                    <td className="px-5 py-4 hidden lg:table-cell text-slate-300">
                      {emp.designation || <span className="text-slate-600 text-xs">—</span>}
                    </td>

                    {/* Date of joining */}
                    <td className="px-5 py-4 hidden xl:table-cell text-slate-400 text-xs">
                      {emp.date_of_joining
                        ? new Date(emp.date_of_joining).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                        : <span className="text-slate-600">—</span>}
                    </td>

                    {/* Salary */}
                    <td className="px-5 py-4 hidden xl:table-cell text-slate-300 text-xs font-mono">
                      {emp.salary > 0
                        ? `₹${emp.salary.toLocaleString("en-IN")}`
                        : <span className="text-slate-600">—</span>}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1 items-start">
                        <StatusBadge status={emp.status} />
                        {!emp.is_approved && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                            Pending Approval
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        {/* Approve — Admin only, for pending employees */}
                        {hasRole("management_admin") && !emp.is_approved && (
                          <button
                            id={`approve-emp-${emp.id}`}
                            onClick={() => handleApproveEmployee(emp.id)}
                            title="Approve Employee"
                            className="p-1.5 rounded-lg text-emerald-400 hover:text-emerald-300
                              hover:bg-emerald-500/10 transition-colors mr-1"
                          >
                            <Check size={14} />
                          </button>
                        )}
                        {/* View detail */}
                        <button
                          id={`view-emp-${emp.id}`}
                          onClick={() => setShowDetail(emp)}
                          title="View details"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300
                            hover:bg-slate-700/50 transition-colors"
                        >
                          <Eye size={14} />
                        </button>

                        {/* View Dashboard — Admin/Manager/HR only */}
                        {canEdit && (
                          <button
                            id={`dashboard-emp-${emp.id}`}
                            onClick={() => navigate(`/employees/${emp.id}/dashboard`)}
                            title="View employee dashboard"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-violet-400
                              hover:bg-violet-400/10 transition-colors"
                          >
                            <LayoutDashboard size={14} />
                          </button>
                        )}

                        {/* Edit — Admin/Manager only */}
                        {canEdit && (
                          <button
                            id={`edit-emp-${emp.id}`}
                            onClick={() => openEdit(emp)}
                            title="Edit employee"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-violet-400
                              hover:bg-violet-400/10 transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
                        )}

                        {/* Delete — Admin only, excluding self */}
                        {canDelete && emp.user_id !== user?.id && (
                          <button
                            id={`delete-emp-${emp.id}`}
                            onClick={() => setDeleteTarget(emp)}
                            title="Delete employee permanently"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400
                              hover:bg-rose-400/10 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          {total > 0 && (
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-800
              text-xs text-slate-400">
              <span>
                Showing <span className="text-white font-medium">{startRecord}–{endRecord}</span> of{" "}
                <span className="text-white font-medium">{total}</span> employees
              </span>
              <div className="flex items-center gap-1">
                <button
                  id="prev-page-btn"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={!canPrev || loading}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-700
                    disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors"
                >
                  <ChevronLeft size={13} /> Prev
                </button>
                <span className="px-3 py-1.5 text-white font-medium">
                  {page + 1} / {totalPages}
                </span>
                <button
                  id="next-page-btn"
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={!canNext || loading}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-700
                    disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors"
                >
                  Next <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Padding below table ── */}
      <div className="h-6 shrink-0" />

      {/* ══════════════════════════════════════════════════════════════════
          CREATE / EDIT MODAL
      ══════════════════════════════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl
            flex flex-col max-h-[92vh]">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
              <div>
                <h2 className="font-semibold text-white text-base">
                  {editingEmp ? `Edit — ${editingEmp.name}` : "Add New Employee"}
                </h2>
                <p className="text-slate-500 text-xs mt-0.5">
                  {editingEmp ? "Update employee information" : "Fill in the details to create a new employee record"}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal body */}
            <form
              id="employee-form"
              onSubmit={handleSave}
              className="flex-1 overflow-y-auto px-6 py-5 space-y-5"
            >
              {/* Server-level error */}
              {saveError && (
                <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/30
                  text-rose-400 rounded-xl px-4 py-3 text-sm">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{saveError}</span>
                </div>
              )}

              {/* Section: Personal info */}
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Personal Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Full Name" required error={formErrors.name}>
                    <input
                      id="form-name"
                      type="text"
                      value={form.name}
                      onChange={e => setField("name", e.target.value)}
                      placeholder="e.g. Jane Smith"
                      className={`w-full bg-slate-800 border rounded-xl px-3.5 py-2.5 text-sm text-white
                        placeholder-slate-500 focus:outline-none focus:ring-1 transition-all
                        ${formErrors.name
                          ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20"
                          : "border-slate-700 focus:border-violet-500 focus:ring-violet-500/20"}`}
                    />
                  </FormField>

                  <FormField
                    label="Email Address"
                    required
                    error={formErrors.email}
                  >
                    <input
                      id="form-email"
                      type="email"
                      value={form.email}
                      onChange={e => setField("email", e.target.value)}
                      disabled={!!editingEmp}
                      placeholder="jane@company.com"
                      className={`w-full bg-slate-800 border rounded-xl px-3.5 py-2.5 text-sm text-white
                        placeholder-slate-500 focus:outline-none focus:ring-1 transition-all
                        disabled:opacity-50 disabled:cursor-not-allowed
                        ${formErrors.email
                          ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20"
                          : "border-slate-700 focus:border-violet-500 focus:ring-violet-500/20"}`}
                    />
                    {editingEmp && (
                      <p className="text-xs text-slate-600 mt-1">Email cannot be changed after creation.</p>
                    )}
                  </FormField>

                  <FormField label="Phone" error={formErrors.phone}>
                    <input
                      id="form-phone"
                      type="tel"
                      value={form.phone}
                      onChange={e => setField("phone", e.target.value)}
                      placeholder="+91 9876543210"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5
                        text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500
                        focus:ring-1 focus:ring-violet-500/20 transition-all"
                    />
                  </FormField>

                  <FormField label="Gender" error={formErrors.gender}>
                    <select
                      id="form-gender"
                      value={form.gender}
                      onChange={e => setField("gender", e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5
                        text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1
                        focus:ring-violet-500/20 transition-all"
                    >
                      <option value="">— Select Gender —</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </FormField>

                  <FormField label="Date of Joining" error={formErrors.date_of_joining}>

                    <input
                      id="form-doj"
                      type="date"
                      value={form.date_of_joining}
                      onChange={e => setField("date_of_joining", e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5
                        text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1
                        focus:ring-violet-500/20 transition-all"
                    />
                  </FormField>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-slate-800" />

              {/* Section: Job info */}
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Job Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Designation" error={formErrors.designation}>
                    <input
                      id="form-designation"
                      type="text"
                      value={form.designation}
                      onChange={e => setField("designation", e.target.value)}
                      placeholder="e.g. Senior Engineer"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5
                        text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500
                        focus:ring-1 focus:ring-violet-500/20 transition-all"
                    />
                  </FormField>

                  <FormField label="Department" error={formErrors.department_id}>
                    <select
                      id="form-department"
                      value={form.department_id}
                      onChange={e => setField("department_id", e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5
                        text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1
                        focus:ring-violet-500/20 transition-all"
                    >
                      <option value="">— Select Department —</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Salary (₹/month)" error={formErrors.salary}>
                    <input
                      id="form-salary"
                      type="number"
                      min="0"
                      step="500"
                      value={form.salary}
                      onChange={e => setField("salary", e.target.value)}
                      placeholder="e.g. 75000"
                      className={`w-full bg-slate-800 border rounded-xl px-3.5 py-2.5 text-sm text-white
                        placeholder-slate-500 focus:outline-none focus:ring-1 transition-all
                        ${formErrors.salary
                          ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20"
                          : "border-slate-700 focus:border-violet-500 focus:ring-violet-500/20"}`}
                    />
                  </FormField>

                  <FormField label="Status" error={formErrors.status}>
                    <select
                      id="form-status"
                      value={form.status}
                      onChange={e => setField("status", e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5
                        text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1
                        focus:ring-violet-500/20 transition-all"
                    >
                      {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                        <option key={val} value={val}>{cfg.label}</option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Reports To (Manager ID)" error={formErrors.manager_id}>
                    <input
                      id="form-manager"
                      type="number"
                      min="1"
                      value={form.manager_id}
                      onChange={e => setField("manager_id", e.target.value)}
                      placeholder="Employee ID of manager"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5
                        text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500
                        focus:ring-1 focus:ring-violet-500/20 transition-all"
                    />
                  </FormField>
                </div>
              </div>

              {/* Section: Login Credentials (create mode only) */}
              {!editingEmp && (
                <>
                  <div className="border-t border-slate-800 my-4" />
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                      Login Credentials
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField label="Account Role" required error={formErrors.role}>
                        {hasRole("management_admin") ? (
                          <select
                            id="form-role"
                            value={form.role}
                            onChange={e => setField("role", e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5
                              text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1
                              focus:ring-violet-500/20 transition-all"
                            required
                          >
                            <option value="employee">Employee</option>
                            <option value="hr_recruiter">HR Recruiter</option>
                            <option value="senior_manager">Senior Manager</option>
                          </select>
                        ) : (
                          <input
                            type="text"
                            value="Employee (Pending Approval)"
                            disabled
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5
                              text-sm text-slate-400 focus:outline-none transition-all disabled:opacity-60"
                          />
                        )}
                      </FormField>

                      <FormField label="Password" error={formErrors.password}>
                        <input
                          id="form-password"
                          type="text"
                          value={form.password}
                          onChange={e => setField("password", e.target.value)}
                          placeholder="Default: Company@2026!"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5
                            text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500
                            focus:ring-1 focus:ring-violet-500/20 transition-all"
                        />
                      </FormField>
                    </div>
                  </div>
                </>
              )}

              {/* Divider */}
              <div className="border-t border-slate-800" />


              {/* Section: Address */}
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Address (Optional)
                </h3>
                <textarea
                  id="form-address"
                  rows={2}
                  value={form.address}
                  onChange={e => setField("address", e.target.value)}
                  placeholder="Full residential address…"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5
                    text-sm text-white placeholder-slate-500 resize-none focus:outline-none
                    focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 transition-all"
                />
              </div>
            </form>

            {/* Modal footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 shrink-0 gap-3">
              <p className="text-xs text-slate-600">
                Fields marked <span className="text-rose-400">*</span> are required
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2 rounded-xl border border-slate-700 text-slate-300
                    hover:bg-slate-800 text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  id="save-employee-btn"
                  form="employee-form"
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white
                    text-sm font-semibold transition-colors disabled:opacity-60
                    disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-violet-500/20"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {saving
                    ? (editingEmp ? "Updating…" : "Creating…")
                    : (editingEmp ? "Save Changes" : "Create Employee")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          DETAIL VIEW MODAL (read-only)
      ══════════════════════════════════════════════════════════════════ */}
      {showDetail && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="font-semibold text-white">Employee Profile</h2>
              <button
                onClick={() => setShowDetail(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Avatar + name */}
              <div className="flex items-center gap-4">
                <Avatar name={showDetail.name} />
                <div>
                  <p className="font-bold text-white text-lg">{showDetail.name}</p>
                  <StatusBadge status={showDetail.status} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 text-sm">
                {[
                  { icon: Hash,     label: "Employee Code", val: showDetail.employee_code },
                  { icon: Mail,     label: "Email",       val: showDetail.email },
                  { icon: Phone,    label: "Phone",       val: showDetail.phone },
                  { icon: User,     label: "Gender",      val: showDetail.gender ? (showDetail.gender.charAt(0).toUpperCase() + showDetail.gender.slice(1)) : null },
                  { icon: Building2,label: "Department",  val: showDetail.department?.name },
                  { icon: UserCheck,label: "Designation", val: showDetail.designation },
                  { icon: Calendar, label: "Joined",      val: showDetail.date_of_joining },
                  { icon: DollarSign,label:"Salary",      val: showDetail.salary > 0 ? `₹${showDetail.salary.toLocaleString("en-IN")} / month` : null },
                  { icon: MapPin,   label: "Address",     val: showDetail.address },
                ].map(({ icon: Icon, label, val }) =>

                  val ? (
                    <div key={label} className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon size={13} className="text-slate-400" />
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs">{label}</p>
                        <p className="text-slate-200">{val}</p>
                      </div>
                    </div>
                  ) : null
                )}
              </div>
            </div>

            <div className="flex gap-3 px-6 pb-6">
              {canEdit && (
                <button
                  onClick={() => { setShowDetail(null); openEdit(showDetail); }}
                  className="flex-1 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white
                    text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Pencil size={14} /> Edit
                </button>
              )}
              <button
                onClick={() => setShowDetail(null)}
                className="flex-1 py-2 rounded-xl border border-slate-700 text-slate-300
                  hover:bg-slate-800 text-sm transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          DELETE CONFIRMATION DIALOG
      ══════════════════════════════════════════════════════════════════ */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center">
            <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/20
              flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-rose-400" />
            </div>
            <h3 className="font-semibold text-white text-base mb-1">Delete Account Permanently?</h3>
            <p className="text-slate-400 text-sm mb-1">
              Are you sure you want to permanently delete <span className="text-white font-medium">{deleteTarget.name}</span>?
            </p>
            <p className="text-slate-500 text-xs mb-6">
              This will permanently delete all associated login credentials, attendance history, payroll slips, leave requests, and performance records. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300
                  hover:bg-slate-800 text-sm transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                id="confirm-delete-btn"
                onClick={handleDeleteEmployee}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white
                  text-sm font-semibold transition-colors disabled:opacity-60
                  flex items-center justify-center gap-2"
              >
                {deleting && <Loader2 size={14} className="animate-spin" />}
                {deleting ? "Deleting…" : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
