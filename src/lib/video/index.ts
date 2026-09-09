import { KlingProvider } from './kling-provider';
import { WanProvider } from './wan-provider';
import type { VideoProvider } from './provider';

export * from './provider';
export { KlingProvider } from './kling-provider';
export { WanProvider } from './wan-provider';

/** Active backend, selected by VIDEO_PROVIDER (defaults to Kling on Replicate). */
export function getVideoProvider(): VideoProvider {
  switch (process.env.VIDEO_PROVIDER) {
    case 'wan':  return new WanProvider();
    case 'kling':
    default:     return new KlingProvider();
  }
}
