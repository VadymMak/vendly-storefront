import { FalKlingProvider } from './fal-kling-provider';
import { KlingProvider } from './kling-provider';
import { KlingDirectProvider } from './kling-direct-provider';
import { WanProvider } from './wan-provider';
import type { VideoProvider } from './provider';

export * from './provider';
export { FalKlingProvider } from './fal-kling-provider';
export { KlingProvider } from './kling-provider';
export { KlingDirectProvider } from './kling-direct-provider';
export { WanProvider } from './wan-provider';

/** Active backend, selected by VIDEO_PROVIDER (defaults to fal.ai Kling 3.0). */
export function getVideoProvider(): VideoProvider {
  switch (process.env.VIDEO_PROVIDER) {
    case 'wan':          return new WanProvider();
    case 'kling-direct': return new KlingDirectProvider();
    case 'kling':        return new KlingProvider();
    case 'fal':
    default:             return new FalKlingProvider();
  }
}
