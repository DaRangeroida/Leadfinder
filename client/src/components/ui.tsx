import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, LoaderCircle, X } from 'lucide-react';
import { STATUS_LABELS, type LeadStatus, type Severity } from '../../../shared/types.ts';

export const STATUS_DOT: Record<LeadStatus, string> = {
  neu: 'bg-st-neu',
  geprueft: 'bg-st-geprueft',
  kontaktiert: 'bg-st-kontaktiert',
  verhandlung: 'bg-st-verhandlung',
  abgeschlossen: 'bg-st-abgeschlossen',
  verworfen: 'bg-st-verworfen',
};

const STATUS_TEXT: Record<LeadStatus, string> = {
  neu: 'text-st-neu',
  geprueft: 'text-st-geprueft',
  kontaktiert: 'text-st-kontaktiert',
  verhandlung: 'text-st-verhandlung',
  abgeschlossen: 'text-st-abgeschlossen',
  verworfen: 'text-st-verworfen',
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${STATUS_TEXT[status]}`}>
      <span className={`size-1.5 rounded-full ${STATUS_DOT[status]}`} />
      {STATUS_LABELS[status]}
    </span>
  );
}

export const SEVERITY_STYLES: Record<Severity, { label: string; chip: string; dot: string }> = {
  kritisch: { label: 'Kritisch', chip: 'bg-heat-hot-soft text-heat-hot', dot: 'bg-heat-hot' },
  hoch: { label: 'Hoch', chip: 'bg-heat-warm-soft text-[#9a6a05]', dot: 'bg-heat-warm' },
  mittel: { label: 'Mittel', chip: 'bg-canvas text-ink-soft', dot: 'bg-ink-soft/60' },
  niedrig: { label: 'Niedrig', chip: 'bg-canvas text-mute', dot: 'bg-line' },
};

export function PainChip({ title, severity }: { title: string; severity: Severity }) {
  return (
    <span className={`inline-flex max-w-[220px] items-center truncate rounded px-1.5 py-0.5 text-[11.5px] font-medium ${SEVERITY_STYLES[severity].chip}`}>
      <span className="truncate">{title}</span>
    </span>
  );
}

export function Spinner({ className = 'size-4' }: { className?: string }) {
  return <LoaderCircle className={`${className} animate-spin`} aria-hidden />;
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 px-8 py-14">
      <h3 className="text-[15px] font-semibold">{title}</h3>
      {children && <div className="max-w-[52ch] text-[13px] text-ink-soft">{children}</div>}
      {action}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-bad/25 bg-heat-hot-soft/60 px-3 py-2.5 text-[13px] text-bad" role="alert">
      <CircleAlert className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function formatDate(iso: string | null, withTime = false): string {
  if (!iso) return '–';
  const date = new Date(iso);
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function relativeTime(iso: string | null): string {
  if (!iso) return 'nie';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'gerade eben';
  if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min.`;
  if (diff < 86400) return `vor ${Math.floor(diff / 3600)} Std.`;
  if (diff < 86400 * 7) return `vor ${Math.floor(diff / 86400)} Tagen`;
  return formatDate(iso);
}

type ToastKind = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (message: string, kind: ToastKind = 'success') => {
      const id = Date.now() + Math.random();
      setToasts((list) => [...list.slice(-3), { id, kind, message }]);
      setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 3500);
    },
    [dismiss],
  );
  const icons = {
    success: <CircleCheck className="size-4 text-ok" />,
    error: <CircleAlert className="size-4 text-bad" />,
    info: <Info className="size-4 text-cobalt" />,
  };
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="rise-in pointer-events-auto flex items-start gap-2.5 rounded-lg border border-line bg-panel px-3.5 py-3 text-[13px] shadow-[0_8px_24px_-12px_rgba(26,34,54,0.35)]"
          >
            <span className="mt-0.5">{icons[toast.kind]}</span>
            <span className="flex-1">{toast.message}</span>
            <button className="text-mute hover:text-ink" onClick={() => dismiss(toast.id)} aria-label="Hinweis schließen">
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
