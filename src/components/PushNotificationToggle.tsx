import { BellRing, BellOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { toast } from 'sonner';

export default function PushNotificationToggle() {
  const { isSupported, isSubscribed, isDenied, isLoading, isConfigured, configError, subscribe, unsubscribe } = usePushNotifications();

  if (!isSupported) return null;

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
      toast.success('Push notifications disabled');
    } else if (configError) {
      toast.error('Could not verify push configuration right now. Please retry in a moment.');
    } else if (!isConfigured) {
      toast.error('Push notifications are not configured yet. Add VAPID keys in backend environment.');
    } else if (isDenied) {
      toast.error('Notifications are blocked. Please enable them in your browser settings.');
    } else {
      const success = await subscribe();
      if (success) {
        toast.success('Push notifications enabled! You will receive alerts even when the app is closed.');
      }
    }
  };

  const label = isSubscribed
    ? 'Push notifications on'
    : configError
    ? 'Push configuration check failed'
    : !isConfigured
    ? 'Push notifications not configured'
    : isDenied
    ? 'Notifications blocked'
    : 'Enable push notifications';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggle}
            disabled={isLoading}
            className="relative"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isSubscribed ? (
              <BellRing className="h-5 w-5 text-primary" />
            ) : (
              <BellOff className="h-5 w-5 text-muted-foreground" />
            )}
            {isSubscribed && (
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
