import { useState } from 'react';

export function MockComments() {
  const [text, setText] = useState('');
  const [items, setItems] = useState<Array<{ content: string; ts: number }>>([]);

  return (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <span>Comment (local mock)</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          style={{ width: '100%', borderRadius: 10, border: '1px solid #e2e8f0', padding: '0.6rem' }}
        />
      </label>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          type="button"
          onClick={() => {
            if (!text.trim()) return;
            setItems((prev) => [{ content: text.trim(), ts: Date.now() }, ...prev].slice(0, 20));
            setText('');
          }}
        >
          Post
        </button>
        <button type="button" onClick={() => setText('')}>Clear</button>
      </div>
      <div style={{ display: 'grid', gap: '0.4rem' }}>
        {items.map((item) => (
          <div key={item.ts} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '0.55rem' }}>
            <div style={{ fontSize: '0.85rem', color: '#475569' }}>{new Date(item.ts).toLocaleTimeString()}</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{item.content}</div>
          </div>
        ))}
        {items.length === 0 && <div style={{ color: '#475569' }}>No comments yet.</div>}
      </div>
    </div>
  );
}
