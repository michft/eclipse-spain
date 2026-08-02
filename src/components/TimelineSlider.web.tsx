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
  <input
    aria-label="Simulation time"
    max={maximum}
    min={minimum}
    onChange={(event) => onChange(Number(event.currentTarget.value))}
    step={1000}
    style={{ accentColor: "#ffc94d", cursor: "pointer", width: "100%" }}
    type="range"
    value={value}
  />
);
