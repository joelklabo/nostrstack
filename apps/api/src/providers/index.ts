import type { Bolt12Provider } from '../services/bolt12.js';
import type { LnbitsProvider } from './lnbits.js';
import type { MockLightningProvider } from './mock.js';
import type { OpenNodeProvider } from './opennode.js';

export type LightningProvider = Pick<OpenNodeProvider | LnbitsProvider | MockLightningProvider, 'createCharge' | 'getCharge'>;

export enum LightningProviderKind {
  OpenNode = 'opennode',
  Lnbits = 'lnbits',
  Mock = 'mock'
}

export enum Bolt12ProviderKind {
  ClnRest = 'cln-rest',
  Mock = 'mock'
}

export function buildLightningProvider(
  kind: LightningProviderKind,
  deps: { openNode: () => OpenNodeProvider; lnbits: () => LnbitsProvider; mock: () => MockLightningProvider }
): LightningProvider {
  switch (kind) {
    case LightningProviderKind.OpenNode:
      return deps.openNode();
    case LightningProviderKind.Lnbits:
      return deps.lnbits();
    case LightningProviderKind.Mock:
      return deps.mock();
    default:
      return deps.openNode();
  }
}

export function buildBolt12Provider(
  kind: Bolt12ProviderKind,
  deps: { clnRest: () => Bolt12Provider; mock: () => Bolt12Provider }
): Bolt12Provider {
  switch (kind) {
    case Bolt12ProviderKind.ClnRest:
      return deps.clnRest();
    case Bolt12ProviderKind.Mock:
      return deps.mock();
    default:
      return deps.mock();
  }
}
