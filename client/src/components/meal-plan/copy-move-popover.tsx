import { useRef, useLayoutEffect, useState } from "react";
import { motion } from "framer-motion";
import { Copy, Move, Replace, X } from "lucide-react";
import type { CopyMovePopoverState } from "./types";

interface CopyMovePopoverProps {
  popover: CopyMovePopoverState;
  onCopyMove: (action: 'copy' | 'move') => void;
  onReplace: () => void;
  onClose: () => void;
}

export function CopyMovePopover({ popover, onCopyMove, onReplace, onClose }: CopyMovePopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: popover.x, top: popover.y - 8 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = popover.x - rect.width / 2;
    let top = popover.y - 8 - rect.height;
    if (left < pad) left = pad;
    if (left + rect.width > vw - pad) left = vw - pad - rect.width;
    if (top < pad) top = pad;
    if (top + rect.height > vh - pad) top = vh - pad - rect.height;
    setPos({ left, top });
  }, [popover.x, popover.y]);

  return (
    <div className="fixed inset-0 z-[60]" onClick={onClose}>
      <motion.div
        ref={ref}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="absolute bg-white rounded-xl shadow-2xl border border-zinc-200 p-1.5 flex gap-1"
        style={{
          left: `${pos.left}px`,
          top: `${pos.top}px`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => onCopyMove('copy')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-700 hover:bg-zinc-100 transition-colors"
          data-testid="button-copy-meal"
        >
          <Copy className="w-3 h-3" /> Copy
        </button>
        <button
          onClick={() => onCopyMove('move')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-700 hover:bg-zinc-100 transition-colors"
          data-testid="button-move-meal"
        >
          <Move className="w-3 h-3" /> Move
        </button>
        <button
          onClick={onReplace}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-700 hover:bg-zinc-100 transition-colors"
          data-testid="button-replace-meal"
        >
          <Replace className="w-3 h-3" /> Replace
        </button>
        <button
          onClick={onClose}
          className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
          data-testid="button-close-copy-move"
        >
          <X className="w-3 h-3" />
        </button>
      </motion.div>
    </div>
  );
}
