import jwtEncode from 'jwt-encode'

interface JWTPayload {
  [key: string]: string | number | Date
  sub: string
  name: string
  alg: string
  typ: string
  iat: number
  expires: number
}

export function generateJWT(): string {
  const payload: JWTPayload = {
    sub: 'guest',
    name: 'Guest',
    alg: 'HS256',
    typ: 'JWT',
    iat: Math.floor(Date.now() / 1000),
    expires: 9999999999,
  }

  // Using a secret key for signing the token
  const secret = 'secret_key' // In production, this should be an environment variable
  const token = jwtEncode(payload, secret)

  return token
}
