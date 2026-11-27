import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../api";

const DEPARTMENTS = [
  "Public Works Department (PWD)",
  "Municipal Corporation",
  "Education Department",
  "Police Department",
  "Electricity Board",
  "Health Department",
  "Revenue Department",
  "General Administration",
];

const EXAMPLE_PROMPTS = [
  "Mere gaon ki sadak banne me kitna kharch aaya?",
  "Sarkari hospital me dawaiyon ka stock kitna hai?",
  "Scholarship ke paise kab tak aate hain?",
  "Bijli connection ki application kyun pending hai?",
];

const SUBJECT_MAX = 100;
const DESC_MAX = 2000;

const fontCss = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Hind:wght@400;500;600;700&display=swap');
.js-root { font-family: 'Hind', system-ui, sans-serif; }
.js-display { font-family: 'Bricolage Grotesque', 'Hind', sans-serif; letter-spacing: -0.02em; }
.js-pop { animation: js-pop .35s ease-out; }
@keyframes js-pop { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
.js-shimmer { background: linear-gradient(90deg,#eef1f6 25%,#f7f9fc 50%,#eef1f6 75%); background-size: 200% 100%; animation: js-sh 1.3s infinite; }
@keyframes js-sh { to { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) { .js-pop, .js-shimmer { animation: none; } }
`;

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return "";
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "abhi";
  if (diff < 3600) return `${Math.floor(diff / 60)} min pehle`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ghante pehle`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} din pehle`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function Highlight({ text = "", query = "" }) {
  const q = query.trim();
  if (!q) return text;
  const words = q.split(/\s+/).filter((w) => w.length > 2).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!words.length) return text;
  const re = new RegExp(`(${words.join("|")})`, "gi");
  return text.split(re).map((part, i) =>
    re.test(part) && i % 2 === 1 ? (
      <mark key={i} className="bg-amber-200/70 text-inherit rounded px-0.5">{part}</mark>
    ) : (
      part
    )
  );
}

function CharMeter({ value, min, max }) {
  const len = value.length;
  const pct = Math.min(100, (len / max) * 100);
  const ok = len >= min;
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex-1 h-1 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${ok ? "bg-emerald-500" : "bg-amber-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-[11px] tabular-nums ${ok ? "text-slate-500" : "text-amber-600"}`}>
        {len}/{max}
      </span>
    </div>
  );
}

