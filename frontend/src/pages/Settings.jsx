/**
 * pages/Settings.jsx — App settings: change password, notification preferences, appearance
 */
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import toast from "react-hot-toast";
import {
  Lock, Bell, Eye, EyeOff, Save, Loader2,
  ShieldCheck, Palette, ToggleLeft, ToggleRight,
} from "lucide-react";

function SettingsSection({ title, icon: Icon, children }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
        <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
          <Icon size={15} className="text-violet-400" />
        </div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Toggle({ label, sub, enabled, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm text-slate-200 font-medium">{label}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={`shrink-0 transition-colors ${enabled ? "text-violet-400" : "text-slate-600"}`}
      >
        {enabled
          ? <ToggleRight size={32} className="text-violet-500" />
          : <ToggleLeft  size={32} className="text-slate-600" />}
      </button>
    </div>
  );
}

function PasswordField({ label, field, pwForm, setPwForm, showPw, togglePwVis }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-500">{label}</label>
      <div className="relative">
        <input
          type={showPw[field] ? "text" : "password"}
          value={pwForm[field]}
          onChange={(e) => setPwForm((p) => ({ ...p, [field]: e.target.value }))}
          placeholder="••••••••"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 pr-10 text-sm text-white
            placeholder-slate-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30"
        />
        <button
          type="button"
          onClick={() => togglePwVis(field)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
        >
          {showPw[field] ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  );
}

export default function Settings() {
  const { user } = useAuth();

  // ── Change Password state ─────────────────────────────────────────────────
  const [pwForm, setPwForm]   = useState({ current: "", newPw: "", confirm: "" });
  const [showPw, setShowPw]   = useState({ current: false, newPw: false, confirm: false });
  const [savingPw, setSavingPw] = useState(false);

  // ── Notification prefs ────────────────────────────────────────────────────
  const [notifPrefs, setNotifPrefs] = useState({
    leaveUpdates:   true,
    payrollReady:   true,
    goalReminders:  true,
    teamAlerts:     false,
  });

  // ── Appearance ────────────────────────────────────────────────────────────
  const [compact, setCompact] = useState(false);

  const togglePwVis = (field) =>
    setShowPw((p) => ({ ...p, [field]: !p[field] }));

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (pwForm.newPw !== pwForm.confirm) {
      toast.error("New passwords do not match.");
      return;
    }
    if (pwForm.newPw.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setSavingPw(true);
    try {
      await api.post("/auth/change-password", {
        email:            user.email,
        current_password: pwForm.current,
        new_password:     pwForm.newPw,
      });
      toast.success("Password changed successfully!");
      setPwForm({ current: "", newPw: "", confirm: "" });
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to change password.");
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div className="p-6 h-full overflow-y-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-white">Settings</h2>
        <p className="text-slate-400 text-sm">Manage your account security and preferences</p>
      </div>

      {/* ── Change Password ─────────────────────────────────────────────── */}
      <SettingsSection title="Change Password" icon={Lock}>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <PasswordField
            label="Current Password"
            field="current"
            pwForm={pwForm}
            setPwForm={setPwForm}
            showPw={showPw}
            togglePwVis={togglePwVis}
          />
          <PasswordField
            label="New Password"
            field="newPw"
            pwForm={pwForm}
            setPwForm={setPwForm}
            showPw={showPw}
            togglePwVis={togglePwVis}
          />
          <PasswordField
            label="Confirm New Password"
            field="confirm"
            pwForm={pwForm}
            setPwForm={setPwForm}
            showPw={showPw}
            togglePwVis={togglePwVis}
          />

          {/* Password strength hint */}
          {pwForm.newPw.length > 0 && (
            <div className="space-y-1">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((level) => {
                  const strength = Math.min(Math.floor(pwForm.newPw.length / 3), 4);
                  return (
                    <div
                      key={level}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        level <= strength
                          ? strength <= 1 ? "bg-rose-500"
                            : strength <= 2 ? "bg-amber-500"
                            : strength <= 3 ? "bg-sky-500"
                            : "bg-emerald-500"
                          : "bg-slate-700"
                      }`}
                    />
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-500">
                {pwForm.newPw.length < 6 ? "Weak" : pwForm.newPw.length < 9 ? "Moderate" : pwForm.newPw.length < 12 ? "Strong" : "Very strong"} password
              </p>
            </div>
          )}



          <button
            type="submit"
            disabled={savingPw || !pwForm.current || !pwForm.newPw || !pwForm.confirm}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500
              disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium
              rounded-xl transition-all"
          >
            {savingPw ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Update Password
          </button>
        </form>
      </SettingsSection>

      {/* ── Notification Preferences ────────────────────────────────────── */}
      <SettingsSection title="Notification Preferences" icon={Bell}>
        <div className="space-y-4 divide-y divide-slate-800">
          <Toggle
            label="Leave Status Updates"
            sub="Get notified when your leave request is approved or rejected"
            enabled={notifPrefs.leaveUpdates}
            onChange={(v) => setNotifPrefs((p) => ({ ...p, leaveUpdates: v }))}
          />
          <div className="pt-4">
            <Toggle
              label="Payroll Ready"
              sub="Be notified when your monthly payslip is generated"
              enabled={notifPrefs.payrollReady}
              onChange={(v) => setNotifPrefs((p) => ({ ...p, payrollReady: v }))}
            />
          </div>
          <div className="pt-4">
            <Toggle
              label="Goal Reminders"
              sub="Reminders for upcoming goal target dates"
              enabled={notifPrefs.goalReminders}
              onChange={(v) => setNotifPrefs((p) => ({ ...p, goalReminders: v }))}
            />
          </div>
          <div className="pt-4">
            <Toggle
              label="Team Alerts"
              sub="Alerts about your team's attendance and leave (managers only)"
              enabled={notifPrefs.teamAlerts}
              onChange={(v) => setNotifPrefs((p) => ({ ...p, teamAlerts: v }))}
            />
          </div>
        </div>
        <p className="text-[11px] text-slate-600 pt-2">
          Notification settings are saved locally in your browser session.
        </p>
      </SettingsSection>

      {/* ── Appearance ──────────────────────────────────────────────────── */}
      <SettingsSection title="Appearance" icon={Palette}>
        <div className="space-y-4">
          <Toggle
            label="Compact Mode"
            sub="Reduce padding and font sizes for a denser layout"
            enabled={compact}
            onChange={setCompact}
          />

          {/* Theme swatches — the app is dark-only but shows the active selection */}
          <div>
            <p className="text-xs text-slate-500 mb-3 font-medium">Color Accent</p>
            <div className="flex gap-2">
              {[
                { name: "Violet",  cls: "bg-violet-500" },
                { name: "Indigo",  cls: "bg-indigo-500" },
                { name: "Sky",     cls: "bg-sky-500" },
                { name: "Teal",    cls: "bg-teal-500" },
                { name: "Rose",    cls: "bg-rose-500" },
              ].map(({ name, cls }, i) => (
                <button
                  key={name}
                  title={name}
                  className={`w-8 h-8 rounded-full ${cls} transition-transform hover:scale-110 ${i === 0 ? "ring-2 ring-offset-2 ring-offset-slate-900 ring-violet-500" : ""}`}
                />
              ))}
            </div>
            <p className="text-[11px] text-slate-600 mt-2">Accent color (UI preview — full theming coming soon)</p>
          </div>
        </div>
      </SettingsSection>

      {/* ── Account Info ─────────────────────────────────────────────────── */}
      <SettingsSection title="Account & Security" icon={ShieldCheck}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: "Registered Email", value: user?.email },
            { label: "Account Role",     value: user?.role?.replace(/_/g, " ") },
            { label: "Account Status",   value: "Active" },
            { label: "2FA",              value: "Not configured" },
          ].map(({ label, value }) => (
            <div key={label} className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-3">
              <p className="text-[11px] text-slate-500">{label}</p>
              <p className="text-sm text-white font-medium mt-0.5 capitalize">{value}</p>
            </div>
          ))}
        </div>
      </SettingsSection>
    </div>
  );
}
