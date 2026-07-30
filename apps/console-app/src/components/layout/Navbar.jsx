import { NavLink } from 'react-router-dom';
import { Briefcase, Menu, X } from 'lucide-react';
import { useState } from 'react';
import UserMenu from './UserMenu';
import NotificationBell from './NotificationBell';

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Left: logo + brand name + Jobs */}
        <div className="flex items-center gap-8">
          <NavLink to="/jobs" className="flex items-center gap-2.5 shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-white font-bold text-sm">
              H
            </div>
            <span className="text-lg font-semibold text-heading">Hirekal</span>
          </NavLink>

          <nav className="hidden md:flex items-center">
            <NavLink
              to="/jobs"
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'text-accent bg-accent/5' : 'text-muted hover:text-heading hover:bg-hover'
                }`
              }
            >
              <Briefcase size={18} />
              Jobs
            </NavLink>
          </nav>
        </div>

        {/* Right: notifications + user menu */}
        <div className="flex items-center gap-2">
          <NotificationBell />
          <UserMenu />

          <button
            className="md:hidden rounded-lg p-2 text-muted hover:bg-hover"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="border-t border-border bg-card px-4 py-3 md:hidden">
          <NavLink
            to="/jobs"
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium ${
                isActive ? 'text-accent bg-accent/5' : 'text-muted'
              }`
            }
          >
            <Briefcase size={18} />
            Jobs
          </NavLink>
        </nav>
      )}
    </header>
  );
}
