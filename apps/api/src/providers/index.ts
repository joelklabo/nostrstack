import type { LnbitsProvider } from './lnbits.js';
import type { OpenNodeProvider } from './opennode.js';

export type LightningProvider = Pick<OpenNodeProvider | LnbitsProvider, 'createCharge' | 'getCharge'>;

export enum LightningProviderKind {
  OpenNode = 'opennode',
  Lnbits = 'lnbits'
}

export function buildLightningProvider(kind: LightningProviderKind, deps: { openNode: () => OpenNodeProvider; lnbits: () => LnbitsProvider }): LightningProvider {
  switch (kind) {
    case LightningProviderKind.OpenNode:
      return deps.openNode();
    case LightningProviderKind.Lnbits:
      return deps.lnbits();
    default:
      return deps.openNode();
  }
}
