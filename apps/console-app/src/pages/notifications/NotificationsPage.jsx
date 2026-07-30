import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import * as settingsService from '../../services/settingsService';
import { formatRelative } from '../../utils/formatDate';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    settingsService.getNotifications().then(setNotifications).finally(() => setLoading(false));
  }, []);

  const handleMarkRead = async (id) => {
    await settingsService.markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const handleMarkAllRead = async () => {
    const updated = await settingsService.markAllNotificationsRead();
    setNotifications(updated);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div>
      <PageHeader
        title="Notifications"
        description={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
        actions={
          unreadCount > 0 && (
            <Button variant="secondary" size="sm" onClick={handleMarkAllRead}>
              Mark all as read
            </Button>
          )
        }
      />

      {loading ? (
        <LoadingSpinner />
      ) : notifications.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" description="You're all caught up!" />
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => !notif.read && handleMarkRead(notif.id)}
              className={`rounded-xl border p-4 cursor-pointer transition-colors ${
                notif.read
                  ? 'border-border bg-white'
                  : 'border-accent/20 bg-accent/5 hover:bg-accent/10'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className={`text-sm font-medium ${notif.read ? 'text-heading' : 'text-heading'}`}>
                    {!notif.read && <span className="inline-block h-2 w-2 rounded-full bg-accent mr-2" />}
                    {notif.title}
                  </p>
                  <p className="mt-1 text-sm text-muted">{notif.message}</p>
                </div>
                <span className="text-xs text-muted shrink-0">{formatRelative(notif.timestamp)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
