import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

interface SortableWidgetProps {
  id: string;
  isEditing: boolean;
  isMobile: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  children: ReactNode;
}

export function SortableWidget({
  id,
  isEditing,
  isMobile,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  children,
}: SortableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !isEditing || isMobile });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: "relative" as const,
    zIndex: isDragging ? 50 : "auto",
  };

  return (
    <div ref={setNodeRef} style={style}>
      {isEditing && (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
          {isMobile ? (
            // Mobile: up/down arrows — much better than drag on iOS
            <>
              <button
                onClick={onMoveUp}
                disabled={!canMoveUp}
                data-testid={`button-move-up-${id}`}
                className="p-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-400 hover:text-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors touch-manipulation"
                title="Move up"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                onClick={onMoveDown}
                disabled={!canMoveDown}
                data-testid={`button-move-down-${id}`}
                className="p-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-400 hover:text-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors touch-manipulation"
                title="Move down"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </>
          ) : (
            // Desktop: drag handle
            <div
              {...attributes}
              {...listeners}
              data-testid={`drag-handle-${id}`}
              className="p-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-400 hover:text-zinc-600 cursor-grab active:cursor-grabbing transition-colors"
              title="Drag to reorder"
            >
              <GripVertical className="w-4 h-4" />
            </div>
          )}
        </div>
      )}
      <div
        className={
          isEditing
            ? "ring-2 ring-dashed ring-zinc-300 ring-offset-2 rounded-3xl transition-shadow"
            : ""
        }
      >
        {children}
      </div>
    </div>
  );
}
