/**
 * pages/Recruitment.jsx — Job postings + AI resume screening + Voice Interview
 */
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Briefcase, Plus, X, Loader2, Sparkles, FileText, Star,
  Mic, MicOff, Volume2, CheckCircle2, AlertTriangle, User,
} from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

const STATUS_COLORS = {
  open: "text-emerald-400 bg-emerald-400/10",
  closed: "text-slate-400 bg-slate-400/10",
  on_hold: "text-amber-400 bg-amber-400/10",
};

const SpeechRecognitionAPI =
  window.SpeechRecognition || window.webkitSpeechRecognition || null;

const INTERVIEW_QUESTIONS = [
  "Tell me about yourself and your background.",
  "Why are you interested in this position?",
  "Describe a challenging project you worked on and how you handled it.",
  "What are your greatest strengths and areas for improvement?",
  "Where do you see yourself in 5 years?",
];

export default function Recruitment() {
  const { hasRole } = useAuth();
  const canManage = hasRole("management_admin", "hr_recruiter");

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showScreener, setShowScreener] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [saving, setSaving] = useState(false);
  const [screening, setScreening] = useState(false);
  const [screenResult, setScreenResult] = useState(null);
  const [screenerTab, setScreenerTab] = useState("resume"); // "resume" | "voice"
  const [form, setForm] = useState({ title: "", description: "", requirements: "", location: "", salary_range: "", status: "open" });
  const [screenerForm, setScreenerForm] = useState({ candidate_name: "", resume_file: null, jd_text: "" });

  // Voice interview state
  const [voiceForm, setVoiceForm] = useState({ candidate_name: "", job_title: "" });
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [listening, setListening] = useState(false);
  const [voiceResult, setVoiceResult] = useState(null);
  const [evaluating, setEvaluating] = useState(false);
  const [allAnswers, setAllAnswers] = useState([]);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [currentQuestionText, setCurrentQuestionText] = useState("");
  const [voiceResumeFile, setVoiceResumeFile] = useState(null);
  const [voiceResumeText, setVoiceResumeText] = useState("");
  const recognitionRef = useRef(null);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const res = await api.get("/recruitment");
        setJobs(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchJobs();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title) return;
    setSaving(true);
    try {
      const res = await api.post("/recruitment", form);
      setJobs((prev) => [res.data, ...prev]);
      setShowModal(false);
      setForm({ title: "", description: "", requirements: "", location: "", salary_range: "", status: "open" });
      toast.success("Job posting created!");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create job posting.");
    } finally {
      setSaving(false);
    }
  };

  const handleScreen = async (e) => {
    e.preventDefault();
    if (!screenerForm.resume_file || !screenerForm.jd_text) {
      toast.error("Both PDF resume file and job description are required.");
      return;
    }
    setScreening(true);
    setScreenResult(null);
    try {
      const formData = new FormData();
      formData.append("resume_file", screenerForm.resume_file);
      formData.append("jd_text", screenerForm.jd_text);
      formData.append("candidate_name", screenerForm.candidate_name || "Candidate");
      const res = await api.post("/ai/screen-resume", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setScreenResult(res.data);
      toast.success("AI screening complete!");
    } catch (err) {
      toast.error(err.response?.data?.detail || "AI screening failed. Check Groq configurations.");
    } finally {
      setScreening(false);
    }
  };  const openScreener = (job) => {
    setSelectedJob(job);
    setScreenerForm({ candidate_name: "", resume_file: null, jd_text: job.description || "" });
    setVoiceForm({ candidate_name: "", job_title: job.title });
    setScreenResult(null);
    setVoiceResult(null);
    setVoiceTranscript("");
    setCurrentQuestion(0);
    setAllAnswers([]);
    setScreenerTab("resume");
    setShowScreener(true);
    setInterviewStarted(false);
    setCurrentQuestionText("");
    setVoiceResumeFile(null);
    setVoiceResumeText("");
  };

  const getScoreColor = (score) => {
    if (score >= 75) return "text-emerald-400";
    if (score >= 50) return "text-amber-400";
    return "text-rose-400";
  };

  // ── Voice Interview Logic ───────────────────────────────────────────────────

  const startListeningAuto = useCallback(() => {
    if (!SpeechRecognitionAPI) return;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setVoiceTranscript((prev) => prev + (prev ? " " : "") + transcript);
    };
    try {
      recognition.start();
    } catch (e) {
      console.error("Speech recognition start failed:", e);
    }
  }, []);

  const speakQuestion = useCallback((text) => {
    if (!("speechSynthesis" in window)) {
      startListeningAuto();
      return;
    }
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.lang.startsWith("en") && (v.name.includes("Google") || v.name.includes("Natural"))) || voices.find(v => v.lang.startsWith("en")) || voices[0];
    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      setListening(false);
    };

    utterance.onend = () => {
      setTimeout(() => {
        startListeningAuto();
      }, 300);
    };

    utterance.onerror = () => {
      setTimeout(() => {
        startListeningAuto();
      }, 300);
    };

    window.speechSynthesis.speak(utterance);
  }, [startListeningAuto]);

  const startListening = useCallback(() => {
    if (!SpeechRecognitionAPI) {
      toast.error("Speech recognition not supported. Please use Chrome or Edge.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    startListeningAuto();
  }, [listening, startListeningAuto]);

  const startAIInterview = async () => {
    if (!voiceForm.candidate_name.trim()) {
      toast.error("Please enter the candidate's name first.");
      return;
    }
    setEvaluating(true);
    setVoiceResult(null);
    setVoiceTranscript("");
    setCurrentQuestion(0);
    setAllAnswers([]);
    setInterviewStarted(false);

    try {
      const formData = new FormData();
      formData.append("candidate_name", voiceForm.candidate_name);
      formData.append("job_title", voiceForm.job_title || selectedJob?.title || "the position");
      formData.append("jd_text", selectedJob?.description || "");
      if (voiceResumeFile) {
        formData.append("resume_file", voiceResumeFile);
      }

      const res = await api.post("/ai/voice-interview/start", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setCurrentQuestionText(res.data.question);
      setVoiceResumeText(res.data.resume_text || "");
      setInterviewStarted(true);
      toast.success("AI Interview started!");
      speakQuestion(res.data.question);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to start AI interview.");
    } finally {
      setEvaluating(false);
    }
  };

  const submitDynamicAnswer = async () => {
    if (!voiceTranscript.trim()) {
      toast.error("Please record or type your answer before proceeding.");
      return;
    }
    window.speechSynthesis.cancel();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    setListening(false);
    setEvaluating(true);

    try {
      const payload = {
        candidate_name: voiceForm.candidate_name || "Candidate",
        job_title: voiceForm.job_title || selectedJob?.title || "the position",
        jd_text: selectedJob?.description || "",
        history: allAnswers,
        current_question: currentQuestionText,
        candidate_answer: voiceTranscript,
        resume_text: voiceResumeText,
      };

      const res = await api.post("/ai/voice-interview/next", payload);
      const data = res.data;

      setAllAnswers(data.history);
      setVoiceTranscript("");

      if (data.is_complete) {
        setVoiceResult(data.assessment);
        setInterviewStarted(false);
        toast.success("AI Interview assessment complete!");
        if ("speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          const finalUtterance = new SpeechSynthesisUtterance("Thank you for completing the interview. I have compiled your assessment report.");
          window.speechSynthesis.speak(finalUtterance);
        }
      } else {
        setCurrentQuestionText(data.next_question);
        setCurrentQuestion(data.history.length);
        speakQuestion(data.next_question);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "AI failed to process response. Please retry.");
    } finally {
      setEvaluating(false);
    }
  };

  const submitVoiceInterview = async () => {
    if (!voiceTranscript.trim()) {
      toast.error("Please record your answer before proceeding.");
      return;
    }
    submitDynamicAnswer();
  };

  const resetVoiceInterview = () => {
    setVoiceResult(null);
    setVoiceTranscript("");
    setCurrentQuestion(0);
    setAllAnswers([]);
    setInterviewStarted(false);
    setCurrentQuestionText("");
    setVoiceResumeFile(null);
    setVoiceResumeText("");
  };

  return (
    <div className="p-6 h-full overflow-y-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Recruitment</h2>
          <p className="text-slate-400 text-sm">{jobs.filter(j => j.status === "open").length} open positions</p>
        </div>
        {canManage && (
          <button id="add-job-btn" onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-colors">
            <Plus size={16} />
            Post Job
          </button>
        )}
      </div>

      {/* Job Cards */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={24} className="text-violet-400 animate-spin" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-16">
          <Briefcase size={40} className="text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400">No job postings yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {jobs.map((job) => (
            <div key={job.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center shrink-0">
                  <Briefcase size={18} className="text-violet-400" />
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${STATUS_COLORS[job.status]}`}>
                  {job.status.replace("_", " ")}
                </span>
              </div>
              <div>
                <h3 className="font-semibold text-white">{job.title}</h3>
                {job.location && <p className="text-xs text-slate-400 mt-0.5">📍 {job.location}</p>}
                {job.salary_range && <p className="text-xs text-slate-400">💰 {job.salary_range}</p>}
                {job.description && (
                  <p className="text-xs text-slate-500 mt-2 line-clamp-2">{job.description}</p>
                )}
              </div>
              {canManage && (
                <button
                  id={`screen-job-${job.id}`}
                  onClick={() => openScreener(job)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl
                    bg-violet-600/10 border border-violet-600/30 text-violet-400 hover:bg-violet-600/20
                    text-xs font-medium transition-colors mt-auto"
                >
                  <Sparkles size={13} />
                  AI Screening
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Job Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h3 className="font-semibold text-white">Create Job Posting</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {[
                { label: "Job Title *", key: "title", type: "text", placeholder: "Senior React Developer" },
                { label: "Location", key: "location", type: "text", placeholder: "Remote / Bengaluru" },
                { label: "Salary Range", key: "salary_range", type: "text", placeholder: "₹15L - ₹25L" },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
                  <input type={type} value={form[key]} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Job Description</label>
                <textarea rows={4} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Describe the role, responsibilities..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Requirements</label>
                <textarea rows={3} value={form.requirements} onChange={(e) => setForm((p) => ({ ...p, requirements: e.target.value }))}
                  placeholder="Required skills, experience..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:border-violet-500" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm">Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2">
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  Post Job
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Screener Modal (Resume + Voice tabs) */}
      {showScreener && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-violet-400" />
                <h3 className="font-semibold text-white">AI Candidate Screening — {selectedJob?.title}</h3>
              </div>
              <button onClick={() => setShowScreener(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>

            {/* Tab Switcher */}
            <div className="flex border-b border-slate-800 shrink-0">
              <button
                onClick={() => setScreenerTab("resume")}
                className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  screenerTab === "resume"
                    ? "text-violet-400 border-b-2 border-violet-500"
                    : "text-slate-400 hover:text-slate-300"
                }`}
              >
                <FileText size={14} />
                Resume Screening
              </button>
              <button
                onClick={() => setScreenerTab("voice")}
                className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  screenerTab === "voice"
                    ? "text-violet-400 border-b-2 border-violet-500"
                    : "text-slate-400 hover:text-slate-300"
                }`}
              >
                <Mic size={14} />
                Voice Interview
                {!SpeechRecognitionAPI && <span className="text-[10px] text-amber-400 ml-1">(Chrome only)</span>}
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6">

              {/* ── Resume Tab ── */}
              {screenerTab === "resume" && (
                <div className="space-y-4">
                  {!screenResult ? (
                    <form onSubmit={handleScreen} className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Candidate Name</label>
                        <input type="text" value={screenerForm.candidate_name}
                          onChange={(e) => setScreenerForm((p) => ({ ...p, candidate_name: e.target.value }))}
                          placeholder="John Doe"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Job Description (pre-filled)</label>
                        <textarea rows={4} value={screenerForm.jd_text}
                          onChange={(e) => setScreenerForm((p) => ({ ...p, jd_text: e.target.value }))}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white resize-none focus:outline-none focus:border-violet-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Upload Resume (PDF) *</label>
                        <input type="file" accept=".pdf"
                          onChange={(e) => setScreenerForm((p) => ({ ...p, resume_file: e.target.files[0] }))}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-violet-600/10 file:text-violet-400 hover:file:bg-violet-600/20" />
                      </div>
                      <button type="submit" disabled={screening}
                        className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2">
                        {screening ? <><Loader2 size={15} className="animate-spin" />Analyzing with Groq...</> : <><Sparkles size={15} />Screen with AI</>}
                      </button>
                    </form>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-5 bg-slate-800 rounded-2xl">
                        <div>
                          <p className="text-slate-400 text-sm">AI Match Score</p>
                          <p className={`text-5xl font-bold mt-1 ${getScoreColor(screenResult.score)}`}>{screenResult.score}</p>
                          <p className="text-slate-500 text-xs mt-1">out of 100</p>
                        </div>
                        <div className="text-right">
                          <p className="text-slate-400 text-sm">Recommendation</p>
                          <p className={`font-semibold mt-1 ${getScoreColor(screenResult.score)}`}>{screenResult.recommendation}</p>
                        </div>
                      </div>
                      {screenResult.summary && (
                        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                          <p className="text-xs font-medium text-slate-400 mb-2">Summary</p>
                          <p className="text-sm text-slate-300">{screenResult.summary}</p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
                          <p className="text-xs font-medium text-emerald-400 mb-2">✓ Matched Skills</p>
                          <div className="flex flex-wrap gap-1.5">
                            {(screenResult.matched_skills || []).map((s, i) => (
                              <span key={i} className="text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full">{s}</span>
                            ))}
                          </div>
                        </div>
                        <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-3">
                          <p className="text-xs font-medium text-rose-400 mb-2">✗ Missing Skills</p>
                          <div className="flex flex-wrap gap-1.5">
                            {(screenResult.missing_skills || []).map((s, i) => (
                              <span key={i} className="text-xs px-2 py-0.5 bg-rose-500/10 text-rose-400 rounded-full">{s}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3">
                          <p className="text-xs font-medium text-blue-400 mb-2">💪 Strengths</p>
                          <ul className="list-disc pl-4 space-y-1">
                            {(screenResult.strengths || []).map((s, i) => (
                              <li key={i} className="text-xs text-slate-300">{s}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                          <p className="text-xs font-medium text-amber-400 mb-2">⚠️ Weaknesses</p>
                          <ul className="list-disc pl-4 space-y-1">
                            {(screenResult.weaknesses || []).map((w, i) => (
                              <li key={i} className="text-xs text-slate-300">{w}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <button onClick={() => setScreenResult(null)}
                        className="w-full py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm">
                        Screen Another Candidate
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── Voice Interview Tab ── */}
              {screenerTab === "voice" && (
                <div className="space-y-4">
                  {!voiceResult ? (
                    !interviewStarted ? (
                      <div className="space-y-5 text-center py-6">
                        {/* Setup fields */}
                        <div className="grid grid-cols-2 gap-3 text-left">
                          <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">Candidate Name *</label>
                            <input type="text" value={voiceForm.candidate_name}
                              onChange={(e) => setVoiceForm((p) => ({ ...p, candidate_name: e.target.value }))}
                              placeholder="Jane Smith"
                              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">Position</label>
                            <input type="text" value={voiceForm.job_title}
                              onChange={(e) => setVoiceForm((p) => ({ ...p, job_title: e.target.value }))}
                              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500" />
                          </div>
                        </div>

                        {/* Resume File Upload for Context */}
                        <div className="text-left">
                          <label className="block text-xs font-medium text-slate-400 mb-1">Candidate Resume (PDF) — Optional</label>
                          <input type="file" accept=".pdf"
                            onChange={(e) => setVoiceResumeFile(e.target.files[0])}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-violet-600/10 file:text-violet-400 hover:file:bg-violet-600/20" />
                          <p className="text-[10px] text-slate-500 mt-1">If uploaded, the AI recruiter will read their resume and ask context-specific questions tailored to their experience.</p>
                        </div>

                        {/* Instructions */}
                        <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-5 text-left space-y-3 max-w-lg mx-auto mt-2">
                          <h4 className="text-sm font-semibold text-white flex items-center gap-1.5">
                            <Sparkles size={14} className="text-violet-400" />
                            How the Dynamic AI Interview Works:
                          </h4>
                          <ul className="text-xs text-slate-300 space-y-2 list-disc pl-4">
                            <li>The AI recruiter dynamically creates questions tailored for this position.</li>
                            <li>Each question is spoken out loud automatically by the AI.</li>
                            <li>The microphone turns on immediately after speech ends so the candidate can answer.</li>
                            <li>The AI listens to each response and asks logical follow-up questions.</li>
                            <li>The interview runs for 5 rounds, followed by a complete assessment report.</li>
                          </ul>
                        </div>

                        <button
                          type="button"
                          onClick={startAIInterview}
                          disabled={evaluating || !voiceForm.candidate_name.trim()}
                          className="w-full max-w-sm py-3 px-6 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium text-sm flex items-center justify-center gap-2 mx-auto shadow-lg shadow-violet-500/20 disabled:opacity-50"
                        >
                          {evaluating ? (
                            <>
                              <Loader2 size={16} className="animate-spin" />
                              Starting AI Recruiter...
                            </>
                          ) : (
                            <>
                              <Mic size={16} />
                              Start AI Recruiter Interview
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Dynamic Interview Session */}
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span className="text-violet-400 font-semibold">
                            Question {Math.min(currentQuestion + 1, 5)} of 5
                          </span>
                          <div className="flex-1 h-1.5 bg-slate-800 rounded-full mx-4 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-300"
                              style={{ width: `${(allAnswers.length / 5) * 100}%` }}
                            />
                          </div>
                          <span>{allAnswers.length} / 5 Turns</span>
                        </div>

                        {/* Current Dynamic Question bubble */}
                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/60 rounded-2xl p-5 relative overflow-hidden">
                          <p className="text-xs text-violet-400 font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Bot size={13} className="text-violet-400" />
                            AI Recruiter
                          </p>
                          {evaluating && !currentQuestionText ? (
                            <div className="flex items-center gap-2 text-slate-400 text-sm py-2">
                              <Loader2 size={15} className="animate-spin" />
                              Generating question...
                            </div>
                          ) : (
                            <p className="text-sm text-white font-medium leading-relaxed">
                              {currentQuestionText || "Pre-loading interview questions..."}
                            </p>
                          )}
                          <div className="absolute right-4 bottom-4 flex gap-1.5">
                            {("speechSynthesis" in window) && (
                              <button
                                type="button"
                                onClick={() => speakQuestion(currentQuestionText)}
                                className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                                title="Re-play voice question"
                              >
                                <Volume2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Speech-to-Text Input Area */}
                        <div className="space-y-1.5">
                          <label className="block text-xs font-medium text-slate-400">Candidate Response</label>
                          <textarea
                            rows={4}
                            value={voiceTranscript}
                            onChange={(e) => setVoiceTranscript(e.target.value)}
                            placeholder={
                              listening
                                ? "🎤 Listening... Speak your answer now. You can also edit this text manually if needed."
                                : "Click 'Record Answer' to speak, or type your answer here..."
                            }
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 resize-none leading-relaxed placeholder-slate-500"
                          />
                        </div>

                        {/* Controls */}
                        <div className="flex gap-3">
                          <button
                            id="voice-interview-mic"
                            type="button"
                            onClick={startListening}
                            disabled={!SpeechRecognitionAPI || evaluating}
                            className={`flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 ${
                              listening
                                ? "bg-rose-600 hover:bg-rose-500 text-white animate-pulse"
                                : "bg-violet-600/10 border border-violet-600/30 text-violet-400 hover:bg-violet-600/20"
                            } disabled:opacity-40`}
                          >
                            {listening ? (
                              <>
                                <MicOff size={15} />
                                Stop Listening
                              </>
                            ) : (
                              <>
                                <Mic size={15} />
                                Record Answer
                              </>
                            )}
                          </button>

                          {voiceTranscript && (
                            <button
                              type="button"
                              onClick={() => setVoiceTranscript("")}
                              className="px-4 py-3 rounded-xl text-sm font-medium border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            >
                              Clear
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={submitDynamicAnswer}
                            disabled={evaluating || !voiceTranscript.trim()}
                            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-violet-500/15 disabled:opacity-50"
                          >
                            {evaluating ? (
                              <>
                                <Loader2 size={15} className="animate-spin" />
                                Processing...
                              </>
                            ) : (
                              <>
                                {allAnswers.length >= 4 ? (
                                  <>
                                    <Sparkles size={15} />
                                    Submit & Get Assessment
                                  </>
                                ) : (
                                  <>
                                    Submit Answer →
                                  </>
                                )}
                              </>
                            )}
                          </button>
                        </div>

                        {allAnswers.length > 0 && (
                          <button
                            type="button"
                            onClick={submitDynamicAnswer}
                            disabled={evaluating}
                            className="w-full py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                          >
                            {evaluating ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                            End Interview Early & Assess Candidate ({allAnswers.length} questions completed)
                          </button>
                        )}

                        {/* Conversation History log */}
                        {allAnswers.length > 0 && (
                          <div className="space-y-2 mt-4">
                            <p className="text-xs text-slate-400 font-semibold">Transcript History:</p>
                            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                              {allAnswers.map((qa, i) => (
                                <div key={i} className="bg-slate-800/40 border border-slate-800 rounded-xl p-3 text-xs space-y-1.5">
                                  <p className="text-violet-400 font-medium">Q{i + 1}: {qa.question}</p>
                                  <p className="text-slate-300 pl-4 border-l border-slate-700">{qa.answer}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )
                  ) : (
                    // Voice Result
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-5 bg-slate-800 rounded-2xl">
                        <div>
                          <p className="text-slate-400 text-sm">Overall Score</p>
                          <p className={`text-5xl font-bold mt-1 ${getScoreColor(voiceResult.score)}`}>{voiceResult.score}</p>
                          <p className="text-slate-500 text-xs mt-1">out of 100</p>
                        </div>
                        <div className="text-right space-y-2">
                          <p className={`font-semibold ${getScoreColor(voiceResult.score)}`}>{voiceResult.recommendation}</p>
                          <div className="text-right">
                            <p className="text-xs text-slate-500">Communication</p>
                            <p className="text-sm font-bold text-slate-200">{voiceResult.communication_score}/100</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-slate-500">Confidence</p>
                            <p className="text-sm font-bold text-slate-200">{voiceResult.confidence_score}/100</p>
                          </div>
                        </div>
                      </div>

                      {voiceResult.summary && (
                        <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl p-4">
                          <p className="text-xs font-medium text-violet-400 mb-2">AI Assessment</p>
                          <p className="text-sm text-slate-300 leading-relaxed">{voiceResult.summary}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
                          <p className="text-xs font-medium text-emerald-400 mb-2">💪 Key Strengths</p>
                          <ul className="space-y-1">
                            {(voiceResult.key_strengths || []).map((s, i) => (
                              <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                                <CheckCircle2 size={10} className="text-emerald-400 mt-0.5 shrink-0" />
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                          <p className="text-xs font-medium text-amber-400 mb-2">⚠️ Concerns</p>
                          <ul className="space-y-1">
                            {(voiceResult.concerns || []).map((c, i) => (
                              <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                                <AlertTriangle size={10} className="text-amber-400 mt-0.5 shrink-0" />
                                {c}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {voiceResult.next_steps && (
                        <div className="bg-sky-500/5 border border-sky-500/20 rounded-xl p-3">
                          <p className="text-xs font-medium text-sky-400 mb-1">→ Recommended Next Steps</p>
                          <p className="text-xs text-slate-300">{voiceResult.next_steps}</p>
                        </div>
                      )}

                      <button onClick={resetVoiceInterview}
                        className="w-full py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm">
                        Interview Another Candidate
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
