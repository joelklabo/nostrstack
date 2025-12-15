import { useActionState } from 'react';
import { upsertAppAction } from './actions';
import { SubmitButton } from './SubmitButton';

export function DashboardForm() {
  const [state, formAction] = useActionState(upsertAppAction, null);

  return (
    <form action={formAction} className="nostrstack-card" style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
      <h3 style={{ margin: 0 }}>Edit App</h3>
      
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
