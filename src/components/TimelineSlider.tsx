import Slider from "@react-native-community/slider";
import { StyleSheet } from "react-native";

import { theme } from "../styles/theme";

interface TimelineSliderProps {
  accessibilityLabel?: string;
  maximum: number;
  minimum: number;
  onChange: (value: number) => void;
  step?: number;
  value: number;
}

export const TimelineSlider = ({
  accessibilityLabel = "Simulation time",
  maximum,
  minimum,
  onChange,
  step = 1000,
  value,
}: TimelineSliderProps) => (
  <Slider
    accessibilityLabel={accessibilityLabel}
    maximumTrackTintColor={theme.color.border}
    maximumValue={maximum}
    minimumTrackTintColor={theme.color.accent}
    minimumValue={minimum}
    onValueChange={onChange}
    step={step}
    style={styles.slider}
    thumbTintColor={theme.color.accent}
    value={value}
  />
);

const styles = StyleSheet.create({
  slider: { height: 40, width: "100%" },
});
