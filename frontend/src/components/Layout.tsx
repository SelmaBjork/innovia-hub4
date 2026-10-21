import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const memberLinks = [
  { to: "/resources", label: "Resurser" },
  { to: "/my-bookings", label: "Mina bokningar" },
];

const adminLinks = [
  { to: "/admin/resources", label: "Resurser" },
  { to: "/admin/resource-types", label: "Resurstyper" },
  { to: "/admin/bookings", label: "Alla bokningar" },
  { to: "/admin/occupancy", label: "Beläggning" },
  { to: "/admin/sensors", label: "Sensorer"},
  { to: "/admin/users", label: "Användare" },
];

export function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const links = isAdmin ? adminLinks : memberLinks;
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="sticky top-0 z-20 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-6 min-w-0">
            <span className="font-semibold text-gray-900 dark:text-gray-100 truncate">
              Innovia Hub
            </span>
            <nav className="hidden md:flex gap-1">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
                        : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                isAdmin
                  ? "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300"
                  : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
              }`}
            >
              {isAdmin ? "Admin" : "Member"}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400 max-w-[14rem] truncate">
              {user?.email}
            </span>
            <button
              onClick={() => logout()}
              className="text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              Logga ut
            </button>
          </div>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Öppna meny"
            aria-expanded={menuOpen}
            className="md:hidden -mr-1 flex h-9 w-9 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {menuOpen ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-gray-200 dark:border-gray-800 px-4 py-3 space-y-3">
            <nav className="flex flex-col gap-1">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
                        : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
            <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-800 pt-3">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    isAdmin
                      ? "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300"
                      : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                  }`}
                >
                  {isAdmin ? "Admin" : "Member"}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {user?.email}
                </span>
              </div>
              <button
                onClick={() => logout()}
                className="shrink-0 text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              >
                Logga ut
              </button>
            </div>
          </div>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 md:py-8">
        <Outlet />
      </main>
    </div>
  );
}
