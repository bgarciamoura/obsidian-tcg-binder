import { requestUrl } from 'obsidian'
import type { RequestUrlResponse } from 'obsidian'
import { RateLimitError } from './card-data-source'

export interface JsonRequestOptions {
	headers?: Record<string, string>
	method?: string
	body?: string
}

/**
 * Shared JSON request path for all card APIs: one delayed retry for
 * transient 5xx/network failures, typed RateLimitError on 429, and an
 * error carrying the HTTP status otherwise.
 */
export async function requestJson(url: string, options: JsonRequestOptions = {}): Promise<unknown> {
	const response = await requestWithRetry(url, options)
	if (response.status === 429) throw new RateLimitError()
	if (response.status >= 400) throw new Error(`Card API error (HTTP ${response.status}) at ${url}`)
	return response.json as unknown
}

async function requestWithRetry(
	url: string,
	options: JsonRequestOptions,
): Promise<RequestUrlResponse> {
	const params = {
		url,
		method: options.method ?? 'GET',
		headers: options.headers,
		body: options.body,
		throw: false,
	}
	try {
		const first = await requestUrl(params)
		if (first.status < 500) return first
	} catch {
		// Network-level failure — fall through to the retry.
	}
	await delay(500)
	try {
		return await requestUrl(params)
	} catch (error) {
		// requestUrl can throw raw ("Request failed, status 500") even with
		// throw:false when it cannot process an error response body (e.g. a
		// Cloudflare HTML error page). Never let that escape without context.
		const message = error instanceof Error ? error.message : String(error)
		if (/status 429/.test(message)) throw new RateLimitError()
		throw new Error(`Card API request failed at ${url} (${message})`)
	}
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => window.setTimeout(resolve, ms))
}
