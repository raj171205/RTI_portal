import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../api";

const SLA_DAYS = 30;

const fontCss = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Hind:wght@400;500;600;700&display=swap');
.od-root { font-family: 'Hind', system-ui, sans-serif; }
.od-display { font-family: 'Bricolage Grotesque', 'Hind', sans-serif; letter-spacing: -0.02em; }
.od-shimmer { background: linear-gradient(90deg,#eef1f6 25%,#f7f9fc 50%,#eef1f6 75%); background-size: 200% 100%; animation: od-sh 1.3s infinite; }
@keyframes od-sh { to { background-position: -200% 0; } }
.od-pop { animation: od-pop .3s ease-out; }
@keyframes od-pop { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .od-shimmer, .od-pop { animation: none; } }
`;

const QUEUES = [
  { key: "PENDING", label: "Pending disposal" },
  { key: "RESPONDED", label: "Replied" },
  { key: "ALL", label: "All records" },
];

function daysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function slaInfo(rti) {
  if (rti.status === "RESPONDED") return null;
  const elapsed = daysSince(rti.created_at);
  if (elapsed === null) return null;
  const left = SLA_DAYS - elapsed;
  if (left < 0) return { tone: "red", label: `${Math.abs(left)} din late`, left };
  if (left <= 7) return { tone: "amber", label: `${left} din baaki`, left };
  return { tone: "green", label: `${left} din baaki`, left };
}

const slaStyles = {
  red: "bg-red-100 text-red-800 border-red-200",
  amber: "bg-amber-100 text-amber-800 border-amber-200",
  green: "bg-emerald-50 text-emerald-800 border-emerald-200",
};

function Highlight({ text = "", query = "" }) {
  const words = query
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!words.length) return text;
  const re = new RegExp(`(${words.join("|")})`, "gi");
  return text.split(re).map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="bg-amber-200/70 text-inherit rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

function StatCard({ label, value, hint, tone }) {
  const tones = {
    navy: "text-[#0F2557]",
    amber: "text-amber-600",
    green: "text-emerald-600",
    red: "text-red-600",
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className={`od-display text-3xl font-extrabold tabular-nums mt-1 ${tones[tone]}`}>{value}</div>
      <div className="text-[11px] text-slate-400 mt-0.5">{hint}</div>
    </div>
  );
}

export default function OfficerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [rtis, setRtis] = useState([]);
  const [allRtis, setAllRtis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [onlyMyDept, setOnlyMyDept] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [sortOrder, setSortOrder] = useState("OLDEST");

  const handleLogout = () => {
    if (logout) logout();
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/auth");
  };

  const fetchCounts = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/rti`);
      if (!res.ok) return;
      const data = await res.json();
      setAllRtis(Array.isArray(data) ? data : data.applications || []);
    } catch {
      /* counts are optional */
    }
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
      console.error("Failed to fetch officer docket:", err);
      setFetchError("Register load nahi ho paya. Connection check karke dobara try karein.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCounts();
  }, []);

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

  const inMyDept = (r) => r.category?.toLowerCase().includes(user?.department?.toLowerCase() || "");
  const scope = (list) => (onlyMyDept && user?.department ? list.filter(inMyDept) : list);

  const displayedRtis = useMemo(() => {
    const list = [...scope(rtis)];
    list.sort((a, b) => {
      const da = new Date(a.created_at || 0).getTime();
      const db = new Date(b.created_at || 0).getTime();
      return sortOrder === "OLDEST" ? da - db : db - da;
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rtis, onlyMyDept, sortOrder, user]);

  const counts = useMemo(() => {
    const base = scope(allRtis.length ? allRtis : rtis);
    const pending = base.filter((r) => r.status !== "RESPONDED");
    const overdue = pending.filter((r) => slaInfo(r)?.tone === "red").length;
    const dueSoon = pending.filter((r) => slaInfo(r)?.tone === "amber").length;
    return {
      total: base.length,
      pending: pending.length,
      responded: base.length - pending.length,
      overdue,
      dueSoon,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRtis, rtis, onlyMyDept, user]);

  const exportCsv = () => {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [
      ["Application No", "Subject", "Department", "Status", "Filed On"],
      ...displayedRtis.map((r) => [r.application_no, r.subject, r.category, r.status, r.created_at || ""]),
    ];
    const blob = new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rti-register-${statusFilter.toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const badgeFor = (key) => (key === "PENDING" ? counts.pending : key === "RESPONDED" ? counts.responded : counts.total);
  const focus = "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1";
  const initial = (user?.name || "O").trim().charAt(0).toUpperCase();

  return (
    <div className="od-root min-h-screen bg-[#F4F6FA] text-slate-900 flex flex-col md:flex-row">
      <style>{fontCss}</style>

      {/* SIDEBAR */}
      <aside className="w-full md:w-72 md:min-h-screen md:sticky md:top-0 md:h-screen bg-[#0A1A40] text-slate-200 flex flex-col justify-between shrink-0">
        <div className="overflow-y-auto">
          <div className="h-1 flex" aria-hidden="true">
            <div className="flex-1 bg-[#E8890C]" />
            <div className="flex-1 bg-white" />
            <div className="flex-1 bg-[#1B7F3B]" />
          </div>

          <div className="px-6 py-5 border-b border-white/10 flex items-center gap-3">
            <div className="od-display w-10 h-10 rounded-xl bg-[#E8890C] text-[#0A1A40] font-extrabold flex items-center justify-center text-sm">
              PIO
            </div>
            <div className="leading-tight">
              <div className="od-display font-extrabold text-white text-[17px]">GovDesk RTI</div>
              <div className="text-[11px] text-blue-200/80">Officer portal</div>
            </div>
          </div>

          <div className="px-6 py-5 border-b border-white/10">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-white/10 text-white font-bold flex items-center justify-center">
                {initial}
              </span>
              <div className="min-w-0">
                <div className="font-semibold text-white text-sm truncate">{user?.name}</div>
                <div className="text-xs text-blue-200/80 truncate">
                  {user?.department || "Public Information Officer"}
                </div>
              </div>
            </div>
          </div>

          <nav className="p-4 space-y-1" aria-label="Docket queues">
            <div className="px-3 pb-1.5 text-xs font-semibold text-blue-200/60">Docket queues</div>
            {QUEUES.map((item) => {
              const active = statusFilter === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => setStatusFilter(item.key)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${focus} focus-visible:ring-[#E8890C] ${
                    active ? "bg-white text-[#0A1A40]" : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span>{item.label}</span>
                  <span
                    className={`min-w-[1.75rem] text-center px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums ${
                      active ? "bg-[#0A1A40] text-white" : "bg-white/10 text-slate-300"
                    }`}
                  >
                    {badgeFor(item.key)}
                  </span>
                </button>
              );
            })}

            {user?.department && (
              <div className="pt-5">
                <div className="px-3 pb-1.5 text-xs font-semibold text-blue-200/60">Jurisdiction</div>
                <button
                  type="button"
                  aria-pressed={onlyMyDept}
                  onClick={() => setOnlyMyDept(!onlyMyDept)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium border transition cursor-pointer ${focus} focus-visible:ring-[#E8890C] ${
                    onlyMyDept
                      ? "bg-[#E8890C]/15 border-[#E8890C]/50 text-amber-200"
                      : "border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span>{onlyMyDept ? "My department only" : "All departments"}</span>
                  <span
                    aria-hidden="true"
                    className={`w-8 h-[18px] rounded-full relative transition ${onlyMyDept ? "bg-[#E8890C]" : "bg-white/20"}`}
                  >
                    <span
                      className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all ${
                        onlyMyDept ? "left-[16px]" : "left-0.5"
                      }`}
                    />
                  </span>
                </button>
              </div>
            )}
          </nav>
        </div>

        <div className="p-4 border-t border-white/10">
          <button
            type="button"
            onClick={handleLogout}
            className={`w-full py-2.5 px-4 rounded-xl border border-white/15 hover:bg-red-600 hover:border-red-600 text-slate-200 hover:text-white text-sm font-semibold transition cursor-pointer ${focus} focus-visible:ring-red-400`}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="od-display text-2xl font-extrabold text-[#0F2557]">RTI disposal register</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Section 7 ke tahat har application ka jawab {SLA_DAYS} din ke andar dena zaroori hai.
            </p>
          </div>

          <form onSubmit={handleSearch} role="search" className="flex items-center gap-2 w-full lg:w-[28rem]">
            <div className="relative flex-1">
              <svg
                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
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
                aria-label="Search similar past cases"
                placeholder="Search similar past cases..."
                className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3.5 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#0F2557] focus:ring-2 focus:ring-[#0F2557]/20"
              />
            </div>
            <button
              type="submit"
              className={`bg-[#0F2557] hover:bg-[#0B1C43] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition cursor-pointer ${focus} focus-visible:ring-blue-500`}
            >
              Search
            </button>
            {activeQuery && (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="Clear search"
                className={`text-sm text-slate-500 hover:text-slate-900 px-2.5 py-2.5 rounded-xl hover:bg-slate-100 cursor-pointer ${focus} focus-visible:ring-slate-400`}
              >
                ✕
              </button>
            )}
          </form>
        </header>

        <main className="p-4 sm:p-8 flex-1 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard label="Pending" value={counts.pending} hint="Reply ka intezaar" tone="navy" />
            <StatCard label="Due within 7 days" value={counts.dueSoon} hint="Jaldi dekhein" tone="amber" />
            <StatCard label="Overdue" value={counts.overdue} hint={`${SLA_DAYS} din se zyada`} tone="red" />
            <StatCard label="Replied" value={counts.responded} hint="Dispose ho chuki" tone="green" />
          </div>

          {/* Register */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 sm:px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="od-display font-extrabold text-[#0F2557] text-lg">
                  {QUEUES.find((q) => q.key === statusFilter)?.label}
                  <span className="ml-2 text-sm font-semibold text-slate-400 tabular-nums">
                    {displayedRtis.length}
                  </span>
                </h2>
                {activeQuery && !loading && (
                  <p className="od-pop text-xs text-slate-500 mt-0.5">
                    Search results for “{activeQuery}”
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <label className="sr-only" htmlFor="sort">
                  Sort
                </label>
                <select
                  id="sort"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="text-xs font-semibold rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0F2557]/30 cursor-pointer"
                >
                  <option value="OLDEST">Oldest first</option>
                  <option value="NEWEST">Newest first</option>
                </select>
                <button
                  type="button"
                  onClick={exportCsv}
                  disabled={!displayedRtis.length}
                  className={`text-xs font-semibold rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${focus} focus-visible:ring-slate-400`}
                >
                  Export CSV
                </button>
              </div>
            </div>

            {loading ? (
              <div className="divide-y divide-slate-100" aria-busy="true">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="px-6 py-5 flex items-center gap-6">
                    <div className="od-shimmer h-4 w-28 rounded" />
                    <div className="flex-1 space-y-2">
                      <div className="od-shimmer h-4 w-2/3 rounded" />
                      <div className="od-shimmer h-3 w-1/2 rounded" />
                    </div>
                    <div className="od-shimmer h-8 w-32 rounded-lg" />
                  </div>
                ))}
              </div>
            ) : fetchError ? (
              <div role="alert" className="p-12 text-center">
                <p className="text-sm text-red-700">{fetchError}</p>
                <button
                  type="button"
                  onClick={() => fetchRTIs(statusFilter, searchQuery)}
                  className="mt-3 text-xs font-semibold border border-red-200 text-red-700 rounded-lg px-4 py-2 hover:bg-red-50 cursor-pointer"
                >
                  Retry
                </button>
              </div>
            ) : displayedRtis.length === 0 ? (
              <div className="p-14 text-center">
                <p className="text-sm font-semibold text-slate-700">Is queue me koi RTI record nahi hai</p>
                <p className="text-xs text-slate-500 mt-1">
                  {statusFilter === "PENDING"
                    ? "Sab applications dispose ho chuki hain."
                    : "Filter ya search badal kar dekhein."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50">
                      <th scope="col" className="py-3 px-5">Application</th>
                      <th scope="col" className="py-3 px-5">Subject</th>
                      <th scope="col" className="py-3 px-5">Department</th>
                      <th scope="col" className="py-3 px-5">Deadline</th>
                      <th scope="col" className="py-3 px-5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {displayedRtis.map((rti) => {
                      const sla = slaInfo(rti);
                      const pending = rti.status !== "RESPONDED";
                      return (
                        <tr
                          key={rti.id}
                          className={`hover:bg-slate-50 transition ${sla?.tone === "red" ? "bg-red-50/40" : ""}`}
                        >
                          <td className="py-4 px-5 whitespace-nowrap">
                            <div className="font-mono text-xs font-bold text-slate-800">{rti.application_no}</div>
                            {rti.created_at && (
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                {new Date(rti.created_at).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-5 max-w-md">
                            <div className="font-semibold text-slate-900 line-clamp-1">
                              <Highlight text={rti.subject} query={activeQuery} />
                            </div>
                            <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                              <Highlight text={rti.description} query={activeQuery} />
                            </div>
                          </td>
                          <td className="py-4 px-5 text-xs text-slate-700 whitespace-nowrap">{rti.category}</td>
                          <td className="py-4 px-5 whitespace-nowrap">
                            {pending ? (
                              sla ? (
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${slaStyles[sla.tone]}`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      sla.tone === "red"
                                        ? "bg-red-600"
                                        : sla.tone === "amber"
                                        ? "bg-amber-500"
                                        : "bg-emerald-600"
                                    }`}
                                  />
                                  {sla.label}
                                </span>
                              ) : (
                                <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                                  Pending
                                </span>
                              )
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                Replied
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-5 text-right whitespace-nowrap">
                            <Link
                              to={`/applications/${rti.id}`}
                              className={`inline-block text-xs font-semibold px-4 py-2 rounded-lg transition ${focus} ${
                                pending
                                  ? "bg-[#E8890C] hover:bg-[#D17A06] text-white focus-visible:ring-[#E8890C]"
                                  : "border border-slate-300 hover:bg-slate-100 text-slate-700 focus-visible:ring-slate-400"
                              }`}
                            >
                              {pending ? "Issue reply" : "View record"}
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}