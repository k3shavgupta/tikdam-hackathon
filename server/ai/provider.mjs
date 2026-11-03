export const BASETEN_MODEL = 'meta-models/muse-spark-open-1026';

// Provider selection is server-owned. Never accept endpoints or keys from a visitor.
export function providerInfo(env = {}) {
  return env.AI_PROVIDER === 'baseten'
    ? { id: 'baseten', provider: 'Baseten', model: env.BASETEN_MODEL || BASETEN_MODEL }
    : { id: 'meta', provider: 'Meta Model API', model: env.META_MODEL || 'muse-spark-1.3' };
}
