import { sleep } from "@/lib/utils" // Assume this import exists

const RATE_LIMIT_INTERVAL = 60000 // 1 minute
const MAX_REQUESTS_PER_MINUTE = 5 // Adjust this based on your rate limit
let requestCount = 0
let lastResetTime = Date.now()

export async function rateLimitedRequest<T>(fn: () => Promise<T>): Promise<T> {
  const now = Date.now()
  if (now - lastResetTime >= RATE_LIMIT_INTERVAL) {
    requestCount = 0
    lastResetTime = now
  }

  if (requestCount >= MAX_REQUESTS_PER_MINUTE) {
    const timeToWait = RATE_LIMIT_INTERVAL - (now - lastResetTime)
    console.log(`Rate limit reached. Waiting ${timeToWait}ms before next request.`)
    await sleep(timeToWait)
    return rateLimitedRequest(fn) // Recursively call after waiting
  }

  requestCount++
  try {
    return await fn()
  } catch (error: any) {
    if (error.response?.status === 429) {
      console.log("Rate limit exceeded. Waiting before retrying...")
      await sleep(RATE_LIMIT_INTERVAL)
      return rateLimitedRequest(fn) // Retry after waiting
    }
    throw error
  }
}