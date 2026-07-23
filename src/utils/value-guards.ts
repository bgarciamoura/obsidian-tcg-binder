/** Narrow an unknown (frontmatter, JSON) to a plain object before property access. */
export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}
