import { useState, useEffect } from "react";

interface MobileViewport {
  overlayStyle: React.CSSProperties;
  panelMaxHeight: number | null;
}

export function useMobileViewport(heightFraction = 0.92): MobileViewport {
  const [overlayStyle, setOverlayStyle] = useState<React.CSSProperties>({});
  const [panelMaxHeight, setPanelMaxHeight] = useState<number | null>(null);

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
      } else {
        setOverlayStyle({});
        setPanelMaxHeight(null);
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

  return { overlayStyle, panelMaxHeight };
}
