import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  type ToastLevel,
  type ToastState,
  resolveToastVariant,
  upsertToast,
} from "../shared/app-ui-helpers";

export type { ToastLevel } from "../shared/app-ui-helpers";

const TOAST_TIMEOUT_MS = 4200;
const MAX_TOASTS = 4;

const dismissToast = (id: string): void => {
  toast.dismiss(id);
};

const showToast = (toastState: ToastState): void => {
  const options = {
    id: toastState.id,
    duration: TOAST_TIMEOUT_MS,
  } as const;

  switch (resolveToastVariant(toastState.level)) {
    case "warning":
      toast.warning(toastState.message, options);
      return;
    case "error":
      toast.error(toastState.message, options);
      return;
    case "default":
      toast(toastState.message, options);
  }
};

export const useToastQueue = (): {
  pushToast: (level: ToastLevel, message: string) => void;
} => {
  const activeToasts = useRef<ReadonlyArray<ToastState>>([]);
  const toastTimers = useRef(new Map<string, number>());
  const nextToastId = useRef(0);

  const removeToast = useCallback((id: string): void => {
    const timer = toastTimers.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      toastTimers.current.delete(id);
    }

    activeToasts.current = activeToasts.current.filter((toastState) => toastState.id !== id);
    dismissToast(id);
  }, []);

  const pushToast = useCallback(
    (level: ToastLevel, message: string): void => {
      const id = `toast-${nextToastId.current}`;
      nextToastId.current += 1;

      const existingToast = activeToasts.current.find(
        (toastState) => toastState.level === level && toastState.message === message.trim(),
      );
      if (existingToast !== undefined) {
        removeToast(existingToast.id);
      }

      const nextToasts = upsertToast({
        toasts: activeToasts.current,
        level,
        message,
        id,
        maxToasts: MAX_TOASTS,
      });

      const retainedIds = new Set(nextToasts.map((toastState) => toastState.id));
      for (const toastState of activeToasts.current) {
        if (!retainedIds.has(toastState.id)) {
          removeToast(toastState.id);
        }
      }

      const insertedToast = nextToasts.find((toastState) => toastState.id === id);
      activeToasts.current = nextToasts;
      if (insertedToast === undefined) {
        return;
      }

      showToast(insertedToast);

      const timer = window.setTimeout(() => {
        removeToast(id);
      }, TOAST_TIMEOUT_MS);
      toastTimers.current.set(id, timer);
    },
    [removeToast],
  );

  useEffect(() => {
    return () => {
      for (const id of toastTimers.current.keys()) {
        removeToast(id);
      }
    };
  }, [removeToast]);

  return {
    pushToast,
  };
};
