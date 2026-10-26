// API settings. EXPO_PUBLIC_* values are inlined at build time (apps/mobile/.env), so never
// put a secret here. Mock API: http://localhost:4010. Local API: http://localhost:8080/v1.
const DEFAULT_BASE_URL = 'http://localhost:4010';

export const apiConfig = {
  baseUrl: (process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, ''),
} as const;
