import { getApiBaseUrl, getStoredToken } from '@/lib/apiClient';

export function subscribeToNotificationStream(onUpdate: () => void): () => void {
  const token = getStoredToken();
  if (!token || typeof window === 'undefined' || typeof EventSource === 'undefined') {
    return () => {};
  }

  const baseUrl = getApiBaseUrl().replace(/\/$/, '');
  const streamUrl = `${baseUrl}/notifications/stream?access_token=${encodeURIComponent(token)}`;
  const source = new EventSource(streamUrl);

  const handleUpdate = () => onUpdate();
  const handleError = () => {
    // Allow the browser's built-in EventSource reconnect behavior to continue.
  };

  source.addEventListener('connected', handleUpdate);
  source.addEventListener('notifications-updated', handleUpdate);
  source.onerror = handleError;

  return () => {
    source.removeEventListener('connected', handleUpdate);
    source.removeEventListener('notifications-updated', handleUpdate);
    source.close();
  };
}
