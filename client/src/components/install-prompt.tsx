import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, Share, SquarePlus, ChevronRight } from "lucide-react";

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

function IosGuideModal({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50"
      onClick={onClose}
      data-testid="ios-guide-overlay"
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="w-full max-w-md bg-zinc-900 text-white rounded-t-3xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
        data-testid="ios-guide-sheet"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold">Install Fuelr</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            data-testid="button-ios-guide-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-4" data-testid="ios-guide-step-1">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-blue-400 text-sm font-bold">1</span>
            </div>
            <div className="flex-1 pt-1.5">
              <p className="text-sm font-medium leading-tight">
                Tap the <Share className="w-4 h-4 inline-block mx-0.5 -mt-0.5" /> Share button
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                Find it at the bottom of your Safari toolbar
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4" data-testid="ios-guide-step-2">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-blue-400 text-sm font-bold">2</span>
            </div>
            <div className="flex-1 pt-1.5">
              <p className="text-sm font-medium leading-tight">
                Tap <SquarePlus className="w-4 h-4 inline-block mx-0.5 -mt-0.5" /> Add to Home Screen
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                Scroll down in the share menu if you don't see it
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-6 py-3 bg-white text-zinc-900 rounded-xl text-sm font-semibold hover:bg-zinc-100 transition-colors"
          data-testid="button-ios-guide-got-it"
        >
          Got it
        </button>
      </motion.div>
    </motion.div>
  );
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosBanner, setShowIosBanner] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) === "1");

  useEffect(() => {
    if (isStandalone() || dismissed) return;

    if (isIosSafari()) {
      setShowIosBanner(true);
      return;
    }

    if (window.__deferredInstallPrompt) {
      setDeferredPrompt(window.__deferredInstallPrompt as BeforeInstallPromptEvent);
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
    delete window.__deferredInstallPrompt;
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
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.25 }}
          className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] sm:bottom-6 left-4 right-4 z-[48] max-w-md mx-auto"
          data-testid="install-prompt-banner"
        >
          <div
            className={`bg-zinc-900 text-white rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3${showIos ? " cursor-pointer active:bg-zinc-800" : ""}`}
            onClick={showIos ? () => setShowGuide(true) : undefined}
          >
            <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <Download className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-tight">Add Fuelr to your home screen</p>
              {showIos && (
                <p className="text-xs text-zinc-400 mt-0.5">
                  Tap to see how
                </p>
              )}
            </div>
            {showIos && (
              <button
                onClick={() => setShowGuide(true)}
                className="px-3.5 py-1.5 bg-white text-zinc-900 rounded-lg text-xs font-semibold hover:bg-zinc-100 transition-colors flex-shrink-0 flex items-center gap-1"
                data-testid="button-ios-show-guide"
              >
                Show me
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
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
              onClick={(e) => { e.stopPropagation(); dismiss(); }}
              className="p-1 text-zinc-400 hover:text-white transition-colors flex-shrink-0"
              data-testid="button-pwa-dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {showGuide && (
          <IosGuideModal onClose={() => setShowGuide(false)} />
        )}
      </AnimatePresence>
    </>
  );
}
