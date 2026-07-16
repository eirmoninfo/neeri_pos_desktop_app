import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuthStore } from "../store/authStore";

export default function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Logged in");
      navigate("/dashboard");
    } catch {
      toast.error("Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50 px-4">
      <div className="panel w-full max-w-md p-8">
      <div className="mb-5 flex items-center gap-3">
        <img
          src={import.meta.env.VITE_INVOICE_LOGO_URL ?? "assets/images/logo.png"}
          alt="Neeri logo"
          className="h-14 w-14 rounded-xl border border-slate-200 bg-white p-2 object-contain shadow-sm"
        />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Neeri Salon POS</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Welcome back</h1>
        </div>
      </div>
      <p className="mt-1 text-sm text-slate-500">Sign in to continue to your salon dashboard.</p>
      <form className="mt-6 space-y-3" onSubmit={submit}>
        <input className="field h-11" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input
          className="field h-11"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button disabled={loading} className="btn-primary h-11 w-full text-base font-semibold">
          {loading ? "Signing in..." : "Login"}
        </button>
      </form>
      {/* <p className="mt-4 text-xs text-slate-400">Demo: manager@example.com / password</p> */}
      </div>
    </div>
  );
}
