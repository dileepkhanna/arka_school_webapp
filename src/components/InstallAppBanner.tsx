import { useState } from 'react';
import { Download, X, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';

export default function InstallAppBanner() {
  const { canInstall, isInstalled, isIOS, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(() => {
    return sessionStorage.getItem('pwa-banner-dismissed') === 'true';
  });

  if (isInstalled || dismissed) return null;
  if (!canInstall && !isIOS) return null;

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('pwa-banner-dismissed', 'true');
  };

  return (
    <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-3 flex items-center gap-3 mx-4 mt-2 lg:mx-6">
      <Download className="h-5 w-5 text-primary flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Install SmartEduConnect</p>
        {isIOS ? (
          <p className="text-xs text-muted-foreground">
            Tap <Share className="inline h-3 w-3" /> then "Add to Home Screen"
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Get quick access from your home screen
          </p>
        )}
      </div>
      {canInstall && (
        <Button size="sm" onClick={promptInstall} className="flex-shrink-0">
          Install
        </Button>
      )}
      <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground p-1">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
