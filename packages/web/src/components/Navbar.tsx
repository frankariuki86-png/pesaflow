import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../contexts/authContext";

export default function Navbar() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { path: "/", label: "Dashboard", icon: "📊" },
    { path: "/transactions", label: "Transactions", icon: "💰" },
    { path: "/accounts", label: "Accounts", icon: "🏦" },
    { path: "/goals", label: "Goals", icon: "🎯" },
    { path: "/chama", label: "Chama", icon: "👥" },
    { path: "/business", label: "Business", icon: "💼" },
    { path: "/reports", label: "Reports", icon: "📈" },
  ];

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-white shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Open navigation menu"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border text-lg text-navy lg:hidden"
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            ☰
          </button>

          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald to-teal text-lg font-bold text-white">
              P
            </div>
            <span className="text-lg font-bold text-navy sm:text-xl">PesaFlow</span>
          </Link>

          <div className="hidden gap-1 lg:flex">
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

        <div className="flex items-center gap-3">
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
                <p className="mt-1 truncate text-xs text-muted">{user?.email || "user@example.com"}</p>
                <Link
                  to="/settings"
                  onClick={() => setProfileMenuOpen(false)}
                  className="mt-4 block rounded-xl px-3 py-2 text-sm font-medium text-text hover:bg-slate-100"
                >
                  Profile & Settings
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    logout();
                  }}
                  className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>

          <Link
            to="/settings"
            className={`hidden rounded-lg px-3 py-2 text-sm font-medium transition sm:inline-flex ${
              isActive("/settings")
                ? "bg-emerald text-white"
                : "text-text hover:bg-slate-100"
            }`}
          >
            ⚙️ Settings
          </Link>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-border bg-white lg:hidden">
          <div className="space-y-1 p-3">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${
                  isActive(item.path)
                    ? "bg-emerald text-white"
                    : "text-text hover:bg-slate-100"
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            ))}
            <Link
              to="/settings"
              onClick={() => setMobileMenuOpen(false)}
              className={`mt-2 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${
                isActive("/settings")
                  ? "bg-emerald text-white"
                  : "text-text hover:bg-slate-100"
              }`}
            >
              <span>⚙️</span>
              Profile & Settings
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
