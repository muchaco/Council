import { Toaster as Sonner, type ToasterProps } from "sonner";

export const Toaster = (props: ToasterProps): JSX.Element => {
  return (
    <Sonner
      closeButton
      expand
      position="bottom-right"
      richColors
      theme="system"
      visibleToasts={4}
      toastOptions={{
        classNames: {
          actionButton:
            "group-[.toast]:border-border group-[.toast]:bg-foreground group-[.toast]:text-background",
          cancelButton:
            "group-[.toast]:border-border group-[.toast]:bg-muted group-[.toast]:text-foreground",
          closeButton:
            "group-[.toast]:border-border group-[.toast]:bg-background group-[.toast]:text-muted-foreground",
          description: "group-[.toast]:text-muted-foreground",
          error:
            "group toast group-[.toaster]:border-destructive/40 group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:shadow-lg",
          success:
            "group toast group-[.toaster]:border-emerald-500/40 group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:shadow-lg",
          toast:
            "group toast group-[.toaster]:border-border group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:shadow-lg",
          warning:
            "group toast group-[.toaster]:border-amber-500/40 group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:shadow-lg",
        },
      }}
      {...props}
    />
  );
};
