const PLAID_ENV = process.env.EXPO_PUBLIC_PLAID_ENV;

const VALID_ENVS = ['sandbox', 'development', 'production'] as const;
type PlaidEnv = (typeof VALID_ENVS)[number];

function isValidPlaidEnv(value: string | undefined): value is PlaidEnv {
  return VALID_ENVS.includes(value as PlaidEnv);
}

export const plaidConfigured: boolean = isValidPlaidEnv(PLAID_ENV);

export const plaidConfig = plaidConfigured
  ? { env: PLAID_ENV as PlaidEnv }
  : null;

if (__DEV__ && !plaidConfigured) {
  console.warn(
    '[Plaid] Not configured. Set EXPO_PUBLIC_PLAID_ENV=sandbox in .env to enable Plaid features.'
  );
}
