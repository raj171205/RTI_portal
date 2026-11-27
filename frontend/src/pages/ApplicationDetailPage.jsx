import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../api";
import { getSLAInfo, exportOfficialRTIPDF } from "../utils/rtiHelpers";

export default function ApplicationDetailPage() {
  const { id } = useParams();
  const { user, token } = useAuth();
  const isOfficer =
    user?.role?.toUpperCase() === "PIO" || user?.role?.toUpperCase() === "OFFICER";

  const [rti, setRti] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [responseText, setResponseText] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);
  const [replyMessage, setReplyMessage] = useState({ type: "", text: "" });

  const [showAppealBox, setShowAppealBox] = useState(false);
  const [appealReason, setAppealReason] = useState("");
  const [appealSubmitted, setAppealSubmitted] = useState(false);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/rti/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Application not found");
      setRti(data.application || data);
    } catch (err) {
      setError(err.message || "Failed to load RTI details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const handleOfficerReply = async (e) => {
    e.preventDefault();
    if (!responseText.trim()) return;
    setSubmittingReply(true);
    setReplyMessage({ type: "", text: "" });
    try {
      const res = await fetch(`${API_BASE}/api/rti/${id}/respond`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ response_text: responseText }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || "Failed to publish response");
      }
      setReplyMessage({
        type: "success",
        text: "Official PIO response publish ho gaya hai aur status RESPONDED mark ho gaya hai.",
      });
      setResponseText("");
      fetchDetail();
    } catch (err) {
      setReplyMessage({ type: "error", text: err.message });
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleAppealSubmit = (e) => {
    e.preventDefault();
    if (!appealReason.trim()) return;
    setAppealSubmitted(true);
    setShowAppealBox(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F6FA] flex items-center justify-center text-sm text-slate-500">
        RTI record load ho raha hai...
      </div>
    );
  }

  if (error || !rti) {
    return (
      <div className="min-h-screen bg-[#F4F6FA] flex flex-col items-center justify-center gap-4 p-4">
        <p className="text-red-600 font-medium text-sm">{error || "RTI nahi mili."}</p>
        <Link to="/" className="text-sm font-semibold text-[#0F2557] hover:underline">
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  const sla = getSLAInfo(rti.created_at, rti.status);

  return (
    <div className="min-h-screen bg-[#F4F6FA] text-slate-900 pb-16">
      <div className="h-1 flex" aria-hidden="true">
        <div className="flex-1 bg-[#E8890C]" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-[#1B7F3B]" />
      </div>

      <nav className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            to="/"
            className="text-sm font-semibold text-slate-700 hover:text-[#0F2557] transition"
          >
            ← Back to {isOfficer ? "Officer Register" : "Citizen Portal"}
          </Link>

          <button
            type="button"
            onClick={() => exportOfficialRTIPDF(rti)}
            className="inline-flex items-center gap-2 bg-[#0F2557] hover:bg-[#0B1C43] text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm transition cursor-pointer"
          >
            Download Official PDF / Receipt
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 pt-8 space-y-6">
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-slate-100">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded">
                  {rti.application_no}
                </span>
                <span>•</span>
                <span className="font-semibold text-slate-700">{rti.category}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 pt-1">
                {rti.subject}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              {rti.status !== "RESPONDED" && (
                <span
                  className={`text-xs font-bold px-3 py-1 rounded-full ${
                    sla.isOverdue
                      ? "bg-red-100 text-red-700"
                      : "bg-blue-50 text-[#0F2557] border border-blue-200"
                  }`}
                >
                  SLA: {sla.label}
                </span>
              )}
              <span
                className={`text-xs font-bold px-3 py-1 rounded-full ${
                  rti.status === "RESPONDED"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {rti.status}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 py-4 border-b border-slate-100 text-xs">
            <div>
              <span className="text-slate-400 block">Applicant</span>
              <span className="font-semibold text-slate-800">
                {rti.citizen_name || "Registered Citizen"}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Filed Date</span>
              <span className="font-semibold text-slate-800">
                {rti.created_at
                  ? new Date(rti.created_at).toLocaleDateString("en-IN")
                  : "Recently Filed"}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Statutory 30-Day Deadline</span>
              <span className="font-semibold text-slate-800">
                {sla.deadlineStr || "30 Days from Filing"}
              </span>
            </div>
          </div>

          <div className="pt-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Particulars of Information Requested (Section 6(1))
            </h2>
            <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-5 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
              {rti.description}
            </div>
          </div>
        </div>

        {rti.response_text && (
          <div className="bg-emerald-50/70 rounded-3xl border border-emerald-200 p-6 sm:p-8 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Official Response by Public Information Officer (Section 7(1))
              </span>
              {rti.officer_name && (
                <span className="text-xs font-semibold text-emerald-700">
                  PIO: {rti.officer_name}
                </span>
              )}
            </div>
            <div className="bg-white rounded-2xl border border-emerald-200 p-5 text-sm text-slate-900 whitespace-pre-wrap leading-relaxed">
              {rti.response_text}
            </div>
          </div>
        )}

        {!isOfficer && rti.status !== "RESPONDED" && (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  First Appeal Escalation (Section 19(1), RTI Act 2005)
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  {sla.isOverdue
                    ? "30-day statutory deadline samapt ho chuki hai. Aap First Appellate Authority (FAA) ko appeal escalate kar sakte hain."
                    : `Statutory deadline (${sla.deadlineStr}) tak PIO ka jawab aana anivarya hai. Delay hone par aap First Appeal file kar sakte hain.`}
                </p>
              </div>

              {!appealSubmitted && (
                <button
                  type="button"
                  onClick={() => setShowAppealBox(!showAppealBox)}
                  className={`text-xs font-semibold px-4 py-2.5 rounded-xl transition whitespace-nowrap cursor-pointer ${
                    sla.isOverdue
                      ? "bg-red-600 hover:bg-red-700 text-white"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-800"
                  }`}
                >
                  {showAppealBox ? "Cancel" : "File First Appeal"}
                </button>
              )}
            </div>

            {appealSubmitted && (
              <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs font-medium text-amber-900">
                First Appeal (Section 19) Appellate Authority ke paas register ho gayi hai. Reference: APP-{rti.application_no}.
              </div>
            )}

            {showAppealBox && (
              <form
                onSubmit={handleAppealSubmit}
                className="mt-4 pt-4 border-t border-slate-100 space-y-3"
              >
                <label className="block text-xs font-semibold text-slate-700">
                  Grounds for First Appeal (e.g., No reply within 30 days / Incomplete information)
                </label>
                <textarea
                  required
                  rows={3}
                  value={appealReason}
                  onChange={(e) => setAppealReason(e.target.value)}
                  placeholder="State why you are escalating this application to the First Appellate Authority..."
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <button
                  type="submit"
                  className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition cursor-pointer"
                >
                  Submit Section 19 First Appeal
                </button>
              </form>
            )}
          </div>
        )}

        {isOfficer && rti.status !== "RESPONDED" && (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm">
            <h2 className="text-lg font-bold text-[#0F2557] mb-1">
              Issue Official Departmental Response
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Yeh jawab permanent public record me save hoga aur citizen ko PDF receipt par dikhega.
            </p>

            {replyMessage.text && (
              <div
                className={`mb-4 rounded-xl p-3.5 text-xs font-medium ${
                  replyMessage.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {replyMessage.text}
              </div>
            )}

            <form onSubmit={handleOfficerReply} className="space-y-4">
              <textarea
                required
                minLength={10}
                rows={6}
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder="Point-wise official information under Section 7(1) of the RTI Act, 2005..."
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F2557]"
              />
              <button
                type="submit"
                disabled={submittingReply}
                className="bg-[#E8890C] hover:bg-[#D17A06] disabled:opacity-50 text-white text-sm font-bold px-6 py-3 rounded-xl transition cursor-pointer"
              >
                {submittingReply ? "Publishing..." : "Publish Official Reply"}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}