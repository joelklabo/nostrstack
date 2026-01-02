import type { paths } from './generated/openapi-types.js';
import type { BitcoinStatus } from './types.js';

type Fetcher = (input: RequestInfo, init?: RequestInit) => Promise<Response>;

type LnurlpMetaResponse =
  paths['/.well-known/lnurlp/{username}']['get']['responses'][200]['content']['application/json'];
type InvoiceResponse =
  paths['/api/lnurlp/{username}/invoice']['get']['responses'][200]['content']['application/json'];
type Nip05Response =
  paths['/.well-known/nostr.json']['get']['responses'][200]['content']['application/json'];
type Bolt12OfferBody =
  paths['/api/bolt12/offers']['post']['requestBody']['content']['application/json'];
type Bolt12OfferResponse =
  paths['/api/bolt12/offers']['post']['responses'][201]['content']['application/json'];
type Bolt12InvoiceBody =
  paths['/api/bolt12/invoices']['post']['requestBody']['content']['application/json'];
type Bolt12InvoiceResponse =
  paths['/api/bolt12/invoices']['post']['responses'][200]['content']['application/json'];
type CreateTenantBody =
  paths['/api/admin/tenants']['post']['requestBody']['content']['application/json'];
type CreateTenantResponse =
  paths['/api/admin/tenants']['post']['responses'][201]['content']['application/json'];
type CreateUserBody =
  paths['/api/admin/users']['post']['requestBody']['content']['application/json'];
type CreateUserResponse =
  paths['/api/admin/users']['post']['responses'][201]['content']['application/json'];
type TelemetrySummaryResponse =
  paths['/api/telemetry/summary']['get']['responses'][200]['content']['application/json'];

type HealthResponse = { status: string; env?: string; uptime?: number };

export type NostrstackClientOptions = {
  baseURL?: string;
  apiKey?: string; // for admin routes
  host?: string; // for multi-tenant host header
  fetch?: Fetcher;
};

export class NostrstackClient {
  private readonly base: string;
  private readonly apiKey?: string;
  private readonly host?: string;
  private readonly fetcher: Fetcher;

  constructor(opts: NostrstackClientOptions = {}) {
    this.base = opts.baseURL ?? 'http://localhost:3001';
    this.apiKey = opts.apiKey;
    this.host = opts.host;
    const f = opts.fetch ?? globalThis.fetch;
    if (!f) throw new Error('fetch is not available in this environment');
    // Some browsers (Safari) require fetch to be called with the global this binding.
    this.fetcher = f.bind ? f.bind(globalThis) : f;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      ...(init.headers as Record<string, string>)
    };
    if (this.host) headers['host'] = this.host;
    if (this.apiKey) headers['x-api-key'] = this.apiKey;
    const res = await this.fetcher(`${this.base}${path}`, {
      ...init,
      headers
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    return (await res.json()) as T;
  }

  async health(): Promise<HealthResponse> {
    return this.request('/health');
  }

  async getLnurlpMetadata(username: string): Promise<LnurlpMetaResponse> {
    return this.request(`/.well-known/lnurlp/${encodeURIComponent(username)}`);
  }

  async getLnurlpInvoice(username: string, amountMsat: number, zapRequest?: string, lnurl?: string): Promise<InvoiceResponse> {
    const params = new URLSearchParams({ amount: String(amountMsat) });
    if (zapRequest) params.set('nostr', zapRequest);
    if (lnurl) params.set('lnurl', lnurl);
    return this.request(`/api/lnurlp/${encodeURIComponent(username)}/invoice?${params.toString()}`);
  }

  async getNip05(name: string): Promise<Nip05Response> {
    const q = name ? `?name=${encodeURIComponent(name)}` : '';
    return this.request(`/.well-known/nostr.json${q}`);
  }

  async createBolt12Offer(body: Bolt12OfferBody): Promise<Bolt12OfferResponse> {
    return this.request('/api/bolt12/offers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  async fetchBolt12Invoice(body: Bolt12InvoiceBody): Promise<Bolt12InvoiceResponse> {
    return this.request('/api/bolt12/invoices', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  async createTenant(body: CreateTenantBody): Promise<CreateTenantResponse> {
    return this.request('/api/admin/tenants', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  async createUser(body: CreateUserBody): Promise<CreateUserResponse> {
    return this.request('/api/admin/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  async getTelemetrySummary(): Promise<TelemetrySummaryResponse> {
    return this.request('/api/telemetry/summary');
  }

  async getBitcoinStatus(): Promise<BitcoinStatus> {
    return this.request('/api/bitcoin/status');
  }
}
