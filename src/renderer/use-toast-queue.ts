import { useCallback, useEffect, useRef, useState } from "react";
import { type ToastLevel, type ToastState, upsertToast } from "../shared/app-ui-helpers";

export type { ToastLevel, ToastState } from "../shared/app-ui-helpers";

const TOAST_TIMEOUT_MS = 4200;
const MAX_TOASTS = 4;

export const useToastQueue = (): {
  toasts: ReadonlyArray<ToastState>;
  pushToast: (level: ToastLevel, message: string) => void;
} => {
  const [toasts, setToasts] = useState<ReadonlyArray<ToastState>>([]);
  const toastTimers = useRef(new Map<string, number>());
  const nextToastId = useRef(0);

  const pushToast = useCallback((level: ToastLevel, message: string): void => {
    const id = `toast-${nextToastId.current}`;
    nextToastId.current += 1;

    setToasts((current) => {
      const existingToast = current.find(
        (toast) => toast.level === level && toast.message === message,
      );
      if (existingToast !== undefined) {
        const existingTimer = toastTimers.current.get(existingToast.id);
        if (existingTimer !== undefined) {
          window.clearTimeout(existingTimer);
          toastTimers.current.delete(existingToast.id);
        }
      }

      const nextToasts = upsertToast({
        toasts: current,
        level,
        message,
        id,
        maxToasts: MAX_TOASTS,
      });

      const retainedIds = new Set(nextToasts.map((toast) => toast.id));
      for (const [toastId, timer] of toastTimers.current.entries()) {
        if (!retainedIds.has(toastId)) {
          window.clearTimeout(timer);
          toastTimers.current.delete(toastId);
        }
      }

      const insertedToast = nextToasts.find((toast) => toast.id === id);
      if (insertedToast === undefined) {
        return nextToasts;
      }

      const timer = window.setTimeout(() => {
        setToasts((latest) => latest.filter((toast) => toast.id !== id));
        toastTimers.current.delete(id);
      }, TOAST_TIMEOUT_MS);
      toastTimers.current.set(id, timer);
      return nextToasts;
    });
  }, []);

  useEffect(() => {
    return () => {
      for (const timer of toastTimers.current.values()) {
        window.clearTimeout(timer);
      }
      toastTimers.current.clear();
    };
  }, []);

  return {
    toasts,
    pushToast,
  };
};
