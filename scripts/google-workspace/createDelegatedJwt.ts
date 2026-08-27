import { sign } from "node:crypto"

/** Create a signed OAuth assertion for one delegated Workspace user. */
export function createDelegatedJwt(
  /** Service-account identity and signing key. */
  credentials: ServiceAccountCredentials,
  /** Delegated identity, approved scopes, and assertion time. */
  options: DelegatedJwtOptions,
) {
  const issuedAt = Math.floor(options.now.getTime() / 1000)
  const header = encodeJson({ alg: "RS256", typ: "JWT" })
  const payload = encodeJson({
    aud: tokenAudience,
    exp: issuedAt + assertionLifetimeSeconds,
    iat: issuedAt,
    iss: credentials.clientEmail,
    scope: options.scopes.join(" "),
    sub: options.subject,
  })
  const unsignedJwt = `${header}.${payload}`
  const signature = sign("RSA-SHA256", Buffer.from(unsignedJwt), credentials.privateKey)
  return `${unsignedJwt}.${signature.toString("base64url")}`
}

/** Encode one JWT object without padding. */
function encodeJson(value: object) {
  return Buffer.from(JSON.stringify(value)).toString("base64url")
}

// CONSTANTS

const assertionLifetimeSeconds = 3600
const tokenAudience = "https://oauth2.googleapis.com/token"

// TYPES

export type ServiceAccountCredentials = {
  /** Service-account email placed in the JWT issuer claim. */
  clientEmail: string
  /** PEM-encoded private key used to sign the assertion. */
  privateKey: string
}

type DelegatedJwtOptions = {
  /** Clock value used for the issued-at and expiration claims. */
  now: Date
  /** OAuth scopes previously approved for domain-wide delegation. */
  scopes: ReadonlyArray<string>
  /** Workspace user represented by the delegated token. */
  subject: string
}
