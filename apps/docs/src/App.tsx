import {
  BlockchainStats,
  CommentTipWidget,
  NostrProfileWidget,
  NostrstackProvider,
  SupportSection
} from '@nostrstack/react';

function WidgetDemos() {
  const demoItem = 'demo-post-123';
  const demoLnAddress = 'alice@nostrstack.test';
  const demoBaseUrl = 'mock';

  return (
    <div className="demo-container">
      <header className="demo-header">
        <h1>NostrStack Widgets</h1>
        <p>Embeddable components for personal sites and blogs.</p>
      </header>

      <main className="demo-grid">
        <section className="demo-section">
          <h2>Blockchain Stats</h2>
          <p className="demo-description">Display Bitcoin network statistics.</p>
          <div className="demo-widget">
            <BlockchainStats title="Network Status" baseUrl={demoBaseUrl} />
          </div>
          <details className="demo-code">
            <summary>Usage</summary>
            <pre>{`<BlockchainStats
  title="Network Status"
  baseUrl="https://api.nostrstack.com"
/>`}</pre>
          </details>
        </section>

        <section className="demo-section">
          <h2>Nostr Profile</h2>
          <p className="demo-description">Show a Nostr profile card with Lightning tips.</p>
          <div className="demo-widget">
            <NostrProfileWidget identifier="alice@nostrstack.test" baseUrl={demoBaseUrl} />
          </div>
          <details className="demo-code">
            <summary>Usage</summary>
            <pre>{`<NostrProfileWidget
  identifier="user@domain.com"
  baseUrl="https://api.nostrstack.com"
/>`}</pre>
          </details>
        </section>

        <section className="demo-section demo-section--wide">
          <h2>Support Section (Full Layout)</h2>
          <p className="demo-description">Complete support widget with tips, comments, and sharing.</p>
          <div className="demo-widget">
            <SupportSection
              itemId={demoItem}
              lnAddress={demoLnAddress}
              title="Support this post"
              shareUrl="https://nostrstack.test/demo"
              shareTitle="NostrStack Demo"
              baseUrl={demoBaseUrl}
              tipShowFeed={false}
              layout="full"
            />
          </div>
          <details className="demo-code">
            <summary>Usage</summary>
            <pre>{`<SupportSection
  itemId="post-123"
  lnAddress="you@domain.com"
  title="Support this post"
  shareUrl={window.location.href}
  shareTitle="My Blog Post"
  layout="full"
/>`}</pre>
          </details>
        </section>

        <section className="demo-section demo-section--wide">
          <h2>Support Section (Compact Layout)</h2>
          <p className="demo-description">Streamlined layout for sidebars and smaller spaces.</p>
          <div className="demo-widget">
            <SupportSection
              itemId={demoItem}
              lnAddress={demoLnAddress}
              title="Enjoying this?"
              shareUrl="https://nostrstack.test/demo"
              shareTitle="NostrStack Demo"
              baseUrl={demoBaseUrl}
              tipShowFeed={false}
              layout="compact"
            />
          </div>
        </section>

        <section className="demo-section demo-section--wide">
          <h2>Comment Tip Widget</h2>
          <p className="demo-description">Embeddable wrapper combining comments and tips.</p>
          <div className="demo-widget">
            <CommentTipWidget
              itemId={demoItem}
              lnAddress={demoLnAddress}
              baseUrl={demoBaseUrl}
              showFeed={false}
              layout="full"
            />
          </div>
          <details className="demo-code">
            <summary>Usage</summary>
            <pre>{`<CommentTipWidget
  itemId="post-123"
  lnAddress="you@domain.com"
  layout="full"
/>`}</pre>
          </details>
        </section>
      </main>

      <footer className="demo-footer">
        <p>
          <a href="https://github.com/nostrstack/nostrstack">GitHub</a> |{' '}
          <a href="https://nostrstack.com">nostrstack.com</a>
        </p>
      </footer>
    </div>
  );
}

export default function App() {
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';

  return (
    <NostrstackProvider apiBase={apiBase} baseUrl={apiBase}>
      <WidgetDemos />
    </NostrstackProvider>
  );
}
