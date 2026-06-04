/**
 * pages/NotFound.jsx — Premium 404 page with animated elements
 */
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Home, ArrowLeft, Building2, Search } from "lucide-react";

export default function NotFound() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-rose-600/5 rounded-full blur-2xl" />
      </div>

      {/* Floating grid lines */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "linear-gradient(#7c3aed 1px, transparent 1px), linear-gradient(90deg, #7c3aed 1px, transparent 1px)",
        backgroundSize: "60px 60px"
      }} />

      <div className="relative text-center max-w-lg">
        {/* Logo */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 mb-6 shadow-lg shadow-violet-500/30">
          <Building2 size={30} className="text-white" />
        </div>

        {/* 404 number */}
        <div className="relative mb-4">
          <h1 className="text-[8rem] font-black leading-none bg-gradient-to-br from-violet-400 via-indigo-400 to-slate-600 bg-clip-text text-transparent select-none">
            404
          </h1>
          {/* Glow behind the number */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-64 h-32 bg-violet-600/10 blur-3xl rounded-full" />
          </div>
        </div>

        {/* Error message */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 mb-6 shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-2">Page Not Found</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            The page you're looking for doesn't exist or you don't have permission to access it.
            {user && " You're logged in — the page may have been moved or the URL is incorrect."}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300
              hover:border-slate-600 hover:text-white transition-all text-sm font-medium"
          >
            <ArrowLeft size={16} />
            Go Back
          </button>

          {user ? (
            <button
              onClick={() => navigate("/dashboard")}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl
                bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500
                text-white text-sm font-semibold transition-all shadow-lg shadow-violet-500/20"
            >
              <Home size={16} />
              Dashboard
            </button>
          ) : (
            <button
              onClick={() => navigate("/login")}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl
                bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500
                text-white text-sm font-semibold transition-all shadow-lg shadow-violet-500/20"
            >
              <Home size={16} />
              Sign In
            </button>
          )}
        </div>

        {/* Quick links */}
        {user && (
          <div className="mt-6">
            <p className="text-xs text-slate-600 mb-3">Quick navigation</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {[
                { label: "Dashboard", path: "/dashboard" },
                { label: "Attendance", path: "/attendance" },
                { label: "Leave", path: "/leave" },
                { label: "Profile", path: "/profile" },
              ].map(({ label, path }) => (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-400 border border-slate-800
                    hover:border-violet-500/50 hover:text-violet-400 transition-all"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="text-slate-700 text-xs mt-8">AI-HRMS · Error 404</p>
      </div>
    </div>
  );
}
