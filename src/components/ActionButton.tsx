import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  type AccessibilityState,
  type ViewStyle,
} from "react-native";

import { theme } from "../styles/theme";

interface ActionButtonProps {
  accessibilityState?: AccessibilityState;
  children: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  style?: ViewStyle;
}

export const ActionButton = ({
  accessibilityState,
  children,
  disabled = false,
  onPress,
  secondary = false,
  style,
}: ActionButtonProps) => (
  <Pressable
    accessibilityRole="button"
    {...(accessibilityState ? { accessibilityState } : {})}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [
      styles.button,
      secondary && styles.secondary,
      pressed && styles.pressed,
      disabled && styles.disabled,
      style,
    ]}
  >
    <Text style={[styles.label, secondary && styles.secondaryLabel]}>{children}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: theme.color.accent,
    borderColor: theme.color.accent,
    borderRadius: theme.radius.small,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: theme.space.medium,
    paddingVertical: 10,
  },
  secondary: {
    backgroundColor: theme.color.surfaceRaised,
    borderColor: theme.color.border,
  },
  label: {
    color: theme.color.background,
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryLabel: {
    color: theme.color.text,
  },
  pressed: {
    opacity: 0.82,
  },
  disabled: {
    opacity: 0.45,
  },
});
