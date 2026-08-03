import { useState, type KeyboardEvent, type ReactNode, type WheelEvent } from "react";

interface HorizonZoomSurfaceProps {
  children: ReactNode;
  onZoomBy: (degrees: number) => void;
}

export const HorizonZoomSurface = ({
  children,
  onZoomBy,
}: HorizonZoomSurfaceProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!isFocused) return;
    if (event.key === "+" || event.key === "ArrowUp") {
      event.preventDefault();
      onZoomBy(-5);
    }
    if (event.key === "-" || event.key === "ArrowDown") {
      event.preventDefault();
      onZoomBy(5);
    }
  };
  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!isFocused || event.deltaY === 0) return;
    event.preventDefault();
    onZoomBy(event.deltaY > 0 ? 5 : -5);
  };

  return (
    <div
      aria-label="Horizon chart: focus, then scroll to change field of view"
      onBlur={() => setIsFocused(false)}
      onFocus={() => setIsFocused(true)}
      onKeyDown={onKeyDown}
      onWheel={onWheel}
      role="group"
      tabIndex={0}
    >
      {children}
    </div>
  );
};
