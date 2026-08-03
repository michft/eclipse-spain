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
  <input
    aria-label={accessibilityLabel}
    max={maximum}
    min={minimum}
    onChange={(event) => onChange(Number(event.currentTarget.value))}
    step={step}
    style={{ accentColor: "#ffc94d", cursor: "pointer", width: "100%" }}
    type="range"
    value={value}
  />
);
