import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { FiArrowRight, FiCheck, FiEye, FiEyeOff, FiLock, FiMail, FiShield } from "react-icons/fi";
import { useAuthStore } from "../store/authStore";

const REMEMBER_EMAIL_KEY = "neeri_remember_email";

export default function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_EMAIL_KEY);
    if (saved) {
      setEmail(saved);
      setRememberMe(true);
    }
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      if (rememberMe) {
        localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
      } else {
        localStorage.removeItem(REMEMBER_EMAIL_KEY);
      }
      toast.success("Logged in");
      navigate("/dashboard");
    } catch {
      toast.error("Login failed");
    } finally {
      setLoading(false);
    }
  };

  const logoSrc = import.meta.env.VITE_INVOICE_LOGO_URL ?? "assets/images/logo.png";

  return (
    <div className="flex min-h-screen">
      <section className="relative hidden w-[45%] flex-col justify-between overflow-hidden bg-gradient-to-br from-[#1a1410] via-[#2a1f18] to-[#3d2e24] px-10 py-10 text-white lg:flex">
        <div className="login-arcs pointer-events-none absolute inset-0" />
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <img
              src={logoSrc}
              alt="Neeri's Cleopatra"
              className="h-12 w-12 rounded-full border border-[#d4af37]/40 bg-white/95 object-contain p-1"
            />
            <div>
              <p className="font-display text-2xl font-semibold tracking-wide text-[#d4af37]">Neeri&apos;s Cleopatra</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">Hair & Beauty</p>
            </div>
          </div>

          <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-[#d4af37]/35 bg-[#2a1f18]/80 px-3 py-1.5 text-xs text-[#e8d48b]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#d4af37]" />
            Neeri&apos;s Cleopatra Hair & Beauty
          </div>

          <h1 className="mt-8 max-w-md text-4xl font-semibold leading-tight tracking-tight text-white xl:text-5xl">
            Beauty, care and confidence{" "}
            <span className="text-[#d4af37]">in every appointment.</span>
          </h1>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-white/75">
            Sign in to manage appointments, customers, services and day-to-day salon operations from one secure
            dashboard.
          </p>

          <ul className="mt-8 space-y-3">
            {[
              "Manage salon bookings and appointments",
              "Organise customers and beauty services",
              "Secure access to your business dashboard"
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-white/85">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#d4af37] text-[#2a1f18]">
                  <FiCheck className="text-xs" strokeWidth={3} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-white/45">
          © {new Date().getFullYear()} Neeri&apos;s Cleopatra Hair & Beauty. All rights reserved.
        </p>
      </section>

      <section className="flex flex-1 items-center justify-center bg-[#f7f3ee] px-4 py-10">
        <div className="w-full max-w-md rounded-[1.5rem] border border-[#ebe4da] bg-white p-8 shadow-[0_20px_50px_rgba(42,31,24,0.08)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#c9a227]">Secure staff access</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#2a1f18]">Welcome back</h2>
          <p className="mt-2 text-sm text-[#6b5e52]">
            Enter your login details to access the Neeri&apos;s Cleopatra dashboard.
          </p>

          <form className="mt-7 space-y-4" onSubmit={(e) => void submit(e)}>
            <div>
              <label className="field-label" htmlFor="login-email">
                Email address
              </label>
              <div className="relative">
                <FiMail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#c9a227]" />
                <input
                  id="login-email"
                  className="field h-12 pl-10"
                  type="email"
                  autoComplete="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="field-label" htmlFor="login-password">
                Password
              </label>
              <div className="relative">
                <FiLock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8a7b6d]" />
                <input
                  id="login-password"
                  className="field h-12 pl-10 pr-11"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a7b6d] hover:text-[#2a1f18]"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <label className="flex items-center gap-2 text-sm text-[#5c5046]">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-[#d6cbbd] text-[#c9a227] focus:ring-[#c9a227]"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                Remember me
              </label>
              <span className="cursor-default text-sm font-medium text-[#c9a227]">Forgot password?</span>
            </div>

            <button type="submit" disabled={loading} className="btn-primary mt-2 flex h-12 w-full items-center justify-center gap-2 text-base">
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="btn-spinner" /> Signing in…
                </span>
              ) : (
                <>
                  Sign in to dashboard
                  <FiArrowRight />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-[#8a7b6d]">
            <FiShield className="text-[#c9a227]" />
            Your account information is securely protected.
          </p>
        </div>
      </section>
    </div>
  );
}
