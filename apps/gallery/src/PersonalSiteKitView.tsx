import { CommentTipWidget, SupportSection } from '@nostrstack/blog-kit';
import React from 'react';

export function PersonalSiteKitView() {
  const demoItem = 'demo-post-123';
  const demoLnAddress = 'alice@nostrstack.test';
  
  return (
    <div className="personal-site-kit-demo" style={{ padding: 'var(--nostrstack-space-6)', display: 'grid', gap: 'var(--nostrstack-space-8)' }}>
      <section>
        <h1 style={{ marginBottom: 'var(--nostrstack-space-4)' }}>Personal Site Kit Demo</h1>
        <p style={{ color: 'var(--nostrstack-color-text-muted)', marginBottom: 'var(--nostrstack-space-6)' }}>
          Showing the high-level components for personal sites.
        </p>
      </section>

      <section>
        <h2 style={{ marginBottom: 'var(--nostrstack-space-4)', fontSize: '1.2rem' }}>SupportSection (Full Layout)</h2>
        <SupportSection 
          itemId={demoItem}
          lnAddress={demoLnAddress}
          title="Support this post"
          shareUrl="https://nostrstack.test/demo"
          shareTitle="NostrStack Demo"
          layout="full"
        />
      </section>

      <hr style={{ border: 'none', borderTop: '1px solid var(--nostrstack-color-border)' }} />

      <section>
        <h2 style={{ marginBottom: 'var(--nostrstack-space-4)', fontSize: '1.2rem' }}>SupportSection (Compact Layout)</h2>
        <SupportSection 
          itemId={demoItem}
          lnAddress={demoLnAddress}
          title="Enjoying this?"
          shareUrl="https://nostrstack.test/demo"
          shareTitle="NostrStack Demo"
          layout="compact"
        />
      </section>

      <hr style={{ border: 'none', borderTop: '1px solid var(--nostrstack-color-border)' }} />

      <section>
        <h2 style={{ marginBottom: 'var(--nostrstack-space-4)', fontSize: '1.2rem' }}>CommentTipWidget (Embed Wrapper)</h2>
        <CommentTipWidget 
          itemId={demoItem}
          lnAddress={demoLnAddress}
          layout="full"
        />
      </section>
    </div>
  );
}
