// Lists the models the configured AI provider offers. Run: npm run ai:models [-- --json]
import { pickProvider, PRESETS } from '../src/lib/aiDesign.ts';
import { listModels } from '../src/lib/aiProviders.ts';

const json = process.argv.includes('--json');

if (!json && !pickProvider(process.env)) {
  console.log('No AI provider is configured. Presets (set AI_PRESET):');
  for (const [name, p] of Object.entries(PRESETS)) {
    console.log(`  ${name}  ${p.baseUrl}  (${p.keyless ? 'no key needed' : 'needs AI_API_KEY'})`);
  }
  console.log(`
Environment variables:
  ANTHROPIC_API_KEY  use Anthropic
  AI_PROVIDER        force a provider: anthropic, openai or claude-cli
  AI_MODEL           model id to use
  AI_PRESET          a preset name from the list above
  AI_BASE_URL        any OpenAI-compatible base URL
  AI_API_KEY         key for the preset or base URL
  AI_ALLOW_CLI       allow the claude CLI (local development only)`);
  process.exit(1);
}

try {
  const { provider, models } = await listModels(process.env);
  if (json) {
    console.log(JSON.stringify({ provider, models }));
  } else {
    console.log(`Provider: ${provider}`);
    for (const m of models) console.log(`${m.id}  ${m.name ? `(${m.name})  ` : ''}vision: ${m.vision}`);
  }
} catch (e) {
  const message = e instanceof Error ? e.message : 'Could not list models';
  if (json) console.log(JSON.stringify({ error: message }));
  else console.error(message);
  process.exit(1);
}
