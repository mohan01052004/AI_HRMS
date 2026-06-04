/**
 * pages/Login.jsx — Full login page with JWT auth
 */
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Eye, EyeOff, Building2, Loader2, AlertCircle } from "lucide-react";

const DEMO_USERS = [
  { label: "Admin", email: "admin@hrms.com", role: "management_admin" },
  { label: "Manager", email: "manager@hrms.com", role: "senior_manager" },
  { label: "HR", email: "hr@hrms.com", role: "hr_recruiter" },
  { label: "Employee", email: "emp@hrms.com", role: "employee" },
];

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { login, token, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (token && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [token, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await login(email, password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.detail || "Login failed. Check your credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (demoEmail) => {
    setEmail(demoEmail);
    setPassword("HrMs@2026!Sec");
    setError("");
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-violet-500/10 rounded-full blur-2xl" />
      </div>

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 mb-4 shadow-lg shadow-violet-500/30">
            <Building2 size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">AI-HRMS</h1>
          <p className="text-slate-400 text-sm mt-1">
            AI-Powered Human Resource Management
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-1">Welcome back</h2>
          <p className="text-slate-400 text-sm mb-6">Sign in to your account</p>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl px-4 py-3 mb-5 text-sm">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white
                  placeholder-slate-500 text-sm focus:outline-none focus:border-violet-500 focus:ring-1
                  focus:ring-violet-500/30 transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 pr-11 text-white
                    placeholder-slate-500 text-sm focus:outline-none focus:border-violet-500 focus:ring-1
                    focus:ring-violet-500/30 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500
                hover:to-indigo-500 text-white font-semibold py-2.5 rounded-xl transition-all
                disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2
                shadow-lg shadow-violet-500/20 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          {/* Demo users */}
          <div className="mt-6">
            <p className="text-xs text-slate-500 text-center mb-3">
              — Quick Demo Login —
            </p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_USERS.map((u) => (
                <button
                  key={u.label}
                  id={`demo-${u.label.toLowerCase()}`}
                  onClick={() => fillDemo(u.email)}
                  className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs
                    text-slate-300 hover:border-violet-500 hover:text-violet-400 transition-all text-left"
                >
                  <div className="font-medium">{u.label}</div>
                  <div className="text-slate-500 truncate">{u.email}</div>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-600 text-center mt-2">
              All demo passwords: <span className="text-slate-500 font-mono">HrMs@2026!Sec</span>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-600 mt-4">
          Secured with JWT · Built for Hackathon 2026
        </p>
      </div>
    </div>
  );
}
