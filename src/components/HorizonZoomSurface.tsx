import type { ReactNode } from "react";
import { View } from "react-native";

interface HorizonZoomSurfaceProps {
  children: ReactNode;
  onZoomBy: (degrees: number) => void;
}

export const HorizonZoomSurface = ({
  children,
}: HorizonZoomSurfaceProps) => <View>{children}</View>;
