import type { ToastState } from "./use-toast-queue";

export const ToastStack = (props: { toasts: ReadonlyArray<ToastState> }): JSX.Element => {
  return (
    <div aria-live="polite" className="toast-stack">
      {props.toasts.map((toast) => (
        <div className={`toast toast-${toast.level}`} key={toast.id}>
          {toast.message}
        </div>
      ))}
    </div>
  );
};
