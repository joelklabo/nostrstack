import { toastMessageFromLabel, useCopyAction } from './useCopyAction';

type Props = {
  text: string;
  label?: string;
  size?: 'sm' | 'md';
  variant?: 'default' | 'icon';
  ariaLabel?: string;
  successDurationMs?: number;
  disabled?: boolean;
};

export function CopyButton({
  text,
  label = 'Copy',
  size = 'sm',
  variant = 'default',
  ariaLabel,
  successDurationMs = 1200,
  disabled
}: Props) {
  const { state, copy, isDisabled } = useCopyAction({
    text,
    label,
    successDurationMs,
    disabled
  });

  const buttonLabel =
    state === 'copied'
      ? 'Copied'
      : state === 'error'
        ? 'Copy failed'
        : label;

  return (
    <div style={{ display: 'inline-flex' }}>
      <button
        type="button"
        onClick={() => copy()}
        aria-label={variant === 'icon' ? (ariaLabel ?? label) : ariaLabel}
        className={[
          'nostrstack-btn',
          size === 'sm' ? 'nostrstack-btn--sm' : '',
          'nostrstack-copybtn',
          variant === 'icon' ? 'nostrstack-copybtn--icon' : ''
        ]
          .filter(Boolean)
          .join(' ')}
        data-copy-state={state}
        data-variant={variant}
        disabled={isDisabled}
      >
        <span className="nostrstack-copybtn__bubble" aria-hidden="true">
          {toastMessageFromLabel(label)}
        </span>
        <span className="nostrstack-copybtn__icon" aria-hidden="true">
          {state === 'copied' ? <CheckIcon /> : state === 'error' ? <ErrorIcon /> : <CopyIcon />}
        </span>
        {variant !== 'icon' ? <span className="nostrstack-copybtn__label">{buttonLabel}</span> : null}
      </button>
    </div>
  );
}

function CopyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="11" height="11" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="M6 6 18 18" />
    </svg>
  );
}
