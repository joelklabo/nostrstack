import { useFormStatus } from 'react-dom';

export function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="nostrstack-btn nostrstack-btn--primary"
    >
      {pending ? 'Saving...' : 'Save App'}
    </button>
  );
}
