/** Decorative wind streamlines: the app's signature motif. Hidden from assistive tech. */
export function Streamlines({ className = 'gb-streamlines' }: { className?: string }) {
  const lines = [
    'M0 40 C80 10 160 70 260 40 S420 10 520 40',
    'M0 70 C90 45 170 100 270 70 S430 45 520 70',
    'M0 100 C70 80 180 125 280 100 S420 75 520 100',
    'M0 130 C100 110 190 150 290 130 S440 105 520 130',
    'M0 160 C80 140 200 185 300 160 S430 140 520 160',
    'M0 190 C90 172 210 210 310 190 S440 170 520 190',
  ];
  return (
    <svg className={className} viewBox="0 0 520 220" fill="none" aria-hidden>
      {lines.map((d, i) => (
        <path
          key={d}
          d={d}
          stroke="currentColor"
          strokeWidth={1.4}
          strokeLinecap="round"
          strokeDasharray={i % 2 ? '2 7' : undefined}
        />
      ))}
    </svg>
  );
}
