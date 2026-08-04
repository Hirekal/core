import { useRef, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, User, Building2, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate('/login');
  };

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'U';

  const menuItems = [
    {
      label: 'My Account',
      description: 'Profile & password settings',
      icon: User,
      to: '/profile',
    },
    {
      label: 'Organization',
      description: 'Company & team info',
      icon: Building2,
      to: '/organization',
    },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 sm:px-3 transition-colors ${
          open ? 'border-accent/30 bg-accent/5' : 'border-border bg-card hover:bg-hover'
        }`}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white">
          {initials}
        </div>
        <span className="hidden sm:block text-sm font-medium text-heading max-w-[120px] truncate">
          {user?.name?.split(' ')[0] || 'User'}
        </span>
        <ChevronDown
          size={16}
          className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          <div className="border-b border-border px-4 py-3 bg-surface">
            <p className="text-sm font-semibold text-heading">{user?.name}</p>
            <p className="text-xs text-muted truncate">{user?.email}</p>
          </div>

          <div className="py-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const content = (
                <>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-hover text-muted">
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-heading">{item.label}</p>
                    <p className="text-xs text-muted">{item.description}</p>
                  </div>
                </>
              );

              if (item.to) {
                return (
                  <Link
                    key={item.label}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-hover transition-colors"
                  >
                    {content}
                  </Link>
                );
              }

              return (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={(e) => {
                    item.onClick?.(e);
                    setOpen(false);
                  }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-hover transition-colors"
                >
                  {content}
                </a>
              );
            })}
          </div>

          <div className="border-t border-border py-1">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950/40">
                <LogOut size={16} />
              </div>
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
