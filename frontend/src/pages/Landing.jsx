/**
 * pages/Landing.jsx — High-end, premium landing page for AI-HRMS
 * Features: Drifting glow blobs, glassmorphic navigation/cards,
 * responsive design, smooth hover micro-animations, and a developer quick-sandbox.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Building2,
  Bot,
  Calendar,
  BarChart3,
  CreditCard,
  Users,
  ArrowRight,
  Shield,
  Zap,
  Sparkles,
  Loader2,
  AlertCircle
} from "lucide-react";

const FEATURES = [
  {
    icon: Bot,
    title: "AI Chatbot Assistant",
    description: "Get instant answers regarding company policies, leave rules, and personalized stats from our integrated LLM agent.",
    color: "from-violet-500 to-fuchsia-500",
  },
  {
    icon: Calendar,
    title: "Smart Attendance",
    description: "One-click attendance tracking with real-time logs, shift monitoring, and automated clock-in/out auditing.",
    color: "from-blue-500 to-indigo-500",
  },
  {
    icon: BarChart3,
    title: "Real-Time Analytics",
    description: "Interactive analytics dashboards with performance tracking, team distribution, and core organizational KPIs.",
    color: "from-emerald-500 to-teal-500",
  },
  {
    icon: CreditCard,
    title: "Leave & Payroll Management",
    description: "Effortlessly request time-off, calculate bonuses/taxes, generate custom payslips, and review monthly reports.",
    color: "from-amber-500 to-orange-500",
  },
  {
    icon: Users,
    title: "Automated Recruitment",
    description: "Track resumes, manage job openings, schedule interviews, and organize onboarding checklists automatically.",
    color: "from-pink-500 to-rose-500",
  },
  {
    icon: Shield,
    title: "Cryptographic Security",
    description: "Secure workspace powered by robust JWT tokens, role-based route protection, and cryptographic hashing.",
    color: "from-cyan-500 to-blue-500",
  },
];

const QUICK_DEMO_USERS = [
  { label: "Admin Portal", email: "admin@hrms.com", role: "management_admin", desc: "Full organization cockpit", color: "from-violet-500 to-fuchsia-500" },
  { label: "Manager Portal", email: "manager@hrms.com", role: "senior_manager", desc: "Team & approval hub", color: "from-blue-500 to-indigo-500" },
  { label: "HR Recruiter", email: "hr@hrms.com", role: "hr_recruiter", desc: "Hiring & onboarding desk", color: "from-emerald-500 to-teal-500" },
  { label: "Employee View", email: "emp@hrms.com", role: "employee", desc: "Personal logs & leave desk", color: "from-amber-500 to-orange-500" },
];

export default function Landing() {
  const { user, token, login } = useAuth();
  const navigate = useNavigate();
  const [loadingRole, setLoadingRole] = useState(null);
  const [error, setError] = useState("");

  const handleQuickLogin = async (email, label) => {
    setLoadingRole(label);
    setError("");
    try {
      await login(email, "HrMs@2026!Sec");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.detail || `Failed to log in as ${label}. Please try standard login.`
      );
    } finally {
      setLoadingRole(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white relative overflow-hidden font-sans flex flex-col">
      {/* Background drifting glow blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[140px] animate-blob" />
        <div className="absolute bottom-10 right-10 w-[600px] h-[600px] bg-fuchsia-600/10 rounded-full blur-[160px] animate-blob-reverse" />
        <div className="absolute top-1/2 left-1/3 w-96 h-96 bg-blue-500/5 rounded-full blur-[120px] animate-pulse-slow" />
      </div>

      {/* Navbar */}
      <header className="sticky top-0 z-50 glass-panel border-b border-white/5 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate("/")}>
            <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-slate-900 border border-white/10 shadow-lg">
              <Building2 size={18} className="text-violet-400" />
            </div>
            <span className="text-lg font-extrabold tracking-tight font-display text-glow-violet">
              AI-<span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-fuchsia-400">HRMS</span>
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-slate-300">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#sandbox" className="hover:text-white transition-colors">Developer Sandbox</a>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Documentation</a>
          </nav>

          <div className="flex items-center gap-4">
            {token && user ? (
              <button
                onClick={() => navigate("/dashboard")}
                className="glass-card px-4 py-1.5 rounded-xl text-xs font-semibold hover:border-violet-500/40 hover:bg-slate-900 transition-all duration-300 text-violet-300 flex items-center gap-1.5"
              >
                <span>Dashboard</span>
                <ArrowRight size={12} />
              </button>
            ) : (
              <button
                onClick={() => navigate("/login")}
                className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-semibold px-4 py-1.5 rounded-xl transition-all duration-300 text-xs shadow-lg shadow-violet-500/20 hover:shadow-violet-500/35 hover:scale-[1.02]"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Hero Section */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-6 py-16 md:py-24 relative z-10 flex flex-col justify-center">
        <div className="text-center max-w-3xl mx-auto mb-16 md:mb-20 animate-fade-in">
          <div className="inline-flex items-center gap-1.5 bg-violet-500/10 border border-violet-500/20 rounded-full px-3 py-1 text-violet-300 text-[10px] font-bold uppercase tracking-wider mb-6 animate-pulse-slow">
            <Sparkles size={11} />
            <span>Next-Gen Enterprise Orchestration</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight font-display mb-6 leading-tight">
            The Intelligent Hub for{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-fuchsia-400 to-blue-400">
              Modern Workforces
            </span>
          </h1>

          <p className="text-slate-400 text-sm md:text-base leading-relaxed mb-8 max-w-2xl mx-auto">
            Leverage built-in LLM diagnostics, cryptographically secured attendance, real-time leaves, payroll processing, and hiring pipelines inside a single, unified workspace.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {token && user ? (
              <button
                onClick={() => navigate("/dashboard")}
                className="w-full sm:w-auto bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-semibold px-8 py-3 rounded-2xl transition-all duration-300 text-xs shadow-xl shadow-violet-500/20 hover:scale-[1.01] flex items-center justify-center gap-2"
              >
                Go to Dashboard <ArrowRight size={14} />
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate("/login")}
                  className="w-full sm:w-auto bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-semibold px-8 py-3 rounded-2xl transition-all duration-300 text-xs shadow-xl shadow-violet-500/20 hover:scale-[1.01] flex items-center justify-center gap-2"
                >
                  Launch App Portal <Zap size={14} className="text-amber-300 fill-amber-300" />
                </button>
                <a
                  href="#sandbox"
                  className="w-full sm:w-auto glass-card border border-white/10 hover:border-white/20 px-8 py-3 rounded-2xl text-xs font-semibold text-slate-300 hover:text-white transition-all duration-300 flex items-center justify-center"
                >
                  Quick Sandbox Demo
                </a>
              </>
            )}
          </div>
        </div>

        {/* Features Section */}
        <section id="features" className="py-12 border-t border-white/5 scroll-mt-20">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold font-display">Core Platform Features</h2>
            <p className="text-slate-400 text-xs mt-1">Fully integrated modules powered by standard enterprise workflows</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feat) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.title}
                  className="glass-card glass-card-hover rounded-3xl p-6 border border-white/5 flex flex-col gap-4 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-violet-600/5 rounded-full blur-2xl pointer-events-none" />
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${feat.color} p-0.5 flex items-center justify-center shadow-lg`}>
                    <div className="w-full h-full rounded-[10px] bg-slate-950 flex items-center justify-center">
                      <Icon size={18} className="text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white font-display mb-1.5">{feat.title}</h3>
                    <p className="text-slate-400 text-xs leading-relaxed">{feat.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Developer Sandbox Section */}
        {!token && (
          <section id="sandbox" className="py-12 border-t border-white/5 mt-12 scroll-mt-20">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 rounded-full px-2.5 py-0.5 text-amber-400 text-[9px] font-bold uppercase tracking-wider mb-2">
                Testing Tools
              </div>
              <h2 className="text-2xl font-bold font-display">Developer Sandbox</h2>
              <p className="text-slate-400 text-xs mt-1">Bypass credential entry and authenticate instantly into any demo persona</p>
            </div>

            {error && (
              <div className="max-w-md mx-auto flex items-start gap-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl px-4 py-3 mb-6 text-xs animate-fade-in">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
              {QUICK_DEMO_USERS.map((demo) => (
                <button
                  key={demo.label}
                  disabled={loadingRole !== null}
                  onClick={() => handleQuickLogin(demo.email, demo.label)}
                  className="glass-card glass-card-hover rounded-2xl p-5 border border-white/5 text-left transition-all duration-300 hover:border-violet-500/30 flex flex-col justify-between h-32 relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="absolute top-0 right-0 w-16 h-16 bg-violet-600/5 rounded-full blur-xl pointer-events-none" />
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold font-display group-hover:text-violet-300 transition-colors">{demo.label}</span>
                    <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${demo.color} shadow-lg`} />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-0.5">{demo.desc}</p>
                    <p className="text-[11px] text-slate-400 truncate">{demo.email}</p>
                  </div>
                  {loadingRole === demo.label && (
                    <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin text-violet-400" />
                      <span className="text-[10px] font-semibold text-slate-300">Logging in...</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-white/5 bg-slate-950/50 mt-auto">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-slate-500 text-[10px] font-medium tracking-wide">
          <div className="flex items-center gap-2">
            <Building2 size={12} />
            <span>© 2026 AI-HRMS Operations. All rights reserved.</span>
          </div>
          <div className="flex gap-6">
            <a href="#features" className="hover:text-slate-300 transition-colors">Privacy Policy</a>
            <a href="#features" className="hover:text-slate-300 transition-colors">Terms of Service</a>
            <a href="#sandbox" className="hover:text-slate-300 transition-colors">Contact Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