function StatCard({ label, value, tone }) {
  const tones = {
    navy: "text-slate-900",
    amber: "text-amber-600",
    green: "text-emerald-600",
  };
  return (
    <div className="flex-1 min-w-[96px] bg-white rounded-2xl border border-slate-200 px-4 py-3">
      <div className={`js-display text-2xl font-extrabold tabular-nums ${tones[tone]}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

export default function CitizenDashboard() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();

  const [rtis, setRtis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [onlyMine, setOnlyMine] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");

  const [rawPrompt, setRawPrompt] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [draftApplied, setDraftApplied] = useState(false);

  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState(DEPARTMENTS[0]);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState({ type: "", text: "" });
  const [copied, setCopied] = useState(false);

  const handleLogout = () => {
    if (logout) logout();
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/auth");
  };

  const fetchRTIs = async (status = statusFilter, query = searchQuery) => {
    setLoading(true);
    setFetchError("");
    try {
      const params = new URLSearchParams();
      if (status !== "ALL") params.append("status", status);
      if (query.trim()) params.append("search", query.trim());
      const qs = params.toString();
      const res = await fetch(qs ? `${API_BASE}/api/rti?${qs}` : `${API_BASE}/api/rti`);
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      setRtis(Array.isArray(data) ? data : data.applications || []);
      setActiveQuery(query.trim());
    } catch (err) {
      console.error("Failed to fetch RTIs:", err);
      setFetchError("Applications load nahi ho payin. Internet check karke dobara try karein.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRTIs(statusFilter, searchQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchRTIs(statusFilter, searchQuery);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setActiveQuery("");
    fetchRTIs(statusFilter, "");
  };

  const handleGenerateDraft = async () => {
    if (!rawPrompt.trim()) return;
    setDrafting(true);
    setDraftError("");
    setDraftApplied(false);
    try {
      const res = await fetch(`${API_BASE}/api/rti/draft`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ query: rawPrompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Draft generation failed");
      if (data.subject) setSubject(data.subject);
      if (data.category && DEPARTMENTS.includes(data.category)) setCategory(data.category);
      if (data.description) setDescription(data.description);
      setDraftApplied(true);
    } catch (err) {
      setDraftError("AI draft generate nahi ho paya. Dobara try karein.");
    } finally {
      setDrafting(false);
    }
  };

  const resetForm = () => {
    setSubject("");
    setDescription("");
    setRawPrompt("");
    setCategory(DEPARTMENTS[0]);
    setDraftApplied(false);
    setDraftError("");
  };

  const handleSubmitRTI = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitMessage({ type: "", text: "" });
    setCopied(false);
    try {
      const res = await fetch(`${API_BASE}/api/rti/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subject, category, description }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitMessage({ type: "error", text: data.message || data.error || "RTI save nahi ho payi." });
        return;
      }
      setSubmitMessage({
        type: "success",
        text: "RTI file ho gayi!",
        appNo: data.application?.application_no || "Generated",
      });
      resetForm();
      fetchRTIs(statusFilter, searchQuery);
    } catch (err) {
      setSubmitMessage({ type: "error", text: "Server error. Dobara try karein." });
    } finally {
      setSubmitting(false);
    }
  };

  const copyAppNo = async (no) => {
    try {
      await navigator.clipboard.writeText(no);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  const displayedRtis = onlyMine && user ? rtis.filter((r) => r.citizen_id === user.id) : rtis;

  const stats = useMemo(() => {
    const base = onlyMine && user ? rtis.filter((r) => r.citizen_id === user.id) : rtis;
    return {
      total: base.length,
      pending: base.filter((r) => r.status !== "RESPONDED").length,
      responded: base.filter((r) => r.status === "RESPONDED").length,
    };
  }, [rtis, onlyMine, user]);

  const focus = "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1";
  const field = `w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition`;

  return (
    <div className="js-root min-h-screen bg-[#F4F6FA] text-slate-900">
      <style>{fontCss}</style>

      {/* Tricolour strip */}
      <div className="h-1 flex" aria-hidden="true">
        <div className="flex-1 bg-[#E8890C]" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-[#1B7F3B]" />
      </div>

      {/* Header */}
      <nav className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="js-display w-10 h-10 rounded-xl bg-[#0F2557] text-white font-extrabold flex items-center justify-center text-lg">
              J
            </div>
            <div className="leading-tight">
              <span className="js-display font-extrabold text-[17px] text-[#0F2557] block">JanSoochna AI</span>
              <span className="text-[11px] text-slate-500">Citizen Right to Information Portal</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <div className="hidden sm:flex items-center gap-2.5 pl-1.5 pr-3.5 py-1 rounded-full bg-slate-100">
                  <span className="w-7 h-7 rounded-full bg-[#0F2557] text-white text-xs font-bold flex items-center justify-center">
                    {(user.name || "U").trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="text-xs font-semibold text-slate-800">{user.name}</span>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className={`text-xs font-semibold px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition cursor-pointer ${focus} focus-visible:ring-red-400`}
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                to="/auth"
                className={`text-xs font-semibold bg-[#0F2557] hover:bg-[#0B1C43] text-white px-4 py-2.5 rounded-xl transition ${focus} focus-visible:ring-blue-500`}
              >
                Citizen Login / Register
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero + search */}
      <header className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-6">
        <div className="relative overflow-hidden rounded-3xl bg-[#0F2557] text-white px-6 py-8 sm:px-10 sm:py-10">
          <div
            aria-hidden="true"
            className="absolute -right-24 -top-24 w-72 h-72 rounded-full border-[28px] border-white/[0.05]"
          />
          <div
            aria-hidden="true"
            className="absolute -right-4 -bottom-28 w-64 h-64 rounded-full border-[28px] border-[#E8890C]/15"
          />
          <div className="relative max-w-2xl">
            <p className="text-xs font-semibold text-blue-200 mb-3">RTI Act, 2005 – Citizen Self-Service</p>
            <h1 className="js-display text-3xl sm:text-[2.6rem] font-extrabold leading-[1.1]">
              Apne haq ki jankari maangein, AI ke saath
            </h1>
            <p className="text-blue-100/90 text-[15px] mt-3 max-w-xl">
              Pehle search karein ki aapke sawal ka jawab pehle se maujood hai ya nahi. Na mile to AI se formal RTI
              draft banwa kar file karein.
            </p>
          </div>

          <form onSubmit={handleSearch} role="search" className="relative mt-7 flex flex-col sm:flex-row gap-2.5 max-w-3xl">
            <div className="relative flex-1">
              <svg
                className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search existing RTIs"
                placeholder="Search RTIs: road repair funds, hospital medicines, scholarship..."
                className="w-full rounded-2xl bg-white text-slate-900 placeholder:text-slate-400 pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8890C]"
              />
            </div>
            <button
              type="submit"
              className={`bg-[#E8890C] hover:bg-[#D17A06] text-white text-sm font-bold px-7 py-3.5 rounded-2xl transition cursor-pointer ${focus} focus-visible:ring-white`}
            >
              AI Search
            </button>
            {activeQuery && (
              <button
                type="button"
                onClick={clearSearch}
                className={`bg-white/15 hover:bg-white/25 text-white text-sm font-semibold px-5 py-3.5 rounded-2xl transition cursor-pointer ${focus} focus-visible:ring-white`}
              >
                Clear
              </button>
            )}
          </form>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pb-14 grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
        {/* LEFT: File RTI */}
        <section className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-6 sm:p-8">
          <div className="mb-6">
            <h2 className="js-display text-2xl font-extrabold text-[#0F2557]">File a new RTI application</h2>
            <p className="text-sm text-slate-500 mt-1">
              Section 6(1) ke tahat seedha sambandhit department ko bhejein.
            </p>
          </div>

          {!user ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <h3 className="js-display font-bold text-lg text-slate-900">Pehle login karein</h3>
              <p className="text-sm text-slate-600 mt-1.5 mb-5 max-w-md mx-auto">
                RTI draft aur submit karne ke liye Citizen account se login ya register karein. Search aur status feed
                bina login ke bhi dekh sakte hain.
              </p>
              <Link
                to="/auth"
                className={`inline-block bg-[#0F2557] hover:bg-[#0B1C43] text-white text-sm font-semibold px-6 py-3 rounded-xl transition ${focus} focus-visible:ring-blue-500`}
              >
                Login / Create Citizen Account
              </Link>
            </div>
          ) : (
            <div className="space-y-7">
              {/* Step 1 */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                <div className="flex items-start gap-3">
                  <span className="js-display w-7 h-7 shrink-0 rounded-full bg-[#0F2557] text-white text-sm font-bold flex items-center justify-center">
                    1
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-bold text-slate-900">Apni baat likhein, AI draft banayega</h3>
                      <span className="text-[11px] font-semibold text-slate-500 shrink-0">Gemini AI</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Aam bhasha chalegi. Hindi, Hinglish ya English.</p>

                    <div className="flex flex-col sm:flex-row gap-2 mt-3">
                      <input
                        type="text"
                        value={rawPrompt}
                        onChange={(e) => setRawPrompt(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleGenerateDraft();
                          }
                        }}
                        aria-label="Describe what you want to know"
                        placeholder="e.g., Mere gaon ki sadak banne me kitna kharch aaya?"
                        className={field}
                      />
                      <button
                        type="button"
                        onClick={handleGenerateDraft}
                        disabled={drafting || !rawPrompt.trim()}
                        className={`bg-[#0F2557] hover:bg-[#0B1C43] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition whitespace-nowrap cursor-pointer ${focus} focus-visible:ring-blue-500`}
                      >
                        {drafting ? "Drafting..." : "Auto-draft RTI"}
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {EXAMPLE_PROMPTS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setRawPrompt(p)}
                          className="text-[11px] text-slate-600 bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-700 rounded-full px-3 py-1 transition cursor-pointer text-left"
                        >
                          {p}
                        </button>
                      ))}
                    </div>

                    {draftError && (
                      <p role="alert" className="text-xs text-red-600 mt-3">
                        {draftError}
                      </p>
                    )}
                    {draftApplied && !draftError && (
                      <p className="js-pop text-xs text-emerald-700 mt-3 font-medium">
                        Draft neeche form me bhar diya gaya hai. Submit karne se pehle ek baar padh lein aur zarurat ho to badlav karein.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {submitMessage.text && (
                <div
                  role="status"
                  className={`js-pop rounded-2xl p-4 text-sm border ${
                    submitMessage.type === "success"
                      ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                      : "bg-red-50 text-red-700 border-red-200"
                  }`}
                >
                  <div className="font-semibold">{submitMessage.text}</div>
                  {submitMessage.type === "success" && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-emerald-800">Application No:</span>
                      <code className="font-mono text-xs font-bold bg-white border border-emerald-200 rounded-lg px-2.5 py-1">
                        {submitMessage.appNo}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyAppNo(submitMessage.appNo)}
                        className="text-xs font-semibold text-emerald-800 hover:underline cursor-pointer"
                      >
                        {copied ? "Copied" : "Copy"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2 */}
              <form onSubmit={handleSubmitRTI} className="space-y-5">
                <div className="flex items-center gap-3">
                  <span className="js-display w-7 h-7 shrink-0 rounded-full bg-[#0F2557] text-white text-sm font-bold flex items-center justify-center">
                    2
                  </span>
                  <h3 className="font-bold text-slate-900">Application check karke submit karein</h3>
                </div>

                <div>
                  <label htmlFor="dept" className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Department / Public Authority
                  </label>
                  <select id="dept" value={category} onChange={(e) => setCategory(e.target.value)} className={field}>
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="subject" className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Subject <span className="font-normal text-slate-400">(10–100 characters)</span>
                  </label>
                  <input
                    id="subject"
                    type="text"
                    required
                    minLength={10}
                    maxLength={SUBJECT_MAX}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Concise subject of information requested"
                    className={field}
                  />
                  <CharMeter value={subject} min={10} max={SUBJECT_MAX} />
                </div>

                <div>
                  <label htmlFor="desc" className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Specific questions <span className="font-normal text-slate-400">(20–2000 characters)</span>
                  </label>
                  <textarea
                    id="desc"
                    required
                    minLength={20}
                    maxLength={DESC_MAX}
                    rows={7}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="1. Please provide certified copy of..."
                    className={`${field} resize-y leading-relaxed`}
                  />
                  <CharMeter value={description} min={20} max={DESC_MAX} />
                </div>

                <div className="flex flex-col-reverse sm:flex-row gap-3 pt-1">
                  <button
                    type="button"
                    onClick={resetForm}
                    disabled={submitting || (!subject && !description && !rawPrompt)}
                    className={`sm:w-40 border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 text-sm font-semibold py-3 rounded-xl transition cursor-pointer ${focus} focus-visible:ring-slate-400`}
                  >
                    Clear form
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className={`flex-1 bg-[#E8890C] hover:bg-[#D17A06] disabled:opacity-50 text-white text-sm font-bold py-3 rounded-xl transition cursor-pointer ${focus} focus-visible:ring-[#E8890C]`}
                  >
                    {submitting ? "Submitting application..." : "Submit RTI application"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>

        {/* RIGHT: Feed */}
        <section className="lg:col-span-5 space-y-4 lg:sticky lg:top-24">
          <div className="flex gap-2.5">
            <StatCard label="Total" value={stats.total} tone="navy" />
            <StatCard label="Pending" value={stats.pending} tone="amber" />
            <StatCard label="Responded" value={stats.responded} tone="green" />
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-5">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h2 className="js-display text-lg font-extrabold text-[#0F2557]">RTI status feed</h2>
              {user && (
                <button
                  type="button"
                  aria-pressed={onlyMine}
                  onClick={() => setOnlyMine(!onlyMine)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition cursor-pointer ${focus} focus-visible:ring-blue-500 ${
                    onlyMine
                      ? "bg-[#0F2557] text-white border-[#0F2557]"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {onlyMine ? "Showing my RTIs" : "Only my RTIs"}
                </button>
              )}
            </div>

            <div role="tablist" className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-4">
              {["ALL", "PENDING", "RESPONDED"].map((st) => (
                <button
                  key={st}
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === st}
                  onClick={() => setStatusFilter(st)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    statusFilter === st ? "bg-white text-[#0F2557] shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {st === "ALL" ? "All" : st === "PENDING" ? "Pending" : "Responded"}
                </button>
              ))}
            </div>

            {activeQuery && !loading && (
              <div className="js-pop flex items-center justify-between gap-2 text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-3 py-2 mb-3">
                <span className="truncate">
                  {displayedRtis.length} result{displayedRtis.length === 1 ? "" : "s"} for “{activeQuery}”
                </span>
                <button type="button" onClick={clearSearch} className="font-semibold hover:underline shrink-0 cursor-pointer">
                  Clear
                </button>
              </div>
            )}

            {loading ? (
              <div className="space-y-3" aria-busy="true">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="rounded-2xl border border-slate-100 p-4 space-y-2.5">
                    <div className="js-shimmer h-3 w-1/3 rounded" />
                    <div className="js-shimmer h-4 w-4/5 rounded" />
                    <div className="js-shimmer h-3 w-full rounded" />
                  </div>
                ))}
              </div>
            ) : fetchError ? (
              <div role="alert" className="text-center py-8 px-4 bg-red-50 rounded-2xl border border-red-100 text-sm text-red-700">
                <p>{fetchError}</p>
                <button
                  type="button"
                  onClick={() => fetchRTIs(statusFilter, searchQuery)}
                  className="mt-3 text-xs font-semibold bg-white border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-100 cursor-pointer"
                >
                  Retry
                </button>
              </div>
            ) : displayedRtis.length === 0 ? (
              <div className="text-center py-10 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                <p className="text-sm font-semibold text-slate-700">Koi RTI application nahi mili</p>
                <p className="text-xs text-slate-500 mt-1">
                  {activeQuery
                    ? "Kuch aur shabd try karein, ya is sawal ki nayi RTI file karein."
                    : "Filter badal kar dekhein ya pehli RTI file karein."}
                </p>
              </div>
            ) : (
              <ul className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
                {displayedRtis.map((rti) => {
                  const done = rti.status === "RESPONDED";
                  const mine = user && rti.citizen_id === user.id;
                  const when = timeAgo(rti.created_at);
                  return (
                    <li key={rti.id}>
                      <Link
                        to={`/applications/${rti.id}`}
                        className={`group block rounded-2xl border border-slate-200 border-l-4 ${
                          done ? "border-l-emerald-500" : "border-l-amber-400"
                        } hover:border-blue-300 hover:bg-slate-50 p-4 transition ${focus} focus-visible:ring-blue-500`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="font-mono text-[11px] font-semibold text-slate-500 truncate">
                            {rti.application_no}
                          </span>
                          <span
                            className={`shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                              done ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${done ? "bg-emerald-600" : "bg-amber-500"}`} />
                            {done ? "Responded" : "Pending"}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 line-clamp-1 group-hover:text-blue-800">
                          <Highlight text={rti.subject} query={activeQuery} />
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {rti.category}
                          {when ? ` • ${when}` : ""}
                          {mine ? " • Aapki RTI" : ""}
                        </p>
                        <p className="text-xs text-slate-600 mt-2 line-clamp-2">
                          <Highlight text={rti.description} query={activeQuery} />
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 text-xs text-slate-500 flex flex-col sm:flex-row justify-between gap-1">
          <span>JanSoochna AI helps you draft RTI applications. It does not replace legal advice.</span>
          <span>Right to Information Act, 2005</span>
        </div>
      </footer>
    </div>
  );
}