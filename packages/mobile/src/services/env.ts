type ExpoGlobal = typeof globalThis & {
  process?: {
    env?: Record<string, string | undefined>;
  };
};

export const expoEnv = (globalThis as ExpoGlobal).process?.env ?? {};
