import { useEffect, useState } from "react";
import { useAuth } from "../contexts/authContext";
import { supabase } from "../services/supabase";

export default function SettingsPage() {
  const { user, profile, logout, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    setFullName(profile?.full_name || user?.name || "");
    setPhone(profile?.phone || "");
  }, [profile?.full_name, profile?.phone, user?.name]);

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user?.id || !fullName.trim()) return;

    setSavingProfile(true);
    setProfileMessage("");
    setProfileError("");
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim(), phone: phone.trim() || null })
      .eq("id", user.id);

    if (error) setProfileError("Unable to save your profile. Please try again.");
    else {
      await refreshProfile();
      setProfileMessage("Profile saved.");
    }
    setSavingProfile(false);
  };

  const changePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingPassword(true);
    setPasswordMessage("");
    setPasswordError("");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) setPasswordError("Unable to update your password. Please try again.");
    else {
      setNewPassword("");
      setPasswordMessage("Password updated.");
    }
    setSavingPassword(false);
  };

  const handleLogout = () => {
    logout();
    window.location.href = "/login";
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-semibold text-navy">Settings</h1>

      {/* Tabs */}
      <div className="mt-6 flex gap-2 border-b border-border">
        {[
          { id: "profile", label: "Profile" },
          { id: "security", label: "Security" },
          { id: "notifications", label: "Notifications" },
          { id: "preferences", label: "Preferences" }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 font-medium transition border-b-2 ${
              activeTab === tab.id
                ? "border-emerald text-emerald"
                : "border-transparent text-muted hover:text-text"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === "profile" && (
        <div className="mt-8 max-w-2xl">
          <div className="rounded-3xl bg-white p-8 shadow-soft">
            <div className="flex items-center gap-6">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-emerald to-teal flex items-center justify-center text-white text-2xl font-bold">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-navy">{user?.name}</h2>
                <p className="text-muted">{user?.email}</p>
                <p className="text-sm text-emerald font-semibold mt-1">Role: {user?.role}</p>
              </div>
            </div>

            <form className="mt-8 space-y-6" onSubmit={saveProfile}>
              <div>
                <label className="block text-sm font-semibold text-text">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-border px-4 py-3 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text">Email</label>
                <input
                  type="email"
                  value={user?.email || ""}
                  readOnly
                  className="mt-2 w-full rounded-2xl border border-border px-4 py-3 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+254 7XX XXX XXX"
                  className="mt-2 w-full rounded-2xl border border-border px-4 py-3 outline-none"
                />
              </div>
              <div className="pt-4">
                <button type="submit" disabled={savingProfile} className="rounded-2xl bg-emerald px-6 py-3 font-semibold text-white hover:bg-emerald-600 disabled:opacity-70">
                  {savingProfile ? "Saving..." : "Save changes"}
                </button>
              </div>
              {profileMessage && <p className="text-sm text-emerald">{profileMessage}</p>}
              {profileError && <p className="text-sm text-red-600">{profileError}</p>}
            </form>
          </div>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === "security" && (
        <div className="mt-8 max-w-2xl">
          <div className="rounded-3xl bg-white p-8 shadow-soft space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-navy">Change password</h3>
              <p className="text-sm text-muted mt-1">Update your password regularly to keep your account secure</p>
              <form className="mt-4 space-y-4" onSubmit={changePassword}>
                <input type="password" placeholder="New password" minLength={8} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="w-full rounded-2xl border border-border px-4 py-3 outline-none" />
                <button type="submit" disabled={savingPassword} className="rounded-2xl bg-emerald px-6 py-3 font-semibold text-white hover:bg-emerald-600 disabled:opacity-70">
                  {savingPassword ? "Updating..." : "Update password"}
                </button>
                {passwordMessage && <p className="text-sm text-emerald">{passwordMessage}</p>}
                {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
              </form>
            </div>

            <div className="border-t border-border pt-6">
              <h3 className="text-lg font-semibold text-navy">Two-factor authentication</h3>
              <p className="text-sm text-muted mt-1">Add an extra layer of security to your account</p>
              <button className="mt-4 rounded-2xl border-2 border-emerald px-6 py-3 font-semibold text-emerald hover:bg-emerald-50">
                Enable 2FA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === "notifications" && (
        <div className="mt-8 max-w-2xl">
          <div className="rounded-3xl bg-white p-8 shadow-soft space-y-6">
            {[
              { name: "Transaction alerts", desc: "Get notified of all transactions" },
              { name: "Budget warnings", desc: "Alerts when you're close to budget limit" },
              { name: "Goal milestones", desc: "Celebrate when you reach savings goals" },
              { name: "Bill reminders", desc: "Reminders for upcoming bills and payments" },
              { name: "Weekly summary", desc: "Get a weekly spending summary" },
              { name: "Chama updates", desc: "Updates from your Chama groups" }
            ].map((notif, idx) => (
              <div key={idx} className="flex items-center justify-between py-4 border-b border-border last:border-0">
                <div>
                  <p className="font-semibold text-text">{notif.name}</p>
                  <p className="text-sm text-muted">{notif.desc}</p>
                </div>
                <input type="checkbox" defaultChecked className="h-5 w-5 rounded border-emerald" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preferences Tab */}
      {activeTab === "preferences" && (
        <div className="mt-8 max-w-2xl">
          <div className="rounded-3xl bg-white p-8 shadow-soft space-y-6">
            <div>
              <label className="block text-sm font-semibold text-text">Currency</label>
              <select className="mt-2 w-full rounded-2xl border border-border px-4 py-3 outline-none">
                <option>KES - Kenyan Shilling</option>
                <option>USD - US Dollar</option>
                <option>EUR - Euro</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-text">Language</label>
              <select className="mt-2 w-full rounded-2xl border border-border px-4 py-3 outline-none">
                <option>English</option>
                <option>Swahili</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-text">Theme</label>
              <div className="mt-2 flex gap-4">
                <label className="flex items-center gap-2">
                  <input type="radio" name="theme" defaultChecked />
                  <span>Light</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="theme" />
                  <span>Dark</span>
                </label>
              </div>
            </div>
            <div className="border-t border-border pt-6">
              <button className="rounded-2xl bg-emerald px-6 py-3 font-semibold text-white hover:bg-emerald-600">
                Save preferences
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout Section */}
      <div className="mt-8 rounded-3xl bg-red-50 p-8 border-2 border-red-200 max-w-2xl">
        <h3 className="text-lg font-semibold text-red-700">Danger zone</h3>
        <p className="text-sm text-red-600 mt-2">Once you logout, you'll need to sign in again to access your account</p>
        <button
          onClick={handleLogout}
          className="mt-4 rounded-2xl bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
