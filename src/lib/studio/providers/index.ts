import type { ImageProvider, ProviderName } from '../config';
import { ReplicateProvider } from './replicate';
import { XaiProvider } from './xai';
import { BflProvider } from './bfl';

const PROVIDERS: Partial<Record<ProviderName, ImageProvider>> = {
  replicate: new ReplicateProvider(),
  xai:       new XaiProvider(),
  bfl:       new BflProvider(),
  // fal: added in P82
};

export function getProvider(name: ProviderName): ImageProvider {
  const p = PROVIDERS[name];
  if (!p) throw new Error(`Provider "${name}" is not available`);
  return p;
}
