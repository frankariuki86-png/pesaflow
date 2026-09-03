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
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const validateForm = () => {
    const normalizedEmail = email.trim();
    if (mode === "signup" && !name.trim()) return "Please enter your name.";
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return "Please enter a valid email address.";
    if (!forgotPassword && password.length < 8) return "Password must be at least 8 characters long.";
    if (!forgotPassword && mode === "signup" && !/[A-Za-z]/.test(password)) return "Password must include at least one letter.";
    if (!forgotPassword && mode === "signup" && !/\d/.test(password)) return "Password must include at least one number.";
    return "";
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      if (forgotPassword) {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/settings`,
        });
        if (resetError) throw resetError;
        setSuccess("Password reset instructions have been sent to your email.");
        return;
      }

      const result = mode === "signin"
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim(), phone: phone.trim() } } });
      if (result.error) throw result.error;
      if (mode === "signup" && result.data.user && result.data.user.identities?.length === 0) {
        setError("An account with this email already exists. Please sign in instead.");
        return;
      }
      if (mode === "signup" && !result.data.session) {
        setSuccess("Account created. Check your email to confirm your address before signing in.");
      } else {
        navigate("/");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message.toLowerCase() : "";
      console.error("Authentication request failed", err);
      if (message.includes("already registered") || message.includes("already exists") || message.includes("user already registered")) {
        setError("An account with this email already exists. Please sign in instead.");
      } else if (message.includes("invalid login credentials")) {
        setError("Incorrect email or password.");
      } else if (message.includes("email not confirmed")) {
        setError("Please confirm your email address before signing in.");
      } else if (message.includes("password")) {
        setError("Password does not meet the required requirements.");
      } else if (message.includes("email")) {
        setError("Please enter a valid email address.");
      } else {
        setError(mode === "signup" ? "Unable to create your account. Please try again." : "Unable to sign in. Please try again.");
      }
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
          {error && <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-red-700">{error}</div>}
          {success && <div role="status" className="rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-700">{success}</div>}
          <button type="submit" disabled={loading} className="w-full rounded-2xl bg-primary px-4 py-3 text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70">
            {loading ? "Please wait..." : forgotPassword ? "Send reset email" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
          {mode === "signin" && !forgotPassword && <button type="button" onClick={() => { setForgotPassword(true); setError(""); }} className="w-full text-sm font-medium text-primary hover:underline">
            Forgot password?
          </button>}
          <button type="button" onClick={() => { setForgotPassword(false); setMode(mode === "signin" ? "signup" : "signin"); setError(""); setSuccess(""); }} className="w-full text-sm font-medium text-primary hover:underline">
            {forgotPassword ? "Back to sign in" : mode === "signin" ? "New to PesaFlow? Create an account" : "Already have an account? Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
