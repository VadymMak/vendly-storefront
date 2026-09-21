export interface ProviderHelp {
  provider: string;
  name: string;
  keyUrl: string;
  steps: string[];
  keyFormat: string;
  pricing: string;
  icon?: string;
}

export const PROVIDER_HELP: ProviderHelp[] = [
  {
    provider: 'fal',
    name: 'fal.ai',
    keyUrl: 'https://fal.ai/dashboard/keys',
    steps: [
      'Go to fal.ai and sign up (GitHub or Google)',
      'Open Dashboard → Keys',
      'Click "Create Key"',
      'Copy the key (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:xxxxxxxx...)',
    ],
    keyFormat: 'UUID:hash',
    pricing: 'Pay-as-you-go. Flux Schnell ~$0.003/image, Kling video ~$0.42/5s',
    icon: '🎬',
  },
  {
    provider: 'replicate',
    name: 'Replicate',
    keyUrl: 'https://replicate.com/account/api-tokens',
    steps: [
      'Go to replicate.com and sign up',
      'Click your avatar → API tokens',
      'Click "Create token"',
      'Copy the token (starts with r8_)',
    ],
    keyFormat: 'r8_...',
    pricing: 'Pay-as-you-go. Flux Schnell ~$0.003/image, Flux Dev ~$0.03/image',
    icon: '🔄',
  },
  {
    provider: 'xai',
    name: 'xAI (Grok)',
    keyUrl: 'https://console.x.ai/team/default/api-keys',
    steps: [
      'Go to console.x.ai and sign in with X (Twitter) account',
      'Navigate to API Keys',
      'Click "Create API Key"',
      'Copy the key (starts with xai-)',
    ],
    keyFormat: 'xai-...',
    pricing: 'Free tier available. Grok Imagine is free for image generation',
    icon: '🤖',
  },
  {
    provider: 'openai',
    name: 'OpenAI',
    keyUrl: 'https://platform.openai.com/api-keys',
    steps: [
      'Go to platform.openai.com and sign up',
      'Navigate to API Keys in sidebar',
      'Click "Create new secret key"',
      'Copy the key (starts with sk-)',
    ],
    keyFormat: 'sk-...',
    pricing: 'Pay-as-you-go. GPT-4o, DALL-E, Whisper, TTS',
    icon: '💬',
  },
  {
    provider: 'anthropic',
    name: 'Anthropic',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    steps: [
      'Go to console.anthropic.com and sign up',
      'Navigate to Settings → API Keys',
      'Click "Create Key"',
      'Copy the key (starts with sk-ant-)',
    ],
    keyFormat: 'sk-ant-...',
    pricing: 'Pay-as-you-go. Claude Sonnet, Haiku for AI chat features',
    icon: '🧠',
  },
  {
    provider: 'bfl',
    name: 'Black Forest Labs',
    keyUrl: 'https://api.bfl.ml/auth/profile',
    steps: [
      'Go to api.bfl.ml and sign up',
      'Open your Profile page',
      'Find or generate your API key',
      'Copy the key',
    ],
    keyFormat: 'bfl-...',
    pricing: 'Pay-as-you-go. FLUX.2 Pro HD ~$0.03/image',
    icon: '🌲',
  },
  {
    provider: 'kling',
    name: 'Kling AI',
    keyUrl: 'https://platform.klingai.com/apiKey',
    steps: [
      'Go to platform.klingai.com and sign up',
      'Navigate to API Key Management',
      'Create an Access Key + Secret pair',
      'Copy both the Access Key and Secret Key',
    ],
    keyFormat: 'Access Key + Secret Key (two fields)',
    pricing: 'Pay-as-you-go. Video generation via Kling Direct API',
    icon: '🎥',
  },
];

export function getProviderHelp(provider: string): ProviderHelp | undefined {
  const normalized = provider.startsWith('kling') ? 'kling' : provider;
  return PROVIDER_HELP.find(h => h.provider === normalized);
}
