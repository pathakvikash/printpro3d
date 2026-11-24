// Viewer lighting preset names. Kept out of PrintMaterial so a page can list them without pulling three into its first load.
export const LIGHTS = { studio: 'Studio', daylight: 'Daylight', dramatic: 'Dramatic', flat: 'Flat' } as const;
export type LightKey = keyof typeof LIGHTS;
