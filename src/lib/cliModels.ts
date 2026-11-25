// Valid Claude Code CLI --model values: the aliases, then the full ids. Shared by the server validator and the settings form.
export const CLI_ALIASES = ['haiku', 'sonnet', 'opus'] as const;
export const CLAUDE_IDS = ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'] as const;
export const CLI_MODELS: readonly string[] = [...CLI_ALIASES, ...CLAUDE_IDS];
