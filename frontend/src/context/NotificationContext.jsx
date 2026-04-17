import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { apiFetch } from '../lib/api';

const NotificationContext = createContext(null);

const POLL_INTERVAL_MS = 3000;

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const pollRefs = useRef({});

  const addNotification = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 6000);
  }, []);

  const dismiss = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const stopPoll = useCallback((applicationId) => {
    if (pollRefs.current[applicationId]) {
      clearInterval(pollRefs.current[applicationId]);
      delete pollRefs.current[applicationId];
    }
  }, []);

  const isPolling = useCallback(
    (applicationId) => Boolean(pollRefs.current[applicationId]),
    []
  );

  const startScoringPoll = useCallback(
    (id, label, token, statusUrl) => {
      if (pollRefs.current[id]) return;
      const url = statusUrl || `/api/score/${id}/status`;

      const intervalId = setInterval(async () => {
        try {
          const data = await apiFetch(url, { token });

          if (data.status === 'scored') {
            stopPoll(id);
            addNotification(
              `Scoring complete for "${label}" — score: ${data.ai_score}`,
              'success'
            );
          } else if (data.status === 'scoring_failed') {
            stopPoll(id);
            addNotification(`Scoring failed for "${label}"`, 'error');
          } else if (data.status === 'awaiting_model_selection') {
            stopPoll(id);
            addNotification(`Scoring cancelled for "${label}"`, 'info');
          }
        } catch {
          // Network blip — keep polling
        }
      }, POLL_INTERVAL_MS);

      pollRefs.current[id] = intervalId;
    },
    [addNotification, stopPoll]
  );

  return (
    <NotificationContext.Provider
      value={{ notifications, addNotification, dismiss, startScoringPoll, stopPoll, isPolling }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider');
  return ctx;
}
