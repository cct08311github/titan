"use client";

import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";

/* ------------------------------------------------------------------ */
/*  Reusable AlertDialog primitives (shadcn-style, matches TITAN UI)  */
/* ------------------------------------------------------------------ */

const AlertDialog = AlertDialogPrimitive.Root;
const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
const AlertDialogPortal = AlertDialogPrimitive.Portal;

const AlertDialogOverlay = React.forwardRef<
  React.ComponentRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className = "", ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    ref={ref}
    className={`fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 ${className}`}
    {...props}
  />
));
AlertDialogOverlay.displayName = "AlertDialogOverlay";

const AlertDialogContent = React.forwardRef<
  React.ComponentRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className = "", ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      ref={ref}
      className={`fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius)] border border-border bg-card p-6 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] ${className}`}
      {...props}
    />
  </AlertDialogPortal>
));
AlertDialogContent.displayName = "AlertDialogContent";

const AlertDialogHeader = ({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`flex flex-col space-y-2 text-center sm:text-left ${className}`} {...props} />
);

const AlertDialogFooter = ({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-4 ${className}`} {...props} />
);

const AlertDialogTitle = React.forwardRef<
  React.ComponentRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className = "", ...props }, ref) => (
  <AlertDialogPrimitive.Title ref={ref} className={`text-lg font-semibold ${className}`} {...props} />
));
AlertDialogTitle.displayName = "AlertDialogTitle";

const AlertDialogDescription = React.forwardRef<
  React.ComponentRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className = "", ...props }, ref) => (
  <AlertDialogPrimitive.Description ref={ref} className={`text-sm text-muted-foreground ${className}`} {...props} />
));
AlertDialogDescription.displayName = "AlertDialogDescription";

const AlertDialogAction = React.forwardRef<
  React.ComponentRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className = "", ...props }, ref) => (
  <AlertDialogPrimitive.Action
    ref={ref}
    className={`inline-flex items-center justify-center rounded-[var(--radius)] px-4 py-2 text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${className}`}
    {...props}
  />
));
AlertDialogAction.displayName = "AlertDialogAction";

const AlertDialogCancel = React.forwardRef<
  React.ComponentRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className = "", ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    className={`inline-flex items-center justify-center rounded-[var(--radius)] px-4 py-2 text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${className}`}
    {...props}
  />
));
AlertDialogCancel.displayName = "AlertDialogCancel";

/* ------------------------------------------------------------------ */
/*  Convenience: imperative-style confirm dialog via state hook        */
/* ------------------------------------------------------------------ */

interface ConfirmDialogOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive" | "default";
}

interface ConfirmDialogState extends ConfirmDialogOptions {
  open: boolean;
}

/**
 * Hook that provides an async `confirm()` replacement.
 *
 * Uses a ref for the resolve callback to avoid unnecessary re-renders.
 *
 * Usage:
 *   const { confirmDialog, ConfirmDialog } = useConfirmDialog();
 *   const ok = await confirmDialog({ title: "Delete?", description: "Cannot undo." });
 *   if (ok) { ... }
 *   // render <ConfirmDialog /> somewhere in JSX
 */
export function useConfirmDialog() {
  const [state, setState] = React.useState<ConfirmDialogState>({
    open: false,
    title: "",
  });

  const resolveRef = React.useRef<((v: boolean) => void) | null>(null);

  const confirmDialog = React.useCallback((options: ConfirmDialogOptions) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setState({ ...options, open: true });
    });
  }, []);

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) {
        resolveRef.current?.(false);
        resolveRef.current = null;
        setState((s) => ({ ...s, open: false }));
      }
    },
    [],
  );

  const handleConfirm = React.useCallback(() => {
    resolveRef.current?.(true);
    resolveRef.current = null;
    setState((s) => ({ ...s, open: false }));
  }, []);

  const handleCancel = React.useCallback(() => {
    resolveRef.current?.(false);
    resolveRef.current = null;
    setState((s) => ({ ...s, open: false }));
  }, []);

  const ConfirmDialogComponent = React.useCallback(
    () => (
      <AlertDialog open={state.open} onOpenChange={handleOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{state.title}</AlertDialogTitle>
            {state.description && <AlertDialogDescription>{state.description}</AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>{state.cancelLabel ?? "取消"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={state.variant !== "destructive" ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}
            >
              {state.confirmLabel ?? "確認"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    ),
    [state, handleOpenChange, handleConfirm, handleCancel],
  );

  return { confirmDialog, ConfirmDialog: ConfirmDialogComponent };
}

/* ------------------------------------------------------------------ */
/*  usePromptDialog — async replacement for window.prompt()            */
/* ------------------------------------------------------------------ */

interface PromptDialogOptions {
  title: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface PromptDialogState extends PromptDialogOptions {
  open: boolean;
}

/**
 * Hook that provides an async `prompt()` replacement using TITAN UI.
 *
 * Usage:
 *   const { promptDialog, PromptDialog } = usePromptDialog();
 *   const value = await promptDialog({ title: "名稱：" });
 *   if (value) { ... }
 *   // render <PromptDialog /> somewhere in JSX
 */
export function usePromptDialog() {
  const [state, setState] = React.useState<PromptDialogState>({ open: false, title: "" });
  const [inputValue, setInputValue] = React.useState("");
  const resolveRef = React.useRef<((v: string | null) => void) | null>(null);

  const promptDialog = React.useCallback((options: PromptDialogOptions) => {
    return new Promise<string | null>((resolve) => {
      resolveRef.current = resolve;
      setInputValue(options.defaultValue ?? "");
      setState({ ...options, open: true });
    });
  }, []);

  const handleClose = React.useCallback(() => {
    resolveRef.current?.(null);
    resolveRef.current = null;
    setState((s) => ({ ...s, open: false }));
  }, []);

  const handleConfirm = React.useCallback(() => {
    resolveRef.current?.(inputValue);
    resolveRef.current = null;
    setState((s) => ({ ...s, open: false }));
  }, [inputValue]);

  const PromptDialogComponent = React.useCallback(
    () => (
      <AlertDialog open={state.open} onOpenChange={(open) => { if (!open) handleClose(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{state.title}</AlertDialogTitle>
            {state.description && <AlertDialogDescription>{state.description}</AlertDialogDescription>}
          </AlertDialogHeader>
          <div className="px-0 py-2">
            <input
              autoFocus
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleConfirm(); }}
              placeholder={state.placeholder}
              className="w-full h-10 px-3 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleClose}>{state.cancelLabel ?? "取消"}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {state.confirmLabel ?? "確定"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    ),
    [state, inputValue, handleClose, handleConfirm],
  );

  return { promptDialog, PromptDialog: PromptDialogComponent };
}

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
