import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { ReactNode } from "react";

interface SortableWidgetProps {
  id: string;
  isEditing: boolean;
  children: ReactNode;
}

export function SortableWidget({ id, isEditing, children }: SortableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !isEditing });

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
        <div
          {...attributes}
          {...listeners}
          data-testid={`drag-handle-${id}`}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-400 hover:text-zinc-600 cursor-grab active:cursor-grabbing transition-colors"
          title="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
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
