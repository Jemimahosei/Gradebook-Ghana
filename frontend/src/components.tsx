import type { ReactNode } from 'react';
import { ApiError } from './lib/api';
import { gradeChipBg } from './theme';

export function errorText(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}

/** Returns true when the error was a 401 (session already cleared by api.ts). */
export function isUnauthorized(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}

export function ErrorBanner({ error, onDismiss }: { error: string | null; onDismiss?: () => void }) {
  if (!error) return null;
  return (
    <div className="error-banner" role="alert">
      <span>{error}</span>
      {onDismiss && (
        <button type="button" className="text-link" onClick={onDismiss}>
          Dismiss
        </button>
      )}
    </div>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <p className="muted">{label}</p>;
}

export function Empty({ text }: { text: string }) {
  return <p className="muted">{text}</p>;
}

/** Centred empty-state card used across the mockups (screens 19, 20, 23). */
export function EmptyState({
  title,
  text,
  actionLabel,
  onAction,
}: {
  title: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className={`empty-state${actionLabel ? '' : ' no-btn'}`}>
      <div className="title">{title}</div>
      <p>{text}</p>
      {actionLabel && (
        <button type="button" className="btn" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

/** The Gradebook Ghana logo mark from the mockups (brand square + gold dot). */
export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <rect width="40" height="40" rx="9" fill="#3647c9" />
      <path
        d="M11 12h18M11 19h18M11 26h10"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="29" cy="27" r="4.2" fill="#f0b429" />
    </svg>
  );
}

export function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <button type="button" className="logo" onClick={onClick}>
      <LogoMark />
      Gradebook Ghana
    </button>
  );
}

/** Breadcrumb + title + actions header used on every app screen. */
export function PageHead({
  crumb,
  title,
  children,
}: {
  crumb: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <>
      <div className="crumb">{crumb}</div>
      <div className="page-head">
        <h1>{title}</h1>
        {children && <div className="page-actions">{children}</div>}
      </div>
    </>
  );
}

/** WAEC grade chip with the mockup band colours. */
export function GradeChip({ letter }: { letter: string | null | undefined }) {
  if (!letter) return <span className="num">—</span>;
  return (
    <span className="grade-chip num" style={{ background: gradeChipBg(letter) }}>
      {letter}
    </span>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label style={{ display: 'block' }}>
      <span className="label">{label}</span>
      {children}
      {hint && (
        <span className="hint" style={{ display: 'block', marginTop: 4 }}>
          {hint}
        </span>
      )}
    </label>
  );
}
