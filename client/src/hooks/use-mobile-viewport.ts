import { useState, useEffect } from "react";

interface MobileViewport {
  overlayStyle: React.CSSProperties;
  panelMaxHeight: number | null;
  isKeyboardOpen: boolean;
}

const KEYBOARD_THRESHOLD = 100;

export function useMobileViewport(heightFraction = 0.92): MobileViewport {
  const [overlayStyle, setOverlayStyle] = useState<React.CSSProperties>({});
  const [panelMaxHeight, setPanelMaxHeight] = useState<number | null>(null);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => {
      if (mq.matches) {
        const h = vv.height;
        const top = vv.offsetTop;
        setOverlayStyle({ height: h, top });
        setPanelMaxHeight(h * heightFraction);
        setIsKeyboardOpen(window.innerHeight - h > KEYBOARD_THRESHOLD);
      } else {
        setOverlayStyle({});
        setPanelMaxHeight(null);
        setIsKeyboardOpen(false);
      }
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    mq.addEventListener("change", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      mq.removeEventListener("change", update);
    };
  }, [heightFraction]);

  return { overlayStyle, panelMaxHeight, isKeyboardOpen };
}
