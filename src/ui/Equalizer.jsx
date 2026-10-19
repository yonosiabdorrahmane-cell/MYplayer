/** The little dancing bars iOS puts beside the row that's currently playing. */
export default function Equalizer({ playing = true, color = 'var(--tint)', size = 13 }) {
  const bars = [0, 1, 2];
  return (
    <div
      className="flex items-end justify-center gap-[2px]"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {bars.map((index) => (
        <span
          key={index}
          style={{
            width: 2.5,
            height: '100%',
            borderRadius: 1.5,
            background: color,
            transformOrigin: 'bottom',
            animation: playing
              ? `eq-bar ${[0.62, 0.44, 0.8][index]}s ease-in-out ${index * 0.12}s infinite`
              : 'none',
            transform: playing ? undefined : 'scaleY(0.3)',
          }}
        />
      ))}
    </div>
  );
}
