import { API_BASE } from "../api";
import { useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Kept in sync with the department list used on the citizen RTI form,
// so the officer's "My department only" filter matches RTI categories.
const OFFICER_DEPARTMENTS = [
  "Public Works Department",
  "Municipal Corporation",
  "Education Department",
  "Police Department",
  "Electricity Board",
  "Health Department",
  "Revenue Department",
  "General Administration",
];

const ROLES = [
  { key: "CITIZEN", title: "Citizen", desc: "RTI file karein aur status track karein" },
  { key: "OFFICER", title: "PIO Officer", desc: "Department ki RTI ka official jawab dein" },
];

const fontCss = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Hind:wght@400;500;600;700&display=swap');
.au-root { font-family: 'Hind', system-ui, sans-serif; }
.au-display { font-family: 'Bricolage Grotesque', 'Hind', sans-serif; letter-spacing: -0.02em; }
.au-pop { animation: au-pop .3s ease-out; }
@keyframes au-pop { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .au-pop { animation: none; } }
`;

function passwordStrength(pw) {
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  const levels = [
    { label: "Bahut kamzor", color: "bg-red-500" },
    { label: "Kamzor", color: "bg-red-500" },
    { label: "Theek hai", color: "bg-amber-500" },
    { label: "Accha", color: "bg-emerald-500" },
    { label: "Mazboot", color: "bg-emerald-600" },
  ];
  return { score, ...levels[score] };
}

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// Put the Ashoka Stambh image in your project's public/ folder as
// "ashoka-stambh.png" (or change the path below). Until that file exists,
// an Ashoka Chakra drawn in SVG is shown instead.
const EMBLEM_SRC = "/ashoka-stambh.png";

function Emblem({ className = "" }) {
  const [failed, setFailed] = useState(false);

  if (!failed) {
    return (
      <img
        src={EMBLEM_SRC}
        alt="Ashoka Stambh, emblem of India"
        onError={() => setFailed(true)}
        className={`${className} object-contain brightness-0 invert opacity-95`}
      />
    );
  }

  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label="Ashoka Chakra" fill="none" stroke="white">
      <circle cx="50" cy="50" r="46" strokeWidth="3" />
      <circle cx="50" cy="50" r="7" strokeWidth="3" fill="white" />
      {Array.from({ length: 24 }, (_, i) => (
        <line
          key={i}
          x1="50"
          y1="12"
          x2="50"
          y2="43"
          strokeWidth="2"
          strokeLinecap="round"
          transform={`rotate(${i * 15} 50 50)`}
        />
      ))}
    </svg>
  );
}

// Flag of India: 3:2 ratio, three equal bands, navy 24-spoke Ashoka Chakra
// in the centre of the white band.
function IndianFlag({ className = "" }) {
  return (
    <svg
      viewBox="0 0 90 60"
      className={`${className} rounded-md shadow-lg shadow-black/30`}
      role="img"
      aria-label="Flag of India"
    >
      <rect width="90" height="20" y="0" fill="#FF9933" />
      <rect width="90" height="20" y="20" fill="#FFFFFF" />
      <rect width="90" height="20" y="40" fill="#138808" />
      <g fill="none" stroke="#000080" transform="translate(45 30)">
        <circle r="8" strokeWidth="0.8" />
        <circle r="1.1" fill="#000080" strokeWidth="0" />
        {Array.from({ length: 24 }, (_, i) => (
          <line
            key={i}
            x1="0"
            y1="-1.6"
            x2="0"
            y2="-7.6"
            strokeWidth="0.4"
            transform={`rotate(${i * 15})`}
          />
        ))}
      </g>
    </svg>
  );
}

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState("CITIZEN");
  const [department, setDepartment] = useState(OFFICER_DEPARTMENTS[0]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { loginUser } = useAuth();
  const navigate = useNavigate();

  const strength = useMemo(() => passwordStrength(password), [password]);

  const switchMode = (login) => {
    setIsLogin(login);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const endpoint = isLogin ? `${API_BASE}/api/auth/login` : `${API_BASE}/api/auth/register`;
    const payload = isLogin
      ? { email, password }
      : { name, email, password, role, department: role === "OFFICER" ? department : null };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Authentication failed.");
      } else {
        loginUser(data.token, data.user);
        navigate("/");
      }
    } catch {
      setError("Server se connect nahi ho paya. Internet check karke dobara try karein.");
    } finally {
      setLoading(false);
    }
  };

  const field =
    "w-full px-3.5 py-3 rounded-xl border border-slate-300 bg-white text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#0F2557] focus:ring-2 focus:ring-[#0F2557]/20 transition";
  const focus = "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1";

  return (
    <div className="au-root min-h-screen bg-[#F4F6FA] text-slate-900 flex flex-col lg:flex-row">
      <style>{fontCss}</style>

      {/* Brand panel */}
      <aside className="relative overflow-hidden bg-[#0A1A40] text-white lg:w-[44%] lg:min-h-screen flex flex-col justify-between">
        <div className="h-1 flex absolute top-0 inset-x-0" aria-hidden="true">
          <div className="flex-1 bg-[#E8890C]" />
          <div className="flex-1 bg-white" />
          <div className="flex-1 bg-[#1B7F3B]" />
        </div>
        <div
          aria-hidden="true"
          className="absolute -right-28 -top-28 w-80 h-80 rounded-full border-[32px] border-white/[0.05]"
        />
        <div
          aria-hidden="true"
          className="absolute -left-16 -bottom-32 w-72 h-72 rounded-full border-[32px] border-[#E8890C]/15"
        />

        <div className="relative px-8 sm:px-12 pt-10">
          <Link to="/" className={`inline-flex items-center gap-3 rounded-lg ${focus} focus-visible:ring-white`}>
            <span className="au-display w-10 h-10 rounded-xl bg-[#E8890C] text-[#0A1A40] font-extrabold flex items-center justify-center text-lg">
              J
            </span>
            <span className="au-display font-extrabold text-lg">JanSoochna AI</span>
          </Link>
        </div>

        <div className="relative px-8 sm:px-12 py-10 lg:py-0 max-w-lg">
          <div className="flex items-center gap-5 mb-7">
            <Emblem className="w-20 h-20 sm:w-24 sm:h-24" />
            <span className="w-px h-14 bg-white/20" aria-hidden="true" />
            <IndianFlag className="w-24 sm:w-28 h-auto" />
          </div>
          <p className="text-xs font-semibold text-blue-200/70 -mt-3 mb-5">Satyameva Jayate</p>
          <h1 className="au-display text-3xl sm:text-4xl font-extrabold leading-[1.12]">
            Sarkar se jawab maangna ab aasan hai
          </h1>
          <p className="text-blue-100/85 mt-4 text-[15px]">
            RTI Act, 2005 ke tahat apni application AI ki madad se likhein, file karein aur har kadam par track karein.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-blue-100/90">
            <li className="flex gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#E8890C] shrink-0" />
              Aam bhasha me likhein, AI formal RTI draft bana dega
            </li>
            <li className="flex gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#E8890C] shrink-0" />
              Pehle se maujood jawab semantic search se dhundhein
            </li>
            <li className="flex gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#E8890C] shrink-0" />
              Officers ke liye 30 din ke deadline ka tracker
            </li>
          </ul>
        </div>

        <p className="relative px-8 sm:px-12 pb-8 text-xs text-blue-200/60 hidden lg:block">
          Right to Information Act, 2005
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-8 py-10">
        <div className="w-full max-w-md">
          <Link
            to="/"
            className={`inline-block text-sm font-medium text-[#0F2557] hover:underline mb-6 rounded ${focus} focus-visible:ring-blue-500`}
          >
            ← Back to RTI Portal
          </Link>

          <div className="bg-white p-7 sm:p-8 rounded-3xl border border-slate-200 space-y-6">
            <div role="tablist" aria-label="Sign in or register" className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl">
              {[
                { login: true, label: "Sign in" },
                { login: false, label: "Create account" },
              ].map((t) => (
                <button
                  key={t.label}
                  type="button"
                  role="tab"
                  aria-selected={isLogin === t.login}
                  onClick={() => switchMode(t.login)}
                  className={`py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${focus} focus-visible:ring-blue-500 ${
                    isLogin === t.login ? "bg-white text-[#0F2557] shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div>
              <h2 className="au-display text-2xl font-extrabold text-[#0F2557]">
                {isLogin ? "Wapas aapka swagat hai" : "Naya account banayein"}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {isLogin
                  ? "Apne email aur password se sign in karein."
                  : "Citizens RTI file aur track kar sakte hain. PIO Officers official reply de sakte hain."}
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="au-pop p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <>
                  <div>
                    <label htmlFor="name" className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Full name
                    </label>
                    <input
                      id="name"
                      type="text"
                      required
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Raj Patel"
                      className={field}
                    />
                  </div>

                  <fieldset>
                    <legend className="block text-sm font-semibold text-slate-700 mb-1.5">Account type</legend>
                    <div className="grid grid-cols-2 gap-2.5">
                      {ROLES.map((r) => {
                        const active = role === r.key;
                        return (
                          <button
                            type="button"
                            key={r.key}
                            aria-pressed={active}
                            onClick={() => setRole(r.key)}
                            className={`text-left p-3 rounded-xl border-2 transition cursor-pointer ${focus} focus-visible:ring-blue-500 ${
                              active
                                ? "border-[#0F2557] bg-[#0F2557]/[0.04]"
                                : "border-slate-200 hover:border-slate-300"
                            }`}
                          >
                            <span className="flex items-center justify-between">
                              <span className="text-sm font-bold text-slate-900">{r.title}</span>
                              <span
                                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                  active ? "border-[#0F2557]" : "border-slate-300"
                                }`}
                              >
                                {active && <span className="w-2 h-2 rounded-full bg-[#0F2557]" />}
                              </span>
                            </span>
                            <span className="block text-xs text-slate-500 mt-1 leading-snug">{r.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>

                  {role === "OFFICER" && (
                    <div className="au-pop">
                      <label htmlFor="dept" className="block text-sm font-semibold text-slate-700 mb-1.5">
                        Assigned department
                      </label>
                      <select
                        id="dept"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className={field}
                      >
                        {OFFICER_DEPARTMENTS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className={field}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isLogin ? "Apna password likhein" : "Kam se kam 6 characters"}
                    className={`${field} pr-16`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500 hover:text-slate-900 px-2 py-1 rounded-md cursor-pointer ${focus} focus-visible:ring-blue-500`}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>

                {!isLogin && password && (
                  <div className="au-pop flex items-center gap-2 mt-2" aria-live="polite">
                    <div className="flex-1 flex gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            strength.score >= i ? strength.color : "bg-slate-200"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-[11px] text-slate-500 w-20 text-right">{strength.label}</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 bg-[#E8890C] hover:bg-[#D17A06] text-white text-sm font-bold rounded-xl transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 ${focus} focus-visible:ring-[#E8890C]`}
              >
                {loading && <Spinner />}
                {loading ? "Please wait..." : isLogin ? "Sign in" : "Create account"}
              </button>
            </form>

            <p className="text-center text-sm text-slate-600">
              {isLogin ? "Naye user hain?" : "Pehle se account hai?"}{" "}
              <button
                type="button"
                onClick={() => switchMode(!isLogin)}
                className={`text-[#0F2557] font-semibold hover:underline cursor-pointer rounded ${focus} focus-visible:ring-blue-500`}
              >
                {isLogin ? "Account banayein" : "Sign in karein"}
              </button>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}