import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/utils";

export interface ColorPickerProps {
  colors: ReadonlyArray<string>;
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
  label?: string;
  id?: string;
}

const colorNames: Record<string, string> = {
  "#0a5c66": "Teal",
  "#2563eb": "Blue",
  "#b45309": "Amber",
  "#7c3aed": "Violet",
  "#be123c": "Crimson",
  "#0f766e": "Emerald",
  "#166534": "Forest",
  "#7c2d12": "Rust",
};

type PopoverPosition = {
  top: number;
  left: number;
};

const POPOVER_WIDTH = 116;

export function ColorPicker({
  colors,
  value,
  onChange,
  disabled = false,
  label = "Color",
  id,
}: ColorPickerProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition>({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const selectedIndex = colors.indexOf(value);

  const updatePosition = useCallback((): void => {
    const trigger = triggerRef.current;
    if (trigger === null) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const desiredLeft = rect.left + rect.width / 2 - POPOVER_WIDTH / 2;
    const left = Math.max(8, Math.min(desiredLeft, viewportWidth - POPOVER_WIDTH - 8));
    const top = rect.bottom + 8;
    const estimatedHeight = 44;
    const fitsBelow = top + estimatedHeight <= viewportHeight - 8;

    setPosition({
      left,
      top: fitsBelow ? top : Math.max(8, rect.top - estimatedHeight - 8),
    });
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (containerRef.current?.contains(target) || popoverRef.current?.contains(target)) {
        return;
      }

      setIsOpen(false);
    };

    const handleWindowChange = (): void => {
      updatePosition();
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("resize", handleWindowChange);
    window.addEventListener("scroll", handleWindowChange, true);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("resize", handleWindowChange);
      window.removeEventListener("scroll", handleWindowChange, true);
    };
  }, [isOpen, updatePosition]);

  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }

    updatePosition();
    const selectedButton = popoverRef.current?.querySelector<HTMLButtonElement>(
      `[data-color-index="${selectedIndex}"]`,
    );
    selectedButton?.focus();
  }, [isOpen, selectedIndex, updatePosition]);

  const handleOptionKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>, index: number): void => {
      const total = colors.length;
      const cols = 4;
      let nextIndex: number | null = null;

      switch (event.key) {
        case "ArrowRight":
          event.preventDefault();
          nextIndex = (index + 1) % total;
          break;
        case "ArrowLeft":
          event.preventDefault();
          nextIndex = (index - 1 + total) % total;
          break;
        case "ArrowDown":
          event.preventDefault();
          nextIndex = (index + cols) % total;
          break;
        case "ArrowUp":
          event.preventDefault();
          nextIndex = (index - cols + total) % total;
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          onChange(colors[index] ?? value);
          setIsOpen(false);
          triggerRef.current?.focus();
          break;
        case "Escape":
          event.preventDefault();
          setIsOpen(false);
          triggerRef.current?.focus();
          break;
        case "Home":
          event.preventDefault();
          nextIndex = 0;
          break;
        case "End":
          event.preventDefault();
          nextIndex = total - 1;
          break;
      }

      if (nextIndex !== null) {
        const nextButton = popoverRef.current?.querySelector<HTMLButtonElement>(
          `[data-color-index="${nextIndex}"]`,
        );
        nextButton?.focus();
      }
    },
    [colors, onChange, value],
  );

  const handleTriggerKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>): void => {
      switch (event.key) {
        case "Enter":
        case " ":
        case "ArrowDown":
          event.preventDefault();
          if (disabled) {
            return;
          }
          setIsOpen(true);
          break;
        case "Escape":
          event.preventDefault();
          setIsOpen(false);
          break;
      }
    },
    [disabled],
  );

  const popoverStyle: CSSProperties = {
    position: "fixed",
    top: position.top,
    left: position.left,
    width: POPOVER_WIDTH,
  };

  return (
    <div ref={containerRef} className="relative shrink-0">
      {label ? (
        <label className="sr-only" htmlFor={id}>
          {label}
        </label>
      ) : null}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg border-2 border-input/80 bg-background shadow-sm",
          "transition-colors hover:border-foreground/30 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
        onClick={() => {
          if (disabled) {
            return;
          }
          updatePosition();
          setIsOpen((current) => !current);
        }}
        onKeyDown={handleTriggerKeyDown}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`${label}: ${colorNames[value] ?? value}`}
      >
        <span
          className="h-5 w-5 rounded-full border-2 border-background shadow-[0_0_0_2px_rgba(15,23,42,0.18)]"
          style={{ backgroundColor: value }}
        />
      </button>

      {isOpen
        ? createPortal(
            <div
              ref={popoverRef}
              className="z-[100] grid grid-cols-4 gap-1 rounded-lg border border-border bg-popover p-2 shadow-xl"
              role="menu"
              aria-label={`${label} options`}
              style={popoverStyle}
            >
              {colors.map((color, index) => (
                <button
                  key={color}
                  type="button"
                  role="menuitemradio"
                  aria-checked={color === value}
                  aria-label={`${label}: ${colorNames[color] ?? color}`}
                  data-color-index={index}
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full transition-colors",
                    "hover:bg-accent focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    color === value && "bg-accent/70",
                  )}
                  onClick={() => {
                    onChange(color);
                    setIsOpen(false);
                    triggerRef.current?.focus();
                  }}
                  onKeyDown={(event) => handleOptionKeyDown(event, index)}
                  title={colorNames[color] ?? color}
                  tabIndex={-1}
                >
                  <span
                    className={cn(
                      "h-4 w-4 rounded-full border border-black/10",
                      color === value &&
                        "ring-2 ring-foreground/80 ring-offset-1 ring-offset-popover",
                    )}
                    style={{ backgroundColor: color }}
                  />
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
