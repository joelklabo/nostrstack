import { type Event, type EventTemplate, finalizeEvent, getPublicKey,nip04, nip19 } from 'nostr-tools';
import { createContext, type ReactNode, useCallback,useContext, useEffect, useState } from 'react';

// NIP-07 Interface
interface WindowNostr {
  getPublicKey: () => Promise<string>;
  signEvent: (event: EventTemplate) => Promise<Event>;
  getRelays?: () => Promise<Record<string, { read: boolean; write: boolean }>>;
  nip04?: {
    encrypt: (pubkey: string, plaintext: string) => Promise<string>;
    decrypt: (pubkey: string, ciphertext: string) => Promise<string>;
  };
}

declare global {
  interface Window {
    nostr?: WindowNostr;
  }
}

type AuthMode = 'nip07' | 'nsec' | 'lnurl' | 'guest';

interface AuthState {
  pubkey: string | null;
  mode: AuthMode;
  isLoading: boolean;
  error: string | null;
}

interface AuthContextType extends AuthState {
  loginWithNip07: () => Promise<void>;
  loginWithNsec: (nsec: string) => Promise<void>;
  loginWithLnurl: (linkingKey: string) => Promise<void>;
  logout: () => void;
  signEvent: (template: EventTemplate) => Promise<Event>;
  encrypt: (pubkey: string, plaintext: string) => Promise<string>;
  decrypt: (pubkey: string, ciphertext: string) => Promise<string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY_MODE = 'nostrstack.auth.mode';
const STORAGE_KEY_NSEC = 'nostrstack.auth.nsec'; // In a real app, encrypt this!
const STORAGE_KEY_LNURL = 'nostrstack.auth.lnurl';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    pubkey: null,
    mode: 'guest',
    isLoading: true,
    error: null,
  });

  // Load persisted auth on mount
  useEffect(() => {
    const init = async () => {
      const mode = localStorage.getItem(STORAGE_KEY_MODE) as AuthMode | null;
      
      if (mode === 'nip07') {
        // Wait a bit for window.nostr to be injected
        let attempts = 0;
        const check = setInterval(async () => {
          if (window.nostr) {
            clearInterval(check);
            try {
              const pubkey = await window.nostr.getPublicKey();
              setState({ pubkey, mode: 'nip07', isLoading: false, error: null });
            } catch {
              setState({ pubkey: null, mode: 'guest', isLoading: false, error: 'NIP-07 auth failed' });
            }
          } else if (attempts++ > 10) {
            clearInterval(check);
            setState({ pubkey: null, mode: 'guest', isLoading: false, error: 'NIP-07 extension not found' });
          }
        }, 100);
      } else if (mode === 'nsec') {
        const nsec = localStorage.getItem(STORAGE_KEY_NSEC);
        if (nsec) {
          try {
            const { type, data } = nip19.decode(nsec.trim().toLowerCase());
            if (type === 'nsec') {
              const pubkey = getPublicKey(data as Uint8Array);
              setState({ pubkey, mode: 'nsec', isLoading: false, error: null });
            }
          } catch {
             localStorage.removeItem(STORAGE_KEY_MODE);
             localStorage.removeItem(STORAGE_KEY_NSEC);
             setState({ pubkey: null, mode: 'guest', isLoading: false, error: 'Invalid saved nsec' });
          }
        } else {
           setState({ pubkey: null, mode: 'guest', isLoading: false, error: null });
        }
      } else if (mode === 'lnurl') {
        const linkingKey = localStorage.getItem(STORAGE_KEY_LNURL);
        if (linkingKey && /^[0-9a-f]{64}$/i.test(linkingKey)) {
          setState({ pubkey: linkingKey, mode: 'lnurl', isLoading: false, error: null });
        } else {
          localStorage.removeItem(STORAGE_KEY_MODE);
          localStorage.removeItem(STORAGE_KEY_LNURL);
          setState({ pubkey: null, mode: 'guest', isLoading: false, error: null });
        }
      } else {
        setState({ pubkey: null, mode: 'guest', isLoading: false, error: null });
      }
    };
    init();
  }, []);

  const loginWithNip07 = useCallback(async () => {
    if (!window.nostr) {
      throw new Error('NIP-07 extension not found');
    }
    setState(s => ({ ...s, isLoading: true, error: null }));
    try {
      const pubkey = await window.nostr.getPublicKey();
      localStorage.setItem(STORAGE_KEY_MODE, 'nip07');
      setState({ pubkey, mode: 'nip07', isLoading: false, error: null });
    } catch (err: unknown) {
      setState(s => ({ ...s, isLoading: false, error: (err instanceof Error ? err.message : String(err)) }));
      throw err;
    }
  }, []);

  const loginWithNsec = useCallback(async (nsec: string) => {
    try {
      const cleanNsec = nsec.trim().toLowerCase();
      const { type, data } = nip19.decode(cleanNsec);
      if (type !== 'nsec') throw new Error('Invalid nsec');
      const pubkey = getPublicKey(data as Uint8Array);
      localStorage.setItem(STORAGE_KEY_MODE, 'nsec');
      localStorage.setItem(STORAGE_KEY_NSEC, cleanNsec);
      setState({ pubkey, mode: 'nsec', isLoading: false, error: null });
    } catch (err: unknown) {
      setState(s => ({ ...s, error: (err instanceof Error ? err.message : String(err)) }));
      throw err;
    }
  }, []);

  const loginWithLnurl = useCallback(async (linkingKey: string) => {
    const cleanKey = linkingKey.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/i.test(cleanKey)) {
      const err = new Error('Invalid LNURL linking key');
      setState(s => ({ ...s, error: err.message }));
      throw err;
    }
    localStorage.setItem(STORAGE_KEY_MODE, 'lnurl');
    localStorage.setItem(STORAGE_KEY_LNURL, cleanKey);
    setState({ pubkey: cleanKey, mode: 'lnurl', isLoading: false, error: null });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY_MODE);
    localStorage.removeItem(STORAGE_KEY_NSEC);
    localStorage.removeItem(STORAGE_KEY_LNURL);
    setState({ pubkey: null, mode: 'guest', isLoading: false, error: null });
  }, []);

  const signEvent = useCallback(async (template: EventTemplate): Promise<Event> => {
    if (state.mode === 'nip07' && window.nostr) {
      return window.nostr.signEvent(template);
    } else if (state.mode === 'nsec') {
      const nsec = localStorage.getItem(STORAGE_KEY_NSEC);
      if (!nsec) throw new Error('No nsec found');
      const { data } = nip19.decode(nsec);
      return finalizeEvent(template, data as Uint8Array);
    } else if (state.mode === 'lnurl') {
      throw new Error('LNURL-auth sessions cannot sign events');
    }
    throw new Error('No signer available');
  }, [state.mode]);

  const encrypt = useCallback(async (pubkey: string, plaintext: string): Promise<string> => {
    if (state.mode === 'nip07' && window.nostr?.nip04) {
      return window.nostr.nip04.encrypt(pubkey, plaintext);
    } else if (state.mode === 'nsec') {
      const nsec = localStorage.getItem(STORAGE_KEY_NSEC);
      if (!nsec) throw new Error('No nsec found');
      const { data } = nip19.decode(nsec);
      return nip04.encrypt(data as Uint8Array, pubkey, plaintext);
    }
    throw new Error('Encryption not supported in this mode');
  }, [state.mode]);

  const decrypt = useCallback(async (pubkey: string, ciphertext: string): Promise<string> => {
    if (state.mode === 'nip07' && window.nostr?.nip04) {
      return window.nostr.nip04.decrypt(pubkey, ciphertext);
    } else if (state.mode === 'nsec') {
      const nsec = localStorage.getItem(STORAGE_KEY_NSEC);
      if (!nsec) throw new Error('No nsec found');
      const { data } = nip19.decode(nsec);
      return nip04.decrypt(data as Uint8Array, pubkey, ciphertext);
    }
    throw new Error('Decryption not supported in this mode');
  }, [state.mode]);

  return (
    <AuthContext.Provider value={{ ...state, loginWithNip07, loginWithNsec, loginWithLnurl, logout, signEvent, encrypt, decrypt }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
