import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../services/supabase";

interface AppUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  role: string;
  onboarding_complete: boolean;
}

interface AuthContextValue {
  token: string | null;
  user: AppUser | null;
  profile: Profile | null;
  loading: boolean;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const user = session?.user ? {
    id: session.user.id,
    name: profile?.full_name || session.user.user_metadata.full_name || session.user.email?.split("@")[0] || "User",
    email: session.user.email || "",
    role: profile?.role || session.user.app_metadata.role || "INDIVIDUAL",
  } : null;

  const refreshProfile = async () => {
    if (!session?.user.id) {
      setProfile(null);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, phone, role, onboarding_complete")
      .eq("id", session.user.id)
      .maybeSingle();

    if (error) {
      console.error("Unable to load profile", error);
      return;
    }

    setProfile(data as Profile | null);
  };

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (mounted) {
        setSession(currentSession);
        if (!currentSession) setProfile(null);
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) {
        setSession(nextSession);
        if (!nextSession) setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session) void refreshProfile();
  }, [session?.user.id]);

  const logout = () => { void supabase.auth.signOut(); };

  return <AuthContext.Provider value={{ token: session?.access_token || null, user, profile, loading, logout, refreshProfile }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
