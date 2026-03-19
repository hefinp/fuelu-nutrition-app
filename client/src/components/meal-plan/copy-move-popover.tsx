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
  return (
    <div className="fixed inset-0 z-[60]" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="absolute bg-white rounded-xl shadow-2xl border border-zinc-200 p-1.5 flex gap-1"
        style={{
          left: `${popover.x}px`,
          top: `${popover.y - 8}px`,
          transform: 'translate(-50%, -100%)',
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
