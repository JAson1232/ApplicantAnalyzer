import { useNotifications } from '../context/NotificationContext';

export default function ToastContainer() {
  const { notifications, dismiss } = useNotifications();

  if (!notifications.length) return null;

  return (
    <div className="fixed right-4 top-4 z-50 flex flex-col gap-2">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`flex max-w-sm items-start gap-3 rounded-lg px-4 py-3 text-sm shadow-lg
            ${n.type === 'error' ? 'bg-rose-900 text-rose-100' : 'bg-emerald-900 text-emerald-100'}`}
        >
          <span className="flex-1">{n.message}</span>
          <button
            onClick={() => dismiss(n.id)}
            className="opacity-60 transition-opacity hover:opacity-100"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
