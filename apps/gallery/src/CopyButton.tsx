import { useToast } from './toast';

type Props = {
  text: string;
  label?: string;
  size?: 'sm' | 'md';
};

export function CopyButton({ text, label = 'Copy', size = 'sm' }: Props) {
  const toast = useToast();

  const handleCopy = async () => {
    try {
      if (!navigator?.clipboard?.writeText) throw new Error('Clipboard not available');
      await navigator.clipboard.writeText(text);
      toast({ message: `${label} copied`, tone: 'success' });
    } catch (err) {
      console.warn('copy failed', err);
      toast({ message: 'Copy failed', tone: 'danger' });
    }
  };

  return (
    <div style={{ display: 'inline-flex' }}>
      <button
        type="button"
        onClick={handleCopy}
        className={`nostrstack-btn ${size === 'sm' ? 'nostrstack-btn--sm' : ''}`}
      >
        {label}
      </button>
    </div>
  );
}
