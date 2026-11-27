import { API_BASE } from "../api";
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const SLA_DAYS = 30;
const RESPONSE_MAX = 5000;

const fontCss = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Hind:wght@400;500;600;700&display=swap');
.dt-root { font-family: 'Hind', system-ui, sans-serif; }
.dt-display { font-family: 'Bricolage Grotesque', 'Hind', sans-serif; letter-spacing: -0.02em; }
.dt-shimmer { background: linear-gradient(90deg,#eef1f6 25%,#f7f9fc 50%,#eef1f6 75%); background-size: 200% 100%; animation: dt-sh 1.3s infinite; }
@keyframes dt-sh { to { background-position: -200% 0; } }
.dt-pop { animation: dt-pop .3s ease-out; }
@keyframes dt-pop { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .dt-shimmer, .dt-pop { animation: none; } }
@media print {
  .dt-noprint { display: none !important; }
  .dt-root { background: white !important; }
}
`;

const focus = "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1";

function fmtDate(value, withTime = true) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d)) return "";
  return d.toLocaleString("en-IN", withTime ? undefined : { day: "numeric", month: "short", year: "numeric" });
}

function TricolourStrip() {
  return (
    <div className="h-1 flex dt-noprint" aria-hidden="true">
      <div className="flex-1 bg-[#E8890C]" />
      <div className="flex-1 bg-white" />
      <div className="flex-1 bg-[#1B7F3B]" />
    </div>
  );
}

function Shell({ children }) {
  return (
    <div className="dt-root min-h-screen bg-[#F4F6FA] text-slate-900">
      <style>{fontCss}</style>
      <TricolourStrip />
      {children}
    </div>
  );
}

function Timeline({ filedAt, respondedAt, responded }) {
  const steps = [
    { label: "Filed", sub: fmtDate(filedAt, false), done: true },
    { label: "Department review", sub: responded ? "Complete" : "In progress", done: responded, current: !responded },
    { label: "Responded", sub: responded ? fmtDate(respondedAt, false) : "Pending", done: responded },
  ];
  return (
    <ol className="flex items-start" aria-label="Application progress">
      {steps.map((s, i) => (
        <li key={s.label} className="flex-1 flex flex-col items-center text-center relative">
          {i > 0 && (
            <span
              aria-hidden="true"
              className={`absolute top-3.5 right-1/2 w-full h-0.5 ${steps[i - 1].done && s.done ? "bg-emerald-500" : steps[i - 1].done ? "bg-gradient-to-r from-emerald-500 to-slate-200" : "bg-slate-200"}`}
            />
          )}
          <span
            className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
              s.done
                ? "bg-emerald-500 border-emerald-500 text-white"
                : s.current
                ? "bg-white border-[#E8890C] text-[#E8890C]"
                : "bg-white border-slate-300 text-slate-400"
            }`}
          >
            {s.done ? "✓" : i + 1}
          </span>
          <span className="text-xs font-semibold text-slate-800 mt-2">{s.label}</span>
          <span className="text-[11px] text-slate-500">{s.sub}</span>
        </li>
      ))}
    </ol>
  );
}

