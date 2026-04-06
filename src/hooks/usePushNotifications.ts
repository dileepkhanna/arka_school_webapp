/// <reference lib="webworker" />

declare global {
  interface ServiceWorkerRegistration {
    readonly pushManager: PushManager;
  }

  interface PushManager {
    getSubscription(): Promise<PushSubscription | null>;
    subscribe(options: PushSubscriptionOptionsInit): Promise<PushSubscription>;
  }
}

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/apiClient';

type PushStatus = 'unsupported' | 'default' | 'granted' | 'denied' | 'subscribed' | 'loading';

const SERVICE_WORKER_READY_TIMEOUT_MS = 8000;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) return undefined;

  const timeoutPromise = new Promise<null>((resolve) => {
    window.setTimeout(() => resolve(null), SERVICE_WORKER_READY_TIMEOUT_MS);
  });

  const readyRegistration = await Promise.race([
    navigator.serviceWorker.ready,
    timeoutPromise,
  ]);

  if (readyRegistration) {
    return readyRegistration as ServiceWorkerRegistration;
  }

  return navigator.serviceWorker.getRegistration();
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [status, setStatus] = useState<PushStatus>('loading');
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [configError, setConfigError] = useState(false);

  const updateBrowserPushStatus = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported');
      return;
    }

    const permission = Notification.permission;
    if (permission === 'denied') {
      setStatus('denied');
      return;
    }

    try {
      const registration = await getServiceWorkerRegistration();
      if (!registration) {
        setStatus(permission === 'granted' ? 'granted' : 'default');
        return;
      }

      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        setStatus('subscribed');
      } else {
        setStatus(permission === 'granted' ? 'granted' : 'default');
      }
    } catch (error) {
      console.error('Failed to detect push subscription status:', error);
      setStatus(permission === 'granted' ? 'granted' : 'default');
    }
  }, []);

  const fetchVapidKey = useCallback(async () => {
    let attempts = 0;
    while (attempts < 2) {
      try {
        const data = await apiClient.get<{ publicKey?: string; configured?: boolean }>('/notifications/push/vapid-key');
        const key = data.publicKey || '';
        setVapidPublicKey(key || null);
        setIsConfigured(Boolean(data.configured && key));
        setConfigError(false);
        return;
      } catch (err) {
        attempts += 1;
        if (attempts >= 2) {
          console.error('Failed to fetch VAPID key:', err);
          setConfigError(true);
          return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 400));
      }
    }
  }, []);

  const syncExistingSubscription = useCallback(async () => {
    if (!user) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    try {
      const registration = await getServiceWorkerRegistration();
      if (!registration) return;

      const existing = await registration.pushManager.getSubscription();
      if (!existing) return;

      const subJson = existing.toJSON();
      if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) return;

      await apiClient.post('/notifications/push/subscribe', {
        endpoint: subJson.endpoint,
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth,
      });

      setStatus('subscribed');
    } catch (error) {
      console.error('Failed to sync existing push subscription:', error);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setStatus('default');
      setVapidPublicKey(null);
      setIsConfigured(false);
      setConfigError(false);
      return;
    }

    void updateBrowserPushStatus();
    void fetchVapidKey();
    void syncExistingSubscription();
  }, [user, updateBrowserPushStatus, fetchVapidKey, syncExistingSubscription]);

  const subscribe = useCallback(async () => {
    if (!user || !vapidPublicKey || !isConfigured) return false;

    try {
      setStatus('loading');

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus('denied');
        return false;
      }

      const reg = await getServiceWorkerRegistration();
      if (!reg) {
        setStatus('default');
        console.error('Push subscription failed: service worker registration not found');
        return false;
      }

      let subscription = await reg.pushManager.getSubscription();
      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }

      const subJson = subscription.toJSON();

      await apiClient.post('/notifications/push/subscribe', {
        endpoint: subJson.endpoint,
        p256dh: subJson.keys?.p256dh || '',
        auth: subJson.keys?.auth || '',
      });

      setStatus('subscribed');
      return true;
    } catch (err) {
      console.error('Push subscription failed:', err);
      setStatus('default');
      return false;
    }
  }, [user, vapidPublicKey, isConfigured]);

  const unsubscribe = useCallback(async () => {
    if (!user) return;
    try {
      const reg = await getServiceWorkerRegistration();
      if (!reg) {
        setStatus('default');
        return;
      }

      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await apiClient.post('/notifications/push/unsubscribe', { endpoint });
      }
      setStatus('default');
    } catch (err) {
      console.error('Unsubscribe failed:', err);
    }
  }, [user]);

  return {
    status,
    isSupported: status !== 'unsupported',
    isSubscribed: status === 'subscribed',
    isDenied: status === 'denied',
    isLoading: status === 'loading',
    isConfigured,
    configError,
    subscribe,
    unsubscribe,
  };
}
