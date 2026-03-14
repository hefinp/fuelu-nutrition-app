import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as Record<string, unknown>).MSStream;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as Record<string, boolean>).standalone === true
  );
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosBanner, setShowIosBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    if (isIos()) {
      const iosDismissed = sessionStorage.getItem("fuelr-ios-install-dismissed");
      if (!iosDismissed) setShowIosBanner(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    setDismissed(true);
    setDeferredPrompt(null);
    setShowIosBanner(false);
    sessionStorage.setItem("fuelr-ios-install-dismissed", "1");
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
    dismiss();
  }

  const showAndroid = !!deferredPrompt && !dismissed;
  const showIos = showIosBanner && !dismissed;

  if (!showAndroid && !showIos) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.25 }}
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] sm:bottom-6 left-4 right-4 z-[48] max-w-md mx-auto"
        data-testid="install-prompt-banner"
      >
        <div className="bg-zinc-900 text-white rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <Download className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-tight">Add Fuelr to your home screen</p>
            {showIos && (
              <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1">
                Tap <Share className="w-3 h-3 inline" /> then "Add to Home Screen"
              </p>
            )}
          </div>
          {showAndroid && (
            <button
              onClick={handleInstall}
              className="px-3.5 py-1.5 bg-white text-zinc-900 rounded-lg text-xs font-semibold hover:bg-zinc-100 transition-colors flex-shrink-0"
              data-testid="button-pwa-install"
            >
              Install
            </button>
          )}
          <button
            onClick={dismiss}
            className="p-1 text-zinc-400 hover:text-white transition-colors flex-shrink-0"
            data-testid="button-pwa-dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
