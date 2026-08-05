import { NavLink, useLocation } from 'react-router-dom';
import { Briefcase, Building2, CreditCard, LifeBuoy, Menu, Wallet, X } from 'lucide-react';
import { useState } from 'react';
import UserMenu from './UserMenu';
import NotificationBell from './NotificationBell';
import { useAuth } from '../../context/AuthContext';
import { isAdmin } from '../../utils/roles';

const navLinkClass = ({ isActive }) =>
  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'text-accent bg-accent/5' : 'text-muted hover:text-heading hover:bg-hover'
  }`;

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuth();
  const canManageBilling = isAdmin(user);
  const billingActive = location.pathname.startsWith('/billing');
  const paymentsActive = location.pathname.startsWith('/payments');

  const supportActive = location.pathname.startsWith('/support');

  const navItems = [
    { to: '/jobs', label: 'Jobs', icon: Briefcase, isActive: location.pathname.startsWith('/jobs') },
    ...(canManageBilling
      ? [
          { to: '/billing/plans', label: 'Billing', icon: CreditCard, isActive: billingActive },
          { to: '/payments', label: 'Payments', icon: Wallet, isActive: paymentsActive },
        ]
      : []),
    { to: '/support', label: 'Support', icon: LifeBuoy, isActive: supportActive },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Left: logo + brand name + nav */}
        <div className="flex items-center gap-8">
          <NavLink to="/jobs" className="flex items-center shrink-0">
            <img
              src="/logo-light.png"
              alt="Hirekal"
              className="h-8 w-auto dark:hidden"
            />
            <img
              src="/logo-dark.png"
              alt="Hirekal"
              className="hidden h-8 w-auto dark:block"
            />
          </NavLink>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(({ to, label, icon: Icon, isActive }) => (
              <NavLink
                key={to}
                to={to}
                className={navLinkClass({ isActive })}
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Right: notifications + user menu */}
        <div className="flex items-center gap-2">
          <NotificationBell />
          <NavLink
            to="/organization"
            className={({ isActive }) =>
              `flex h-10 items-center gap-2 rounded-lg px-2.5 transition-colors sm:px-3 ${
                isActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-muted hover:bg-hover hover:text-heading'
              }`
            }
            aria-label="Organization"
          >
            <Building2 size={20} />
            <span className="hidden sm:inline text-sm font-medium">Organization</span>
          </NavLink>
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
        <nav className="border-t border-border bg-card px-4 py-3 md:hidden space-y-1">
          {navItems.map(({ to, label, icon: Icon, isActive }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              className={navLinkClass({ isActive })}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}
