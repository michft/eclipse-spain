interface TimelineSliderProps {
  accessibilityLabel?: string;
  accessibilityValueText?: string;
  hideThumb?: boolean;
  maximum: number;
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
  <input
    aria-label={accessibilityLabel}
    aria-valuetext={accessibilityValueText}
    max={maximum}
    min={minimum}
    onBlur={() => onFocusChange?.(false)}
    onChange={(event) => onChange(Number(event.currentTarget.value))}
    onFocus={() => onFocusChange?.(true)}
    step={step}
    style={{
      accentColor: "#ffc94d",
      cursor: "pointer",
      opacity: hideThumb && transparentTrack ? 0 : 1,
      width: "100%",
    }}
    tabIndex={0}
    type="range"
    value={value}
  />
);