export default function RTIDetailPage() {
  const { id } = useParams();
  const { user, token } = useAuth();

  const [rti, setRti] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [responseText, setResponseText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [justPublished, setJustPublished] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchDetail = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/rti/${id}`);
      const json = await res.json();
      if (!res.ok) setError(json.error || "RTI nahi mili.");
      else setRti(json.data);
    } catch {
      setError("Server se connect nahi ho paya.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleResponseSubmit = async (e) => {
    e.preventDefault();
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      const res = await fetch(`${API_BASE}/api/rti/${id}/response`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ response_text: responseText }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFormError(json.error || "Response save nahi ho paya.");
        setConfirming(false);
      } else {
        setResponseText("");
        setConfirming(false);
        setJustPublished(true);
        fetchDetail();
      }
    } catch {
      setFormError("Network error. Dobara try karein.");
      setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  };

  const copyAppNo = async () => {
    try {
      await navigator.clipboard.writeText(rti.application_no);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  if (loading && !rti) {
    return (
      <Shell>
        <div className="max-w-3xl mx-auto px-4 py-10 space-y-5" aria-busy="true">
          <div className="dt-shimmer h-4 w-32 rounded" />
          <div className="bg-white rounded-3xl border border-slate-200 p-8 space-y-4">
            <div className="dt-shimmer h-6 w-40 rounded" />
            <div className="dt-shimmer h-8 w-4/5 rounded" />
            <div className="dt-shimmer h-4 w-2/3 rounded" />
            <div className="dt-shimmer h-24 w-full rounded-xl" />
          </div>
        </div>
      </Shell>
    );
  }

  if (error || !rti) {
    return (
      <Shell>
        <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
          <h1 className="dt-display text-2xl font-extrabold text-[#0F2557]">Application nahi mili</h1>
          <p role="alert" className="text-sm text-red-600">
            {error || "RTI not found."}
          </p>
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={fetchDetail}
              className={`px-5 py-2.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold cursor-pointer ${focus} focus-visible:ring-slate-400`}
            >
              Retry
            </button>
            <Link
              to="/"
              className={`px-5 py-2.5 bg-[#0F2557] hover:bg-[#0B1C43] text-white rounded-xl text-sm font-semibold ${focus} focus-visible:ring-blue-500`}
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  const responded = Boolean(rti.official_response);
  const filedDays = rti.created_at ? Math.floor((Date.now() - new Date(rti.created_at).getTime()) / 86400000) : null;
  const daysLeft = filedDays === null || isNaN(filedDays) ? null : SLA_DAYS - filedDays;
  const slaTone = daysLeft === null ? null : daysLeft < 0 ? "red" : daysLeft <= 7 ? "amber" : "green";
  const slaStyles = {
    red: "bg-red-50 border-red-200 text-red-800",
    amber: "bg-amber-50 border-amber-200 text-amber-900",
    green: "bg-emerald-50 border-emerald-200 text-emerald-900",
  };
  const slaText =
    daysLeft === null
      ? ""
      : daysLeft < 0
      ? `Reply ka ${SLA_DAYS} din ka deadline ${Math.abs(daysLeft)} din pehle nikal chuka hai.`
      : `Reply dene ke liye ${daysLeft} din baaki hain (Section 7 ke tahat ${SLA_DAYS} din).`;

  const isOfficer = user?.role === "OFFICER";
  const deptMismatch =
    isOfficer &&
    user?.department &&
    rti.category &&
    !rti.category.toLowerCase().includes(user.department.toLowerCase());

  return (
    <Shell>
      <main className="py-8 sm:py-10 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center justify-between dt-noprint">
            <Link
              to="/"
              className={`inline-flex items-center text-sm font-medium text-[#0F2557] hover:underline rounded ${focus} focus-visible:ring-blue-500`}
            >
              ← Back to RTI Portal
            </Link>
            <button
              type="button"
              onClick={() => window.print()}
              className={`text-xs font-semibold border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 px-3.5 py-2 rounded-lg cursor-pointer ${focus} focus-visible:ring-slate-400`}
            >
              Print / Save PDF
            </button>
          </div>

          {/* Application */}
          <section className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold px-3 py-1.5 bg-slate-100 rounded-lg text-slate-700">
                  {rti.application_no}
                </span>
                <button
                  type="button"
                  onClick={copyAppNo}
                  className={`text-xs font-semibold text-[#0F2557] hover:underline cursor-pointer dt-noprint rounded ${focus} focus-visible:ring-blue-500`}
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${
                  responded ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${responded ? "bg-emerald-600" : "bg-amber-500"}`} />
                {responded ? "Responded" : "Pending"}
              </span>
            </div>

            <h1 className="dt-display text-2xl sm:text-3xl font-extrabold text-[#0F2557] leading-tight">
              {rti.subject}
            </h1>

            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm border-y border-slate-100 py-4">
              <div>
                <dt className="text-xs text-slate-500">Department</dt>
                <dd className="font-semibold text-slate-800 mt-0.5">{rti.category}</dd>
              </div>
              {rti.citizen_name && (
                <div>
                  <dt className="text-xs text-slate-500">Applicant</dt>
                  <dd className="font-semibold text-slate-800 mt-0.5">{rti.citizen_name}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-slate-500">Filed on</dt>
                <dd className="font-semibold text-slate-800 mt-0.5">{fmtDate(rti.created_at)}</dd>
              </div>
            </dl>

            <Timeline
              filedAt={rti.created_at}
              respondedAt={rti.official_response?.responded_at}
              responded={responded}
            />

            <div>
              <h2 className="text-sm font-bold text-slate-700 mb-2">Application description</h2>
              <p className="text-slate-800 whitespace-pre-line leading-relaxed max-w-prose">{rti.description}</p>
            </div>
          </section>

          {/* Response area */}
          {responded ? (
            <section
              className={`bg-emerald-50 p-6 md:p-8 rounded-3xl border border-emerald-200 space-y-4 ${
                justPublished ? "dt-pop" : ""
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="dt-display text-xl font-extrabold text-emerald-900">Official department response</h2>
                <span className="text-xs text-emerald-800">{fmtDate(rti.official_response.responded_at)}</span>
              </div>
              {justPublished && (
                <p role="status" className="text-sm font-medium text-emerald-800">
                  Aapka jawab publish ho gaya hai.
                </p>
              )}
              <p className="text-slate-800 whitespace-pre-line leading-relaxed bg-white p-5 rounded-2xl border border-emerald-100 max-w-prose">
                {rti.official_response.response_text}
              </p>
              <p className="text-sm text-emerald-900">
                Responded by <strong>{rti.official_response.officer_name}</strong>
                {rti.official_response.officer_department ? `, ${rti.official_response.officer_department}` : ""}
              </p>
            </section>
          ) : isOfficer ? (
            <section className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 space-y-5 dt-noprint">
              <div>
                <h2 className="dt-display text-xl font-extrabold text-[#0F2557]">Issue official PIO response</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Signed in as <strong className="text-slate-700">{user.name}</strong>
                  {user.department ? `, ${user.department}` : ""}
                </p>
              </div>

              {slaTone && (
                <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${slaStyles[slaTone]}`}>{slaText}</div>
              )}

              {deptMismatch && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Yeh application <strong>{rti.category}</strong> ki hai, aapka department{" "}
                  <strong>{user.department}</strong> hai. Jawab dene se pehle check kar lein.
                </div>
              )}

              {formError && (
                <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  {formError}
                </p>
              )}

              <form onSubmit={handleResponseSubmit} className="space-y-4">
                <div>
                  <label htmlFor="resp" className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Reply <span className="font-normal text-slate-400">(kam se kam 10 characters)</span>
                  </label>
                  <textarea
                    id="resp"
                    rows={7}
                    required
                    minLength={10}
                    maxLength={RESPONSE_MAX}
                    value={responseText}
                    onChange={(e) => {
                      setResponseText(e.target.value);
                      setConfirming(false);
                    }}
                    placeholder="Point-wise official department reply likhein..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm leading-relaxed placeholder:text-slate-400 focus:outline-none focus:border-[#0F2557] focus:ring-2 focus:ring-[#0F2557]/20 resize-y"
                  />
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 h-1 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          responseText.length >= 10 ? "bg-emerald-500" : "bg-amber-400"
                        }`}
                        style={{ width: `${Math.min(100, (responseText.length / RESPONSE_MAX) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[11px] tabular-nums text-slate-500">
                      {responseText.length}/{RESPONSE_MAX}
                    </span>
                  </div>
                </div>

                {confirming && (
                  <div className="dt-pop rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Publish karne ke baad is portal par jawab badla nahi ja sakta aur citizen ko dikhne lagega. Pakka
                    publish karna hai?
                  </div>
                )}

                <div className="flex flex-col-reverse sm:flex-row gap-3">
                  {confirming && (
                    <button
                      type="button"
                      onClick={() => setConfirming(false)}
                      disabled={submitting}
                      className={`sm:w-36 border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-semibold py-3 rounded-xl cursor-pointer ${focus} focus-visible:ring-slate-400`}
                    >
                      Edit reply
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={submitting}
                    className={`flex-1 text-white text-sm font-bold py-3 rounded-xl transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer ${focus} ${
                      confirming
                        ? "bg-[#1B7F3B] hover:bg-[#156830] focus-visible:ring-emerald-600"
                        : "bg-[#E8890C] hover:bg-[#D17A06] focus-visible:ring-[#E8890C]"
                    }`}
                  >
                    {submitting
                      ? "Publishing response..."
                      : confirming
                      ? "Yes, publish official response"
                      : "Review and publish"}
                  </button>
                </div>
              </form>
            </section>
          ) : (
            <section className="bg-amber-50 p-6 rounded-3xl border border-amber-200 text-center space-y-1.5 dt-noprint">
              <p className="text-sm font-bold text-amber-900">Department ke jawab ka intezaar hai</p>
              {slaText && <p className="text-xs text-amber-800">{slaText}</p>}
              <p className="text-xs text-amber-800">
                {user
                  ? "Sirf assigned department ke PIO Officer hi is application ka jawab darj kar sakte hain."
                  : "Agar aap PIO Officer hain, toh jawab dene ke liye pehle login karein."}
              </p>
              {!user && (
                <Link
                  to="/auth"
                  className={`inline-block mt-2 text-xs font-semibold bg-[#0F2557] hover:bg-[#0B1C43] text-white px-4 py-2 rounded-lg ${focus} focus-visible:ring-blue-500`}
                >
                  Login
                </Link>
              )}
            </section>
          )}
        </div>
      </main>
    </Shell>
  );
}