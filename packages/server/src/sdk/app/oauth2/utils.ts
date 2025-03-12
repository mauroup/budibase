import fetch from "node-fetch"
import { HttpError } from "koa"
import { get } from "../oauth2"

export async function generateToken(id: string) {
  const config = await get(id)
  if (!config) {
    throw new HttpError(`oAuth config ${id} count not be found`)
  }

  const resp = await fetch(config.url, { method: "post" })
  const jsonResponse = await resp.json()
  return `${jsonResponse.token_type} ${jsonResponse.access_token}`
}
