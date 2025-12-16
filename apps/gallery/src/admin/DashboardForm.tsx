import { useActionState, useOptimistic, useRef } from 'react';

import { upsertAppAction } from './actions';
import { SubmitButton } from './SubmitButton';

export function DashboardForm() {
  const [state, formAction] = useActionState(upsertAppAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [optimisticName, setOptimisticName] = useOptimistic<string | null, string>(
    null,
    (_currentState, newName) => newName
  );

  const action = async (formData: FormData) => {
    const name = formData.get('name') as string;
    setOptimisticName(name);
    await formAction(formData);
    formRef.current?.reset();
  };

  return (
    <form ref={formRef} action={action} className="nostrstack-card" style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
      <h3 style={{ margin: 0 }}>Edit App {optimisticName ? `(Updating to: ${optimisticName})` : ''}</h3>
      
      <div style={{ display: 'grid', gap: '0.5rem' }}>
        <label htmlFor="name" style={{ fontWeight: 500 }}>App Name</label>
        <input
          id="name"
          name="name"
          className="nostrstack-input"
          placeholder="Enter app name"
        />
      </div>

      {state?.error && (
        <div className="nostrstack-status nostrstack-status--danger">
          {state.error}
        </div>
      )}

      {state?.success && (
        <div className="nostrstack-status nostrstack-status--success">
          App saved successfully!
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <SubmitButton />
      </div>
    </form>
  );
}
