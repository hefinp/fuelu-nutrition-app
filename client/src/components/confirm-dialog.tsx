import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Remove",
  variant = "destructive",
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="confirm-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle data-testid="confirm-dialog-title">{title}</AlertDialogTitle>
          <AlertDialogDescription data-testid="confirm-dialog-description">{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="confirm-dialog-cancel">Cancel</AlertDialogCancel>
          <AlertDialogAction
            data-testid="confirm-dialog-confirm"
            className={cn(
              variant === "destructive" &&
                buttonVariants({ variant: "destructive" })
            )}
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function useConfirmDialog() {
  const [state, setState] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    variant: "default" | "destructive";
    onConfirm: () => void;
  }>({
    open: false,
    title: "",
    description: "",
    confirmLabel: "Remove",
    variant: "destructive",
    onConfirm: () => {},
  });

  const confirm = (opts: {
    title: string;
    description: string;
    confirmLabel?: string;
    variant?: "default" | "destructive";
    onConfirm: () => void;
  }) => {
    setState({
      open: true,
      title: opts.title,
      description: opts.description,
      confirmLabel: opts.confirmLabel ?? "Remove",
      variant: opts.variant ?? "destructive",
      onConfirm: opts.onConfirm,
    });
  };

  const dialogProps = {
    ...state,
    onOpenChange: (open: boolean) => setState((s) => ({ ...s, open })),
  };

  return { confirm, dialogProps };
}
