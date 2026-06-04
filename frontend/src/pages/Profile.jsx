/**
 * pages/Profile.jsx — View and edit personal profile
 */
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import {
  User, Mail, Phone, Building2, Briefcase,
  CalendarDays, Save, Loader2, CheckCircle2, Edit2,
} from "lucide-react";

const ROLE_LABEL = {
  management_admin: "Management Admin",
  senior_manager:   "Senior Manager",
  hr_recruiter:     "HR Recruiter",
  employee:         "Employee",
};

const ROLE_COLOR = {
  management_admin: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  senior_manager:   "bg-sky-500/10 text-sky-400 border-sky-500/20",
  hr_recruiter:     "bg-teal-500/10 text-teal-400 border-teal-500/20",
  employee:         "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

function Field({ label, icon: Icon, value }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
        <Icon size={11} />
        {label}
      </label>
      <p className="text-sm text-white bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2.5">
        {value || <span className="text-slate-600">Not set</span>}
      </p>
    </div>
  );
}

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const [empData, setEmpData]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [form, setForm]         = useState({ phone: "", address: "" });

  useEffect(() => {
    const load = async () => {
      try {
        // Fetch full employee profile via /employees (filtered by user)
        const me = await api.get("/auth/me");
        // Try to get employee record
        const empRes = await api.get("/employees").catch(() => ({ data: { items: [] } }));
        const list = Array.isArray(empRes.data) ? empRes.data : (empRes.data?.items || []);
        const myEmp = list.find((e) => e.user_id === me.data.id || e.email === me.data.email);
        setEmpData(myEmp || null);

        setForm({
          phone:   myEmp?.phone   || "",
          address: myEmp?.address || "",
        });
      } catch {
        setEmpData(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!empData?.id) return;
    setSaving(true);
    try {
      await api.patch(`/employees/${empData.id}`, form);
      setEmpData((prev) => ({ ...prev, ...form }));
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const initials = user?.name
    ?.split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="p-6 h-full overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">My Profile</h2>
          <p className="text-slate-400 text-sm">View and update your personal information</p>
        </div>
        {saved && (
          <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium animate-pulse">
            <CheckCircle2 size={16} />
            Profile saved!
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={28} className="text-violet-400 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Avatar Card */}
          <div className="lg:col-span-1">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center gap-4 text-center">
              {/* Avatar */}
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600
                flex items-center justify-center shadow-lg shadow-violet-500/20">
                <span className="text-3xl font-bold text-white">{initials}</span>
              </div>

              <div>
                <h3 className="text-white font-semibold text-lg">{user?.name}</h3>
                <p className="text-slate-400 text-sm">{user?.email}</p>
                <span className={`inline-block mt-2 text-xs px-3 py-1 rounded-full font-medium border capitalize ${ROLE_COLOR[user?.role]}`}>
                  {ROLE_LABEL[user?.role] || user?.role}
                </span>
              </div>

              {/* Quick info */}
              {empData && (
                <div className="w-full pt-4 border-t border-slate-800 space-y-2 text-left">
                  {empData.department?.name && (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Building2 size={12} className="text-violet-400 shrink-0" />
                      <span>{empData.department.name}</span>
                    </div>
                  )}

                  {empData.designation && (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Briefcase size={12} className="text-violet-400 shrink-0" />
                      <span>{empData.designation}</span>
                    </div>
                  )}
                  {empData.date_of_joining && (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <CalendarDays size={12} className="text-violet-400 shrink-0" />
                      <span>Joined {new Date(empData.date_of_joining).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Details Card */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-white">Personal Information</h4>
                {!editing ? (
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300
                      bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 px-3 py-1.5 rounded-lg transition-all"
                  >
                    <Edit2 size={12} />
                    Edit
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditing(false)}
                      className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg
                        border border-slate-700 hover:bg-slate-800 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-1.5 text-xs text-white bg-violet-600 hover:bg-violet-500
                        disabled:opacity-60 px-3 py-1.5 rounded-lg transition-all"
                    >
                      {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                      Save
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Read-only fields */}
                <Field label="Full Name"   icon={User}         value={user?.name} />
                <Field label="Email"       icon={Mail}         value={user?.email} />
                <Field label="Department"  icon={Building2}    value={empData?.department?.name || "—"} />

                <Field label="Designation" icon={Briefcase}    value={empData?.designation || "—"} />
                <Field label="Gender"      icon={User}         value={empData?.gender ? (empData.gender.charAt(0).toUpperCase() + empData.gender.slice(1)) : "—"} />


                {/* Editable: Phone */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                    <Phone size={11} /> Phone
                  </label>
                  {editing ? (
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="+91 98765 43210"
                      className="w-full text-sm text-white bg-slate-800 border border-violet-500/50 rounded-xl
                        px-3 py-2.5 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30"
                    />
                  ) : (
                    <p className="text-sm text-white bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2.5">
                      {form.phone || <span className="text-slate-600">Not set</span>}
                    </p>
                  )}
                </div>

                {/* Date of joining */}
                <Field
                  label="Date of Joining"
                  icon={CalendarDays}
                  value={empData?.date_of_joining
                    ? new Date(empData.date_of_joining).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
                    : "—"}
                />
              </div>

              {/* Editable: Address */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500">Address</label>
                {editing ? (
                  <textarea
                    rows={2}
                    value={form.address}
                    onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                    placeholder="House No., Street, City, State"
                    className="w-full text-sm text-white bg-slate-800 border border-violet-500/50 rounded-xl
                      px-3 py-2.5 resize-none focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30"
                  />
                ) : (
                  <p className="text-sm text-white bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2.5 min-h-[44px]">
                    {form.address || <span className="text-slate-600">Not set</span>}
                  </p>
                )}
              </div>
            </div>

            {/* Account info card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
              <h4 className="text-sm font-semibold text-white">Account Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/40">
                  <p className="text-[11px] text-slate-500">Account Status</p>
                  <p className="text-sm font-semibold text-emerald-400 mt-0.5">● Active</p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/40">
                  <p className="text-[11px] text-slate-500">User ID</p>
                  <p className="text-sm font-semibold text-white mt-0.5">#{user?.id || "—"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
