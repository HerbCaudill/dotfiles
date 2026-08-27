import { createDelegatedJwt, type ServiceAccountCredentials } from "./createDelegatedJwt.ts"

/** Exchange a signed delegated assertion for a short-lived Google access token. */
export async function requestDelegatedAccessToken(
  /** Service-account identity and signing key. */
  credentials: ServiceAccountCredentials,
  /** Delegated identity, scopes, clock, and injectable boundaries. */
  options: RequestDelegatedAccessTokenOptions,
) {
  const assertion = (options.createAssertion ?? createDelegatedJwt)(credentials, {
    now: options.now,
    scopes: options.scopes,
    subject: options.subject,
  })
  const body = new URLSearchParams({
    assertion,
    grant_type: jwtBearerGrantType,
  })
  const response = await options.fetch(tokenEndpoint, {
    body,
    headers: { "content-type": "application/x-www-form-urlencoded" },
    method: "POST",
  })

  if (!response.ok) invalidDelegatedAuthentication()
  const result = (await response.json()) as { access_token?: unknown }
  if (typeof result.access_token !== "string" || !result.access_token) {
    invalidDelegatedAuthentication()
  }
  return result.access_token
}

/** Fail without including Google response data or credential material. */
function invalidDelegatedAuthentication(): never {
  throw new Error("Google Workspace delegated authentication failed")
}

// CONSTANTS

const jwtBearerGrantType = "urn:ietf:params:oauth:grant-type:jwt-bearer"
const tokenEndpoint = "https://oauth2.googleapis.com/token"

// TYPES

type RequestDelegatedAccessTokenOptions = {
  /** Test seam for deterministic assertion generation. */
  createAssertion?: typeof createDelegatedJwt
  /** HTTP boundary used for the OAuth token exchange. */
  fetch: typeof globalThis.fetch
  /** Clock value used to create the assertion. */
  now: Date
  /** OAuth scopes previously approved for domain-wide delegation. */
  scopes: ReadonlyArray<string>
  /** Workspace user represented by the delegated token. */
  subject: string
}
