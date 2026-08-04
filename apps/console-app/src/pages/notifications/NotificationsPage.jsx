import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import * as notificationService from '../../services/notificationService';
import { formatRelative } from '../../utils/formatDate';

const POLL_INTERVAL_MS = 30_000;
const PAGE_SIZE = notificationService.NOTIFICATIONS_PAGE_SIZE;

function mergeIncomingPage(prev, pageItems) {
  const updated = new Map(pageItems.map((n) => [n.id, n]));
  const prevIds = new Set(prev.map((n) => n.id));
  const fresh = pageItems.filter((n) => !prevIds.has(n.id));
  const mergedPrev = prev.map((n) =>
    updated.has(n.id) ? { ...n, ...updated.get(n.id) } : n,
  );
  return [...fresh, ...mergedPrev];
}

export default function NotificationsPage() {
  const { showError, showSuccess } = useToast();
  const [notifications, setNotifications] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const sentinelRef = useRef(null);
  const loadingMoreRef = useRef(false);
  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;

  const hasMore = notifications.length < total;

  const loadPage = useCallback(async (pageToLoad, { append, silent }) => {
    if (append) {
      if (loadingMoreRef.current) return;
      loadingMoreRef.current = true;
      setLoadingMore(true);
    }

    try {
      const result = await notificationService.getNotifications({
        page: pageToLoad,
        limit: PAGE_SIZE,
      });

      setTotal(result.total);
      setPage(result.page);
      setNotifications((prev) =>
        append
          ? [
              ...prev,
              ...result.items.filter(
                (item) => !prev.some((existing) => existing.id === item.id),
              ),
            ]
          : pageToLoad === 1 && prev.length > 0
            ? mergeIncomingPage(prev, result.items)
            : result.items,
      );
      setLoadFailed(false);
    } catch (err) {
      if (!silent) {
        showErrorRef.current(err, append
          ? 'Failed to load more notifications'
          : 'Failed to load notifications');
      }
      if (!append) setLoadFailed(true);
    } finally {
      setLoading(false);
      if (append) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      if (cancelled) return;
      await loadPage(1, { append: false, silent: false });
    };

    bootstrap();
    const timer = setInterval(() => {
      if (!cancelled) {
        void loadPage(1, { append: false, silent: true });
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [loadPage]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || loading || !hasMore) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (loadingMoreRef.current) return;
        void loadPage(page + 1, { append: true, silent: false });
      },
      { rootMargin: '160px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, loadPage, page, notifications.length]);

  const handleMarkRead = async (id) => {
    const previous = notifications;
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    try {
      await notificationService.markNotificationRead(id);
    } catch (err) {
      setNotifications(previous);
      showError(err, 'Failed to mark notification as read');
    }
  };

  const handleMarkAllRead = async () => {
    const previous = notifications;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await notificationService.markAllNotificationsRead();
      showSuccess('All notifications marked as read');
    } catch (err) {
      setNotifications(previous);
      showError(err, 'Failed to mark all notifications as read');
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div>
      <PageHeader
        title="Notifications"
        description={
          unreadCount > 0
            ? `${unreadCount} unread`
            : 'All caught up'
        }
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
      ) : loadFailed && notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Unable to load"
          description="Something went wrong. Please try again."
        />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications"
          description="You're all caught up!"
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => !notif.read && handleMarkRead(notif.id)}
              className={`cursor-pointer rounded-xl border p-4 transition-colors ${
                notif.read
                  ? 'border-border bg-card'
                  : 'border-accent/20 bg-accent/5 hover:bg-accent/10'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-heading">
                    {!notif.read && (
                      <span className="mr-2 inline-block h-2 w-2 rounded-full bg-accent" />
                    )}
                    {notif.title}
                  </p>
                  <p className="mt-1 text-sm text-muted">{notif.message}</p>
                </div>
                <span className="shrink-0 text-xs text-muted">
                  {formatRelative(notif.timestamp)}
                </span>
              </div>
            </div>
          ))}

          <div ref={sentinelRef} className="h-8 w-full" aria-hidden />

          {loadingMore && (
            <div className="py-3">
              <LoadingSpinner message="Loading more..." />
            </div>
          )}

          {!hasMore && notifications.length > 0 && (
            <p className="py-3 text-center text-xs text-muted">
              Showing all {total} notification{total === 1 ? '' : 's'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
