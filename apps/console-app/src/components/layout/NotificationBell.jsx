import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Bell } from 'lucide-react';
import * as settingsService from '../../services/settingsService';

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    settingsService.getNotifications().then((items) => {
      setUnreadCount(items.filter((n) => !n.read).length);
    });
  }, []);

  return (
    <NavLink
      to="/notifications"
      className={({ isActive }) =>
        `relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
          isActive
            ? 'bg-accent/10 text-accent'
            : 'text-muted hover:bg-gray-100 hover:text-heading'
        }`
      }
      aria-label="Notifications"
    >
      <Bell size={20} />
      {unreadCount > 0 && (
        <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </NavLink>
  );
}
