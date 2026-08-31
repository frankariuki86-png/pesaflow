import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../contexts/authContext";

export default function Navbar() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const navItems = [
    { path: "/", label: "Dashboard", icon: "📊" },
    { path: "/transactions", label: "Transactions", icon: "💰" },
    { path: "/chama", label: "Chama", icon: "👥" },
    { path: "/business", label: "Business", icon: "💼" },
    { path: "/reports", label: "Reports", icon: "📈" }
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="border-b border-border bg-white shadow-sm sticky top-0 z-50">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald to-teal flex items-center justify-center text-white font-bold text-lg">
              P
            </div>
            <span className="text-xl font-bold text-navy">PesaFlow</span>
          </Link>
          <div className="hidden lg:flex gap-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                  isActive(item.path)
                    ? "bg-emerald text-white"
                    : "text-text hover:bg-slate-100"
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <button
              type="button"
              aria-label="Open profile menu"
              onClick={() => setProfileMenuOpen((open) => !open)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald font-bold text-white"
            >
              {(user?.name || user?.email || "U").charAt(0).toUpperCase()}
            </button>
            {profileMenuOpen && (
              <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-border bg-white p-4 shadow-soft">
                <p className="font-semibold text-text">{user?.name || "User"}</p>
                <p className="mt-1 truncate text-xs text-muted">{user?.email}</p>
                <Link to="/settings" onClick={() => setProfileMenuOpen(false)} className="mt-4 block rounded-xl px-3 py-2 text-sm font-medium text-text hover:bg-slate-100">
                  Profile & Settings
                </Link>
                <button
                  type="button"
                  onClick={() => { setProfileMenuOpen(false); logout(); }}
                  className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
          <Link
            to="/settings"
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              isActive("/settings")
                ? "bg-emerald text-white"
                : "text-text hover:bg-slate-100"
            }`}
          >
            ⚙️ Settings
          </Link>
        </div>
      </div>
    </nav>
  );
}
