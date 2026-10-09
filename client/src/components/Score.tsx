import { scoreTier, TIER_LABELS, type AuditStatus } from '../../../shared/types.ts';

const TIER_STYLES = {
  akut: { bar: 'bg-heat-hot', text: 'text-heat-hot', soft: 'bg-heat-hot-soft' },
  lohnend: { bar: 'bg-heat-warm', text: 'text-heat-warm', soft: 'bg-heat-warm-soft' },
  gering: { bar: 'bg-heat-cool', text: 'text-heat-cool', soft: 'bg-heat-cool-soft' },
  offen: { bar: 'bg-line', text: 'text-mute', soft: 'bg-canvas' },
} as const;

export function tierStyle(score: number | null) {
  return TIER_STYLES[scoreTier(score)];
}

function HeatSegments({ score, segments = 10, size = 'sm' }: { score: number | null; segments?: number; size?: 'sm' | 'lg' }) {
  const filled = score == null ? 0 : Math.ceil((score / 100) * segments);
  const style = tierStyle(score);
  return (
    <div className={`flex ${size === 'lg' ? 'gap-1' : 'gap-[3px]'}`} aria-hidden>
      {Array.from({ length: segments }, (_, i) => (
        <span
          key={i}
          className={`${size === 'lg' ? 'h-3 flex-1 rounded-[3px]' : 'h-2.5 w-[5px] rounded-[1.5px]'} ${
            i < filled ? style.bar : 'bg-line-soft'
          }`}
          style={i < filled ? { opacity: 0.45 + (0.55 * (i + 1)) / filled } : undefined}
        />
      ))}
    </div>
  );
}

export function ScoreCell({ score, status }: { score: number | null; status: AuditStatus }) {
  if (status === 'pending' || status === 'scanning') {
    return (
      <div className="flex items-center gap-2.5" role="status" aria-label="Website wird geprüft">
        <span className="relative block h-2.5 w-[62px] overflow-hidden rounded-[2px] bg-line-soft">
          <span className="scan-sweep absolute inset-y-0 left-0 w-1/3 bg-cobalt/40" />
        </span>
        <span className="text-[12px] text-mute">{status === 'pending' ? 'In Warteschlange' : 'Wird geprüft'}</span>
      </div>
    );
  }
  if (status === 'error') return <span className="text-[12px] text-mute">Nicht automatisch prüfbar</span>;
  const style = tierStyle(score);
  return (
    <div className="flex items-center gap-2.5" title={TIER_LABELS[scoreTier(score)]}>
      <span className={`font-condensed text-[17px] font-semibold tabular w-7 text-right ${style.text}`}>{score ?? '–'}</span>
      <HeatSegments score={score} />
    </div>
  );
}

export function ScoreGauge({ score, summary }: { score: number | null; summary: string | null }) {
  const tier = scoreTier(score);
  const style = tierStyle(score);
  return (
    <div>
      <div className="flex items-end gap-3">
        <span className={`font-condensed text-[64px] leading-[0.85] font-bold tabular tracking-tight ${style.text}`}>
          {score ?? '–'}
        </span>
        <div className="pb-1">
          <div className="text-[12px] text-mute">Redesign-Score von 100</div>
          <div className={`text-[15px] font-semibold ${style.text}`}>{TIER_LABELS[tier]}</div>
        </div>
      </div>
      <div className="mt-4">
        <HeatSegments score={score} segments={20} size="lg" />
        <div className="mt-1.5 flex justify-between text-[11px] text-mute tabular">
          <span>Seite ist aktuell</span>
          <span>Relaunch dringend</span>
        </div>
      </div>
      {summary && <p className="mt-4 text-[13px] leading-relaxed text-ink-soft max-w-[62ch]">{summary}</p>}
    </div>
  );
}
