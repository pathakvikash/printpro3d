// Wires the configured AI provider to the design projects' `Ai` call. Server only.
import { pickProvider } from './aiDesign.ts';
import { runChat } from './aiProviders.ts';
import { DEFAULT_TIER } from './aiBlueprint.ts';
import type { Ai } from './designProjects.ts';

/** The AI call for the blueprint flow, or null when no provider is configured (then AI routes say so; nothing is faked). */
export function configuredAi(env: Record<string, string | undefined> = process.env): Ai | null {
  const provider = pickProvider(env);
  return provider ? (system, user, schema) => runChat(provider, { system, user, schema }, env) : null;
}

/** What the UI may offer: AI features, the Meshy source (only when its key is set) and the AI tier. */
export const capabilities = (env: Record<string, string | undefined> = process.env) => ({
  ai: pickProvider(env) !== null,
  meshy: !!env.MESHY_API_KEY,
  tier: env.AI_DESIGN_TIER || DEFAULT_TIER,
});
