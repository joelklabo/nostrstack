import { useCallback, useEffect, useState } from 'react';

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return 'denied';
    
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    } catch (err) {
      console.error('Failed to request notification permission', err);
      return 'denied';
    }
  }, []);

  const sendLocalNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (permission === 'granted') {
      // Try to use Service Worker registration if available (for better mobile support)
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
          registration.showNotification(title, {
            icon: '/icons/icon-192.svg',
            badge: '/icons/icon-192.svg',
            ...options
          });
        });
      } else {
        new Notification(title, {
          icon: '/icons/icon-192.svg',
          ...options
        });
      }
    }
  }, [permission]);

  return { permission, requestPermission, sendLocalNotification };
}
