import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "fuelr-install-dismissed";

function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as Record<string, unknown>).MSStream;
  if (!isIos) return false;
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
  return isSafari;
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
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) === "1");

  useEffect(() => {
    if (isStandalone() || dismissed) return;

    if (isIosSafari()) {
      setShowIosBanner(true);
      return;
    }

    if (window.__deferredInstallPrompt) {
      setDeferredPrompt(window.__deferredInstallPrompt as BeforeInstallPromptEvent);
      delete window.__deferredInstallPrompt;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [dismissed]);

  function dismiss() {
    setDismissed(true);
    setDeferredPrompt(null);
    setShowIosBanner(false);
    sessionStorage.setItem(DISMISS_KEY, "1");
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
