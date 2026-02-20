import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

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

export function ColorPicker({
  colors,
  value,
  onChange,
  disabled = false,
  label = "Color",
  id,
}: ColorPickerProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const selectedIndex = colors.indexOf(value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && gridRef.current) {
      const selectedButton = gridRef.current.querySelector<HTMLButtonElement>(
        `[data-color-index="${selectedIndex}"]`,
      );
      selectedButton?.focus();
    }
  }, [isOpen, selectedIndex]);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>, index: number): void => {
      const cols = 4;
      const total = colors.length;
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
        const nextButton = gridRef.current?.querySelector<HTMLButtonElement>(
          `[data-color-index="${nextIndex}"]`,
        );
        nextButton?.focus();
      }
    },
    [colors, value, onChange],
  );

  const handleTriggerKeyDown = useCallback((event: ReactKeyboardEvent<HTMLButtonElement>): void => {
    switch (event.key) {
      case "Enter":
      case " ":
      case "ArrowDown":
        event.preventDefault();
        setIsOpen(true);
        break;
      case "Escape":
        event.preventDefault();
        setIsOpen(false);
        break;
    }
  }, []);

  return (
    <div ref={containerRef} className="color-picker">
      {label ? (
        <label className="color-picker-label" htmlFor={id}>
          {label}
        </label>
      ) : null}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="color-picker-trigger"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleTriggerKeyDown}
        disabled={disabled}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={`${label}: ${colorNames[value] ?? value}`}
        style={{ "--selected-color": value } as React.CSSProperties}
      >
        <span className="color-picker-swatch" />
        <span className="color-picker-name">{colorNames[value] ?? value}</span>
        <span className="color-picker-arrow" aria-hidden="true">
          ▼
        </span>
      </button>

      {isOpen ? (
        <div
          ref={gridRef}
          className="color-picker-dropdown"
          role="menu"
          aria-label={`${label} options`}
          tabIndex={-1}
        >
          {colors.map((color, index) => (
            <button
              key={color}
              type="button"
              role="menuitem"
              aria-selected={color === value}
              data-color-index={index}
              className={`color-picker-option ${color === value ? "color-picker-option-selected" : ""}`}
              onClick={() => {
                onChange(color);
                setIsOpen(false);
                triggerRef.current?.focus();
              }}
              onKeyDown={(event) => handleKeyDown(event, index)}
              style={{ "--option-color": color } as React.CSSProperties}
              title={colorNames[color] ?? color}
              tabIndex={-1}
            >
              <span className="color-picker-option-swatch" />
              <span className="color-picker-option-name">{colorNames[color] ?? color}</span>
              {color === value ? (
                <span className="color-picker-check" aria-hidden="true">
                  ✓
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
