import { App } from 'obsidian'

export interface PortfolioSnapshot {
	/** ISO date (YYYY-MM-DD). One snapshot per day — same-day updates replace. */
	date: string
	/** Total collection market value in USD. */
	value: number
}

/**
 * Append-only portfolio value history, stored as JSON in the plugin dir.
 * Derived data — the source of truth (prices per card) lives in card notes.
 */
export class PortfolioHistory {
	constructor(
		private readonly app: App,
		private readonly filePath: () => string,
	) {}

	async read(): Promise<PortfolioSnapshot[]> {
		try {
			const adapter = this.app.vault.adapter
			const path = this.filePath()
			if (!(await adapter.exists(path))) return []
			const parsed = JSON.parse(await adapter.read(path)) as unknown
			if (!Array.isArray(parsed)) return []
			return parsed.filter(
				(item): item is PortfolioSnapshot =>
					typeof item === 'object' &&
					item !== null &&
					typeof (item as PortfolioSnapshot).date === 'string' &&
					typeof (item as PortfolioSnapshot).value === 'number',
			)
		} catch {
			return []
		}
	}

	async append(snapshot: PortfolioSnapshot): Promise<void> {
		const history = await this.read()
		const next = [...history.filter((item) => item.date !== snapshot.date), snapshot].sort((a, b) =>
			a.date.localeCompare(b.date),
		)
		await this.app.vault.adapter.write(this.filePath(), JSON.stringify(next))
	}
}
