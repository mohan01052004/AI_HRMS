/**
 * pages/Login.jsx — Full login page with JWT auth (Redesigned with premium Glassmorphism & floating orbs)
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Eye, EyeOff, Building2, Loader2, AlertCircle, ArrowLeft } from "lucide-react";

const DEMO_USERS = [
  { label: "Admin", email: "admin@hrms.com", role: "management_admin", color: "from-violet-500 to-fuchsia-500" },
  { label: "Manager", email: "manager@hrms.com", role: "senior_manager", color: "from-blue-500 to-indigo-500" },
  { label: "HR", email: "hr@hrms.com", role: "hr_recruiter", color: "from-emerald-500 to-teal-500" },
  { label: "Employee", email: "emp@hrms.com", role: "employee", color: "from-amber-500 to-orange-500" },
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
  };  return (
    <div className="h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background drifting glow blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/15 rounded-full blur-[120px] animate-blob" />
        <div className="absolute bottom-1/4 right-1/4 w-[450px] h-[450px] bg-fuchsia-600/10 rounded-full blur-[140px] animate-blob-reverse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-blue-500/10 rounded-full blur-[100px] animate-pulse-slow" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        {/* Logo and Header */}
        <div className="text-center mb-5">
          <div className="relative inline-flex mb-2">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-600 to-fuchsia-600 rounded-2xl blur-md opacity-50 animate-pulse-slow" />
            <div className="relative inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-900 border border-white/10 text-white">
              <Building2 size={22} className="text-violet-400" />
            </div>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight text-glow-violet font-display">
            AI-<span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-fuchsia-400">HRMS</span>
          </h1>
          <p className="text-slate-400 text-[10px] mt-1 font-medium tracking-wide uppercase">
            The Future of Intelligent Workplaces
          </p>
        </div>

        {/* Glassmorphic Login Card */}
        <div className="glass-card rounded-3xl p-6 border border-white/10 shadow-2xl relative overflow-hidden">
          {/* Subtle card glow overlay */}
          <div className="absolute -top-32 -right-32 w-64 h-64 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />

          <h2 className="text-xl font-bold text-white font-display">Welcome back</h2>
          <p className="text-slate-400 text-[11px] mt-0.5 mb-4">Sign in to access your dashboard</p>

          {/* Error Banner */}
          {error && (
            <div className="flex items-start gap-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl px-4 py-2.5 mb-4 text-xs">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Email Input */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-300 mb-1 uppercase tracking-wider">
                Email Address
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
                className="w-full glass-input rounded-xl px-4 py-2 text-white placeholder-slate-500 text-xs"
              />
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-300 mb-1 uppercase tracking-wider">
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
                  className="w-full glass-input rounded-xl px-4 py-2 pr-11 text-white placeholder-slate-500 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Sign In Button */}
            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500
                hover:to-fuchsia-500 text-white font-semibold py-2 rounded-xl transition-all duration-300
                disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2
                shadow-lg shadow-violet-500/25 mt-4 hover:shadow-violet-500/35 hover:scale-[1.01] text-xs"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Authenticating...
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Quick Demo Logins Section */}
          <div className="mt-5">
            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-white/5"></div>
              <span className="flex-shrink mx-4 text-[9px] text-slate-500 font-semibold uppercase tracking-wider">
                Quick Demo Accounts
              </span>
              <div className="flex-grow border-t border-white/5"></div>
            </div>

            <div className="flex flex-wrap gap-2 justify-center mt-3">
              {DEMO_USERS.map((u) => (
                <button
                  key={u.label}
                  id={`demo-${u.label.toLowerCase()}`}
                  onClick={() => fillDemo(u.email)}
                  className="px-3 py-1.5 rounded-lg bg-slate-950/45 border border-white/5 text-[11px] font-semibold
                    text-slate-200 hover:border-violet-500/30 hover:bg-slate-900/60 transition-all duration-200 flex items-center gap-1.5"
                >
                  <span className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${u.color}`} />
                  <span>{u.label}</span>
                </button>
              ))}
            </div>

            <div className="text-center mt-3 text-[9px] text-slate-500 font-medium">
              Demo passwords: <span className="text-violet-400 font-mono">HrMs@2026!Sec</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 mt-4">
          <button
            onClick={() => navigate("/")}
            className="text-[11px] font-semibold text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft size={12} />
            Back to Home
          </button>
          
          <p className="text-center text-[9px] text-slate-600 tracking-wide">
            Secured with JWT and Cryptographic Hashing · Version 2.0
          </p>
        </div>
      </div>
    </div>
  );
}
