declare module 'jwt-encode' {
  interface JWTPayload {
    sub: string
    name: string
    iat: number
    expires: number
    [key: string]: unknown
  }

  const jwtEncode: (payload: JWTPayload, secret: string) => string
  export default jwtEncode
}
