import type { KeyboardEvent, ReactNode, WheelEvent } from "react";

interface HorizonZoomSurfaceProps {
  children: ReactNode;
  onZoomBy: (degrees: number) => void;
}

export const HorizonZoomSurface = ({
  children,
  onZoomBy,
}: HorizonZoomSurfaceProps) => {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "+" || event.key === "ArrowUp") onZoomBy(-5);
    if (event.key === "-" || event.key === "ArrowDown") onZoomBy(5);
  };
  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    onZoomBy(event.deltaY > 0 ? 5 : -5);
  };

  return (
    <div
      aria-label="Horizon chart: scroll to change field of view"
      onKeyDown={onKeyDown}
      onWheel={onWheel}
      role="group"
      tabIndex={0}
    >
      {children}
    </div>
  );
};
