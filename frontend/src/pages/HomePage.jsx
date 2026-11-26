import { API_BASE } from "../api";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function HomePage() {
  const { user, token, logoutUser } = useAuth();

  const [stats, setStats] = useState({ total: 0, pending: 0, responded: 0 });
  const [recentApps, setRecentApps] = useState([]);
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [viewScope, setViewScope] = useState("ALL"); // "ALL" | "MINE"
  const [loadingFeed, setLoadingFeed] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  // AI Draft Assistant states
  const [roughPrompt, setRoughPrompt] = useState("");
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftError, setDraftError] = useState("");

  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("Public Works Department");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState({ type: "", message: "" });
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  const fetchDashboardData = async (filter = activeFilter, scope = viewScope) => {
    setLoadingFeed(true);
    try {
      const queryParams = new URLSearchParams();
      if (filter !== "ALL") queryParams.set("status", filter);

      if (scope === "MINE" && user) {
        if (user.role === "CITIZEN") queryParams.set("mine", "true");
        if (user.role === "OFFICER" && user.department) {
          queryParams.set("department", user.department);
        }
      }

      const queryString = queryParams.toString();
      const url = queryString ? `${API_BASE}/api/rti?${queryString}` : `${API_BASE}/api/rti`;

      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (res.ok) {
        setStats(data.stats || { total: 0, pending: 0, responded: 0 });
        setRecentApps(data.applications || []);
      }
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    } finally {
      setLoadingFeed(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(activeFilter, viewScope);
  }, [activeFilter, viewScope, user]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchError("");
    setHasSearched(true);

    try {
      const res = await fetch(`${API_BASE}/api/rti/search?q=${encodeURIComponent(searchQuery.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        setSearchError(data.error || "Search failed.");
        setSearchResults([]);
      } else {
        setSearchResults(data.results || []);
      }
    } catch {
      setSearchError("Network error while searching.");
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setHasSearched(false);
    setSearchError("");
  };

  const handleGenerateDraft = async () => {
    if (!roughPrompt.trim() || roughPrompt.trim().length < 10) {
      setDraftError("Kam se kam 10 characters me apni samasya likhein.");
      return;
    }

    setIsDrafting(true);
    setDraftError("");
    setSubmitStatus({ type: "", message: "" });

    try {
      const res = await fetch(`${API_BASE}/api/rti/draft`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt: roughPrompt.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setDraftError(data.error || "Draft generate nahi ho paya.");
      } else if (data.draft) {
        setSubject(data.draft.subject || "");
        if (data.draft.category) setCategory(data.draft.category);
        setDescription(data.draft.description || "");
      }
    } catch {
      setDraftError("Server se connect nahi ho paya.");
    } finally {
      setIsDrafting(false);
    }
  };

  const handleSubmit = async (e, forceSubmit = false) => {
    if (e) e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus({ type: "", message: "" });
    if (forceSubmit) setDuplicateWarning(null);

    try {
      const res = await fetch(`${API_BASE}/api/rti/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ subject, description, category, force_submit: forceSubmit }),
      });
      const data = await res.json();

      if (res.status === 409 && data.duplicate_found) {
        setDuplicateWarning(data);
      } else if (!res.ok) {
        setSubmitStatus({ type: "error", message: data.error || "Submission failed." });
      } else {
        setSubmitStatus({
          type: "success",
          message: `RTI Submitted! Application No: ${data.data.application_no}`,
        });
        setDuplicateWarning(null);
        setRoughPrompt("");
        setSubject("");
        setDescription("");
        fetchDashboardData(activeFilter, viewScope);
      }
    } catch {
      setSubmitStatus({ type: "error", message: "Server se connect nahi ho paya." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 pb-12">
      {/* Top Navbar */}
      <nav className="bg-white border-b border-slate-200 px-4 py-3 mb-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link to="/" className="font-bold text-lg text-slate-900">
            RTI<span className="text-blue-600">Portal</span>
          </Link>

          {user ? (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs font-semibold text-slate-900">{user.name}</p>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    user.role === "OFFICER"
                      ? "bg-purple-100 text-purple-700"
                      : "bg-blue-100 text-blue-700"
                  }`}
                >
                  {user.role === "OFFICER" ? `PIO (${user.department})` : "CITIZEN"}
                </span>
              </div>
              <button
                onClick={() => {
                  setViewScope("ALL");
                  logoutUser();
                }}
                className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg hover:bg-slate-100"
              >
                Logout
              </button>
            </div>
          ) : (
            <Link
              to="/auth"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl"
            >
              Login / Register
            </Link>
          )}
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 space-y-10">
        <header className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
            AI-Powered RTI Portal
          </h1>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Semantic search se pehle se maujood RTI applications dhoondhein, status track karein, ya nayi application file karein.
          </p>
        </header>

        {/* Live Stats */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total RTIs Filed</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{stats.total}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-amber-200/80 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wider text-amber-700">Pending Action</p>
            <p className="text-3xl font-bold text-amber-600 mt-1">{stats.pending}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-emerald-200/80 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wider text-emerald-700">Official Responses</p>
            <p className="text-3xl font-bold text-emerald-600 mt-1">{stats.responded}</p>
          </div>
        </section>

        {/* Semantic Search */}
        <section className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">AI Semantic Search (Meaning-Based)</h2>
            {hasSearched && (
              <button onClick={clearSearch} className="text-sm text-slate-500 hover:text-slate-800 underline">
                Clear Search
              </button>
            )}
          </div>

          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="e.g., damaged highway road, water supply delay..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <button
              type="submit"
              disabled={isSearching}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition disabled:opacity-50"
            >
              {isSearching ? "Searching..." : "Search RTIs"}
            </button>
          </form>

          {searchError && <p className="text-red-600 text-sm">{searchError}</p>}

          {hasSearched && !isSearching && (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-slate-500">{searchResults.length} semantic match(es) found</p>
              {searchResults.length === 0 ? (
                <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500">
                  Is topic se milti-julti koi RTI nahi mili.
                </div>
              ) : (
                <div className="grid gap-4">
                  {searchResults.map((item) => (
                    <Link
                      key={item.id}
                      to={`/applications/${item.id}`}
                      className="block p-5 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition bg-white"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <span className="text-xs font-mono font-semibold px-2.5 py-1 bg-slate-100 rounded-md text-slate-700">
                          {item.application_no}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {item.similarity_score}% Match
                          </span>
                          <span
                            className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                              item.status === "RESPONDED"
                                ? "bg-blue-50 text-blue-700"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900">{item.subject}</h3>
                      <p className="text-sm text-slate-600 line-clamp-2 mt-1">{item.description}</p>
                      <p className="text-xs text-slate-400 mt-3">Department: {item.category}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Recent RTIs Feed + Scope Toggle */}
        <section className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-semibold">
                {viewScope === "MINE" && user
                  ? user.role === "OFFICER"
                    ? `${user.department} Queue`
                    : "My Filed RTIs"
                  : "Recent RTI Applications"}
              </h2>

              {user && (
                <button
                  onClick={() => setViewScope(viewScope === "ALL" ? "MINE" : "ALL")}
                  className={`px-3 py-1 text-xs font-semibold rounded-full border transition ${
                    viewScope === "MINE"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                  }`}
                >
                  {viewScope === "MINE"
                    ? "Show All Public RTIs"
                    : user.role === "OFFICER"
                    ? "My Department Only"
                    : "My Applications"}
                </button>
              )}
            </div>

            <div className="inline-flex rounded-xl bg-slate-100 p-1">
              {["ALL", "PENDING", "RESPONDED"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveFilter(tab)}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
                    activeFilter === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {loadingFeed ? (
            <p className="text-sm text-slate-500 py-4">Loading recent applications...</p>
          ) : recentApps.length === 0 ? (
            <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500">
              Is filter me abhi koi RTI application nahi hai.
            </div>
          ) : (
            <div className="grid gap-4">
              {recentApps.map((app) => (
                <Link
                  key={app.id}
                  to={`/applications/${app.id}`}
                  className="block p-5 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition bg-white"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-mono font-semibold px-2.5 py-1 bg-slate-100 rounded-md text-slate-700">
                      {app.application_no}
                    </span>
                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        app.status === "RESPONDED"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}
                    >
                      {app.status}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">{app.subject}</h3>
                  <p className="text-sm text-slate-600 line-clamp-2 mt-1">{app.description}</p>
                  <div className="flex items-center justify-between text-xs text-slate-400 mt-3">
                    <span>
                      Department: {app.category} {app.citizen_name ? `• Filed by ${app.citizen_name}` : ""}
                    </span>
                    <span>{new Date(app.created_at).toLocaleDateString("en-IN")}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* File New RTI + AI Draft Assistant */}
        <section className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
          <h2 className="text-xl font-semibold">File a New RTI Application</h2>

          {!user ? (
            <div className="p-6 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-center space-y-3">
              <p className="text-sm text-slate-600">
                Nayi RTI application file karne ke liye pehle apna Citizen account login karein.
              </p>
              <Link
                to="/auth"
                className="inline-block px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl"
              >
                Login / Register to File RTI
              </Link>
            </div>
          ) : (
            <>
              {/* AI RTI Draft Assistant Box */}
              <div className="p-5 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-indigo-950">
                    ✨ AI RTI Draft Assistant (RTI Act, 2005)
                  </h3>
                  <span className="text-[11px] font-medium text-indigo-700">
                    Powered by Gemini
                  </span>
                </div>
                <p className="text-xs text-indigo-900/80">
                  Apna sawal aam bhasha (Hindi/Hinglish/English) me likhein—AI use legal RTI format me draft karke neeche form me bhar dega.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={roughPrompt}
                    onChange={(e) => setRoughPrompt(e.target.value)}
                    placeholder="e.g., Ward 12 me 6 mahine se street light kharab hai, repair budget aur contractor ki detail chahiye"
                    className="flex-1 px-3.5 py-2.5 text-sm rounded-xl border border-indigo-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateDraft}
                    disabled={isDrafting}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition disabled:opacity-50 whitespace-nowrap"
                  >
                    {isDrafting ? "Drafting..." : "Generate Formal Draft"}
                  </button>
                </div>
                {draftError && <p className="text-xs text-red-600 font-medium">{draftError}</p>}
              </div>

              {submitStatus.message && (
                <div
                  className={`p-4 rounded-xl text-sm ${
                    submitStatus.type === "error"
                      ? "bg-red-50 text-red-700 border border-red-200"
                      : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  }`}
                >
                  {submitStatus.message}
                </div>
              )}

              {duplicateWarning && (
                <div className="p-5 rounded-xl bg-amber-50 border border-amber-300 space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-amber-900">Similar RTI Already Exists!</h3>
                    <p className="text-xs text-amber-800 mt-0.5">{duplicateWarning.message} Pehle inhe check karein:</p>
                  </div>
                  <div className="space-y-2">
                    {duplicateWarning.similar_rtis.map((dup) => (
                      <Link
                        key={dup.id}
                        to={`/applications/${dup.id}`}
                        className="flex items-center justify-between p-3 bg-white rounded-lg border border-amber-200 hover:border-amber-400 transition"
                      >
                        <div>
                          <p className="text-xs font-mono text-slate-500">
                            {dup.application_no} •{" "}
                            <span className="font-semibold text-emerald-700">{dup.similarity_score}% Match</span>
                          </p>
                          <p className="text-sm font-medium text-slate-900">{dup.subject}</p>
                        </div>
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                          {dup.status} →
                        </span>
                      </Link>
                    ))}
                  </div>
                  <div className="pt-2 flex items-center gap-3">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleSubmit(null, true)}
                      className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold rounded-lg transition"
                    >
                      Ignore & Submit Anyway
                    </button>
                    <button
                      type="button"
                      onClick={() => setDuplicateWarning(null)}
                      className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Subject (10–100 chars)</label>
                    <input
                      type="text"
                      required
                      minLength={10}
                      maxLength={100}
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g., Street Light Repair Budget in Ward 12"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Department / Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      <option value="Public Works Department">Public Works Department (PWD)</option>
                      <option value="Municipal Corporation">Municipal Corporation</option>
                      <option value="Education Department">Education Department</option>
                      <option value="Health & Sanitation">Health & Sanitation</option>
                      <option value="Electricity & Water Supply">Electricity & Water Supply</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Detailed Description (20–2000 chars)</label>
                  <textarea
                    rows={5}
                    required
                    minLength={20}
                    maxLength={2000}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Apna sawal aur zaroori details clearly likhein..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <p className="text-xs text-slate-400 text-right mt-1">{description.length} / 2000</p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl transition disabled:opacity-50"
                >
                  {isSubmitting ? "Generating AI Vector & Submitting..." : "Submit RTI"}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
}