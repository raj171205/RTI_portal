import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function RTIDetailPage() {
  const { id } = useParams();
  const { user, token } = useAuth();

  const [rti, setRti] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [responseText, setResponseText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/rti/${id}`);
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
  }, [id]);

  const handleResponseSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError("");
    try {
      const res = await fetch(`/api/rti/${id}/response`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ response_text: responseText }),
      });
      const json = await res.json();
      if (!res.ok) setFormError(json.error || "Response save nahi ho paya.");
      else {
        setResponseText("");
        fetchDetail();
      }
    } catch {
      setFormError("Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Loading RTI details...</div>;

  if (error || !rti) {
    return (
      <div className="max-w-3xl mx-auto p-10 text-center space-y-4">
        <p className="text-red-600 font-medium">{error || "RTI not found."}</p>
        <Link to="/" className="inline-block px-4 py-2 bg-slate-900 text-white rounded-lg text-sm">
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link to="/" className="inline-flex items-center text-sm font-medium text-blue-600 hover:underline">
          ← Back to RTI Portal
        </Link>

        <section className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-mono font-semibold px-3 py-1 bg-slate-100 rounded-md text-slate-700">
              {rti.application_no}
            </span>
            <span
              className={`text-xs font-semibold px-3 py-1 rounded-full ${
                rti.status === "RESPONDED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
              }`}
            >
              {rti.status}
            </span>
          </div>

          <h1 className="text-2xl font-bold text-slate-900">{rti.subject}</h1>
          <div className="flex flex-wrap gap-4 text-xs text-slate-500 border-b border-slate-100 pb-4">
            <span>
              Department: <strong className="text-slate-700">{rti.category}</strong>
            </span>
            {rti.citizen_name && (
              <span>
                Applicant: <strong className="text-slate-700">{rti.citizen_name}</strong>
              </span>
            )}
            <span>Filed on: {new Date(rti.created_at).toLocaleString("en-IN")}</span>
          </div>

          <div className="space-y-2 pt-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Application Description</h2>
            <p className="text-slate-800 whitespace-pre-line leading-relaxed">{rti.description}</p>
          </div>
        </section>

        {rti.official_response ? (
          <section className="bg-emerald-50/70 p-6 md:p-8 rounded-2xl border border-emerald-200 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-emerald-900">Official Department Response</h2>
              <span className="text-xs text-emerald-700">
                {new Date(rti.official_response.responded_at).toLocaleString("en-IN")}
              </span>
            </div>
            <p className="text-slate-800 whitespace-pre-line leading-relaxed bg-white p-4 rounded-xl border border-emerald-100">
              {rti.official_response.response_text}
            </p>
            <p className="text-xs text-emerald-800">
              Responded by: <strong>{rti.official_response.officer_name}</strong> ({rti.official_response.officer_department})
            </p>
          </section>
        ) : user?.role === "OFFICER" ? (
          <section className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Submit Official PIO Response</h2>
              <p className="text-xs text-slate-500">
                Logged in as <strong>{user.name}</strong> ({user.department})
              </p>
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <form onSubmit={handleResponseSubmit} className="space-y-4">
              <textarea
                rows={4}
                required
                minLength={10}
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder="Write the official department reply..."
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition disabled:opacity-50"
              >
                {submitting ? "Submitting Response..." : "Publish Official Response"}
              </button>
            </form>
          </section>
        ) : (
          <section className="bg-amber-50/70 p-6 rounded-2xl border border-amber-200 text-center space-y-2">
            <p className="text-sm font-medium text-amber-900">Awaiting Official Department Response</p>
            <p className="text-xs text-amber-700">
              {user
                ? "Sirf assigned department ke PIO Officer hi is application ka jawab darj kar sakte hain."
                : "Agar aap PIO Officer hain, toh jawab dene ke liye pehle login karein."}
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
