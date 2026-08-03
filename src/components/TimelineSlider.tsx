import Slider from "@react-native-community/slider";
import { StyleSheet } from "react-native";

import { theme } from "../styles/theme";

interface TimelineSliderProps {
  maximum: number;
  minimum: number;
  onChange: (value: number) => void;
  value: number;
}

export const TimelineSlider = ({
  maximum,
  minimum,
  onChange,
  value,
}: TimelineSliderProps) => (
  <Slider
    accessibilityLabel="Simulation time"
    maximumTrackTintColor={theme.color.border}
    maximumValue={maximum}
    minimumTrackTintColor={theme.color.accent}
    minimumValue={minimum}
    onValueChange={onChange}
    step={1000}
    style={styles.slider}
    thumbTintColor={theme.color.accent}
    value={value}
  />
);

const styles = StyleSheet.create({
  slider: { height: 40, width: "100%" },
});
