import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";

export default function LoginPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [forgotPassword, setForgotPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (forgotPassword) {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/settings`,
        });
        if (resetError) throw resetError;
        setError("Password reset instructions have been sent to your email.");
        return;
      }

      const result = mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { data: { full_name: name, phone } } });
      if (result.error) throw result.error;
      if (mode === "signup" && !result.data.session) {
        setError("Account created. Check your email to confirm your address.");
      } else {
        navigate("/");
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || "Unable to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-soft">
        <h1 className="text-3xl font-semibold text-navy">{forgotPassword ? "Reset your password" : mode === "signin" ? "Welcome back" : "Create your account"}</h1>
        <p className="mt-2 text-muted">Manage your money, Chama, and business performance.</p>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {mode === "signup" && !forgotPassword && <div>
            <label className="block text-sm font-medium text-text">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} type="text" required className="mt-2 w-full rounded-2xl border border-border bg-surface px-4 py-3 outline-none transition focus:border-primary" />
          </div>}
          {mode === "signup" && !forgotPassword && <div>
            <label className="block text-sm font-medium text-text">Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" className="mt-2 w-full rounded-2xl border border-border bg-surface px-4 py-3 outline-none transition focus:border-primary" />
          </div>}
          <div>
            <label className="block text-sm font-medium text-text">Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="mt-2 w-full rounded-2xl border border-border bg-surface px-4 py-3 outline-none transition focus:border-primary" />
          </div>
          {!forgotPassword && <div>
            <label className="block text-sm font-medium text-text">Password</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required className="mt-2 w-full rounded-2xl border border-border bg-surface px-4 py-3 outline-none transition focus:border-primary" />
          </div>}
          {error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-red-700">{error}</div>}
          <button type="submit" disabled={loading} className="w-full rounded-2xl bg-primary px-4 py-3 text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70">
            {loading ? "Please wait..." : forgotPassword ? "Send reset email" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
          {mode === "signin" && !forgotPassword && <button type="button" onClick={() => { setForgotPassword(true); setError(""); }} className="w-full text-sm font-medium text-primary hover:underline">
            Forgot password?
          </button>}
          <button type="button" onClick={() => { setForgotPassword(false); setMode(mode === "signin" ? "signup" : "signin"); setError(""); }} className="w-full text-sm font-medium text-primary hover:underline">
            {forgotPassword ? "Back to sign in" : mode === "signin" ? "New to PesaFlow? Create an account" : "Already have an account? Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
