import { AuthProvider, NostrstackProvider, PostEditor, Timeline } from '@nostrstack/blog-kit';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol',
];

function App() {
  return (
    <NostrstackProvider relays={DEFAULT_RELAYS}>
      <AuthProvider>
        <div className="container">
          <header>
            <h1>My Nostr Feed</h1>
          </header>
          <main>
            <PostEditor />
            <Timeline kinds={[1]} limit={20} />
          </main>
        </div>
      </AuthProvider>
    </NostrstackProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
