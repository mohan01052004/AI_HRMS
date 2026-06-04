import { useState, useEffect, useCallback } from "react";
import { jsPDF } from "jspdf";
import {
  Calendar, DollarSign, Download, Loader2, AlertCircle, FileText,
  User, Building, RefreshCw, Wallet, LayoutGrid, AlertTriangle
} from "lucide-react";
import api from "../api/axios.js";
import { useAuth } from "../context/AuthContext.jsx";

const MONTHS = [
  "",
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const MONTH_ABBR = [
  "",
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

// ─── Local Toast Component ──────────────────────────────────────────────────
function Toast({ msg, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border border-emerald-500/40 bg-slate-900/90 text-emerald-400 backdrop-blur-sm shadow-2xl text-sm font-semibold max-w-sm animate-in">
      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      <span>{msg}</span>
      <button onClick={onClose} className="ml-auto text-slate-400 hover:text-white text-xs pl-2">✕</button>
    </div>
  );
}

export default function Payroll() {
  const { user } = useAuth();

  const canViewRoster =
    user?.role === "management_admin" ||
    user?.role === "hr_recruiter";

  const canGeneratePayroll =
    user?.role === "management_admin";

  // State Management
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [successToast, setSuccessToast] = useState("");

  // Data states
  const [payslips, setPayslips] = useState([]);
  const [summary, setSummary] = useState({ total_gross: 0, total_net: 0 });

  // Period filters (for Admin/Manager view)
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // ─── API calls ─────────────────────────────────────────────────────────────

  // Fetch employee own payslips
  const fetchEmployeePayslips = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/payroll/my");
      setPayslips(res.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to retrieve payslip records.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch admin period payslips + monthly summary
  const fetchAdminPayslips = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/payroll/all", {
        params: { month: selectedMonth, year: selectedYear }
      });
      setPayslips(res.data.payslips || []);
      setSummary(res.data.summary || { total_gross: 0, total_net: 0 });
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load period payroll details.");
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  // Initial and reactive data loads
  useEffect(() => {
    if (canViewRoster) {
      fetchAdminPayslips();
    } else {
      fetchEmployeePayslips();
    }
  }, [canViewRoster, fetchAdminPayslips, fetchEmployeePayslips]);

  // Trigger Bulk Payroll Generation
  const handleGeneratePayroll = async () => {
    setGenerating(true);
    setError("");
    try {
      const res = await api.post("/payroll/generate", {
        month: selectedMonth,
        year: selectedYear
      });
      const { generated, skipped } = res.data;
      setSuccessToast(`Payroll run complete: ${generated} generated, ${skipped} skipped.`);
      fetchAdminPayslips();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to process bulk payroll generation.");
    } finally {
      setGenerating(false);
    }
  };

  // ─── PDF Exporter ──────────────────────────────────────────────────────────
  const downloadPayslipPdf = (ps) => {
    const doc = new jsPDF();

    // Color theme block (Violet header)
    doc.setFillColor(124, 58, 237);
    doc.rect(0, 0, 210, 35, "F");

    // Header text
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("FWC IT Services", 15, 16);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Corporate Payroll Disbursal Statement", 15, 22);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`PAYSLIP STATEMENT — ${MONTHS[ps.month]} ${ps.year}`, 15, 30);

    // Metadata Card
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("EMPLOYEE DETAILS", 15, 48);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(`Employee Name: ${user?.name || "HRMS Staff Member"}`, 15, 56);
    doc.text(`Employee ID Reference: ${ps.employee_id}`, 15, 63);
    doc.text(`Department: staff_level_employee`, 15, 70);

    doc.text(`Pay Statement Period: ${MONTHS[ps.month]} ${ps.year}`, 120, 56);
    doc.text(`Disbursed On: ${new Date(ps.generated_at).toLocaleDateString("en-IN")}`, 120, 63);
    doc.text(`Statement Status: Paid`, 120, 70);

    // Line Divider
    doc.setDrawColor(226, 232, 240);
    doc.line(15, 78, 195, 78);

    // Earnings table
    doc.setFillColor(248, 250, 252);
    doc.rect(15, 84, 180, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.text("Compensation Breakdown Component", 18, 89.5);
    doc.text("Amount (INR)", 188, 89.5, { align: "right" });

    // Components on-the-fly math
    const basic = ps.gross * 0.50;
    const allowances = ps.gross - basic;

    doc.setFont("helvetica", "normal");
    let y = 99;
    doc.text("Basic Salary (50% base):", 18, y);
    doc.text(`₹${basic.toLocaleString("en-IN")}`, 188, y, { align: "right" });
    y += 8;
    doc.text("Allowances / Perks:", 18, y);
    doc.text(`₹${allowances.toLocaleString("en-IN")}`, 188, y, { align: "right" });

    y += 5;
    doc.setDrawColor(241, 245, 249);
    doc.line(15, y, 195, y);
    y += 7;

    doc.setFont("helvetica", "bold");
    doc.text("Gross Earnings:", 18, y);
    doc.text(`₹${ps.gross.toLocaleString("en-IN")}`, 188, y, { align: "right" });

    y += 9;
    doc.setFont("helvetica", "normal");
    doc.text("Payroll Deductions (PF / Taxes):", 18, y);
    doc.text(`₹${ps.deductions.toLocaleString("en-IN")}`, 188, y, { align: "right" });

    y += 7;
    doc.setDrawColor(226, 232, 240);
    doc.line(15, y, 195, y);

    // Final Net Pay Box
    y += 5;
    doc.setFillColor(124, 58, 237);
    doc.rect(15, y, 180, 14, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("NET PAY statement take-home:", 22, y + 9);
    doc.text(`₹${ps.net.toLocaleString("en-IN")}`, 188, y + 9, { align: "right" });

    // footer details
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text("This is an electronically generated statement and requires no physical seal or signature.", 105, 270, { align: "center" });
    doc.text("For help regarding this file, contact accounts@fwc-it-services.com.", 105, 276, { align: "center" });
    doc.text("FWC IT Services © 2026", 105, 282, { align: "center" });

    doc.save(`FWC_Payslip_${MONTH_ABBR[ps.month]}_${ps.year}.pdf`);
  };

  return (
    <div className="p-6 h-full overflow-y-auto space-y-6 bg-slate-950 text-white">
      {/* Toast Alert */}
      {successToast && (
        <Toast msg={successToast} onClose={() => setSuccessToast("")} />
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-900 pb-5">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <DollarSign size={20} className="text-violet-500" />
            Payroll Statements
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {canViewRoster ? (canGeneratePayroll ? "Review corporate disbursal list and run monthly payrolls" : "Review corporate disbursal list and statements") : "Access, review, and download your monthly salary statements"}
          </p>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main View rendering switcher */}
      {canViewRoster ? (
        // ─── ADMIN / MANAGER DASHBOARD VIEW ───
        <div className="space-y-6">
          {/* Top Period Selectors & Controls */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
                <Calendar size={15} className="text-slate-500" />
                <select
                  id="admin-month-select"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                  className="bg-transparent text-sm text-white font-medium focus:outline-none"
                >
                  {MONTHS.slice(1).map((m, i) => (
                    <option key={i + 1} value={i + 1} className="bg-slate-900">{m}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
                <span className="text-slate-500 text-xs uppercase font-bold">Year</span>
                <input
                  id="admin-year-input"
                  type="number"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                  className="bg-transparent text-sm text-white font-medium w-16 focus:outline-none"
                />
              </div>

              <button
                id="admin-sync-btn"
                onClick={fetchAdminPayslips}
                className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl hover:bg-slate-850 text-slate-400 hover:text-white transition-colors"
                title="Reload Data"
              >
                <RefreshCw size={15} />
              </button>
            </div>

            {canGeneratePayroll && (
              <button
                id="admin-run-payroll-btn"
                onClick={handleGeneratePayroll}
                disabled={generating}
                className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-violet-500/20 flex items-center gap-2"
              >
                {generating ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Wallet size={15} />
                    <span>Generate Payroll</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-start gap-4 shadow-md">
              <div className="w-12 h-12 rounded-xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                <User size={20} className="text-violet-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm font-medium">Total Employees Paid</p>
                <h3 className="text-2xl font-extrabold text-white mt-1">
                  {loading ? "..." : payslips.length}
                </h3>
                <p className="text-xs text-slate-500 mt-1">For statement period</p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-start gap-4 shadow-md">
              <div className="w-12 h-12 rounded-xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <DollarSign size={20} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm font-medium">Total Gross Statement</p>
                <h3 className="text-2xl font-extrabold text-white mt-1">
                  {loading ? "..." : `₹${summary.total_gross.toLocaleString("en-IN")}`}
                </h3>
                <p className="text-xs text-slate-500 mt-1">Total CTC paid out</p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-start gap-4 shadow-md">
              <div className="w-12 h-12 rounded-xl bg-sky-600/10 border border-sky-500/20 flex items-center justify-center shrink-0">
                <Wallet size={20} className="text-sky-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm font-medium">Total Net Statement</p>
                <h3 className="text-2xl font-extrabold text-white mt-1">
                  {loading ? "..." : `₹${summary.total_net.toLocaleString("en-IN")}`}
                </h3>
                <p className="text-xs text-slate-500 mt-1">Actual take-home disbursed</p>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="px-5 py-4 border-b border-slate-850 bg-slate-900/40">
              <h3 className="text-sm font-semibold text-white">Statement Roster — {MONTHS[selectedMonth]} {selectedYear}</h3>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-2">
                <Loader2 size={26} className="text-violet-500 animate-spin" />
                <p className="text-slate-500 text-xs font-medium">Loading roster statements...</p>
              </div>
            ) : payslips.length === 0 ? (
              <div className="text-center py-20 px-4">
                <AlertTriangle size={36} className="text-slate-700 mx-auto mb-3" />
                <p className="text-slate-400 text-sm font-semibold">No payslips found</p>
                <p className="text-slate-600 text-xs mt-1">
                  Run payroll statement generation for active employees for this period.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-950/20 text-slate-400 text-xs uppercase tracking-wider">
                    <tr className="border-b border-slate-800">
                      <th className="text-left px-5 py-3.5 font-semibold">Employee Name</th>
                      <th className="text-left px-5 py-3.5 font-semibold hidden sm:table-cell">Department</th>
                      <th className="text-left px-5 py-3.5 font-semibold">Basic</th>
                      <th className="text-left px-5 py-3.5 font-semibold hidden md:table-cell">Allowances</th>
                      <th className="text-left px-5 py-3.5 font-semibold text-rose-400">Deductions</th>
                      <th className="text-left px-5 py-3.5 font-semibold">Gross</th>
                      <th className="text-left px-5 py-3.5 font-semibold text-emerald-400">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {payslips.map((ps) => {
                      const basic = ps.gross * 0.50;
                      const allowances = ps.gross - basic;
                      return (
                        <tr key={ps.id} className="hover:bg-slate-800/10 transition-colors">
                          <td className="px-5 py-4">
                            <div className="font-semibold text-white">{ps.employee_name || "HRMS Employee"}</div>
                            <div className="text-slate-500 text-[10px] mt-0.5">Emp ID: {ps.employee_id}</div>
                          </td>
                          <td className="px-5 py-4 text-slate-300 hidden sm:table-cell">
                            <div className="flex items-center gap-1.5">
                              <Building size={12} className="text-slate-500" />
                              {ps.department || "General Staff"}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-slate-300 font-mono text-xs">
                            ₹{basic.toLocaleString("en-IN")}
                          </td>
                          <td className="px-5 py-4 text-slate-300 font-mono text-xs hidden md:table-cell">
                            ₹{allowances.toLocaleString("en-IN")}
                          </td>
                          <td className="px-5 py-4 text-rose-400/90 font-mono text-xs">
                            ₹{ps.deductions.toLocaleString("en-IN")}
                          </td>
                          <td className="px-5 py-4 text-slate-300 font-mono text-xs">
                            ₹{ps.gross.toLocaleString("en-IN")}
                          </td>
                          <td className="px-5 py-4 text-emerald-400 font-bold font-mono text-xs">
                            ₹{ps.net.toLocaleString("en-IN")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        // ─── EMPLOYEE MY LEAVE HISTORY VIEW ───
        <div>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <Loader2 size={32} className="text-violet-500 animate-spin" />
              <p className="text-slate-500 text-sm">Retrieving pay history statement...</p>
            </div>
          ) : payslips.length === 0 ? (
            <div className="text-center py-20 px-4 bg-slate-900 border border-slate-800 rounded-2xl">
              <FileText size={42} className="text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400 text-sm font-semibold">No payslips found</p>
              <p className="text-slate-600 text-xs mt-1">
                Your statements will appear here once processed by your HR/Accounts department.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {payslips.map((ps) => (
                <div
                  key={ps.id}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 transition-all duration-300 p-5 rounded-2xl flex flex-col justify-between shadow-lg hover:shadow-xl"
                >
                  <div className="space-y-4">
                    {/* Month Year */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-violet-400" />
                        <span className="font-bold text-white text-base">
                          {MONTHS[ps.month]} {ps.year}
                        </span>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                        Paid
                      </span>
                    </div>

                    {/* Salary breakdown details */}
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Gross Salary:</span>
                        <span className="font-semibold text-slate-200">₹{ps.gross.toLocaleString("en-IN")}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Total Deductions:</span>
                        <span className="font-semibold text-rose-400">₹{ps.deductions.toLocaleString("en-IN")}</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-850 pt-2 font-bold text-sm text-emerald-400">
                        <span>Net Take-home:</span>
                        <span>₹{ps.net.toLocaleString("en-IN")}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions & Generated Date */}
                  <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">
                      Issued: {new Date(ps.generated_at).toLocaleDateString("en-IN")}
                    </span>

                    <button
                      onClick={() => downloadPayslipPdf(ps)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-750
                      text-slate-300 hover:border-violet-500 hover:text-violet-400 text-xs font-semibold transition-colors"
                    >
                      <Download size={11} />
                      Statement
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
