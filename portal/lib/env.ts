function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

/** Server-side configuration. Read lazily so `next build` works without secrets. */
export const env = {
  get issuer() {
    return required("AUTH_ISSUER");
  },
  get clientSecret() {
    return required("AUTH_CLIENT_SECRET");
  },
  get identityApiUrl() {
    return required("IDENTITY_API_URL");
  },
  get portalUrl() {
    return required("AUTH_URL");
  },
};

export const PORTAL_CLIENT_ID = "portal";
