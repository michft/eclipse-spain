import Slider from "@react-native-community/slider";
import { StyleSheet } from "react-native";

import { theme } from "../styles/theme";

interface TimelineSliderProps {
  accessibilityLabel?: string;
  accessibilityValueText?: string;
  maximum: number;
  hideThumb?: boolean;
  minimum: number;
  onChange: (value: number) => void;
  onFocusChange?: (focused: boolean) => void;
  step?: number;
  transparentTrack?: boolean;
  value: number;
}

export const TimelineSlider = ({
  accessibilityLabel = "Simulation time",
  accessibilityValueText,
  hideThumb = false,
  maximum,
  minimum,
  onChange,
  onFocusChange,
  step = 1000,
  transparentTrack = false,
  value,
}: TimelineSliderProps) => (
  <Slider
    accessibilityLabel={accessibilityLabel}
    {...(accessibilityValueText !== undefined
      ? { accessibilityValue: { text: accessibilityValueText } }
      : {})}
    maximumTrackTintColor={transparentTrack ? "transparent" : theme.color.border}
    maximumValue={maximum}
    minimumTrackTintColor={transparentTrack ? "transparent" : theme.color.accent}
    minimumValue={minimum}
    onBlur={() => onFocusChange?.(false)}
    onFocus={() => onFocusChange?.(true)}
    onValueChange={onChange}
    step={step}
    style={styles.slider}
    thumbTintColor={hideThumb ? "transparent" : theme.color.accent}
    value={value}
    {...(hideThumb
      ? {
          thumbImage: {
            uri: "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=",
          },
        }
      : {})}
  />
);

const styles = StyleSheet.create({
  slider: { height: 40, width: "100%" },
});
