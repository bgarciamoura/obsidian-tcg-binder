import type { CardCondition, CardVariant } from '../types'
import type { CardListError } from './card-list'
import { stripLeadingZeros } from './card-list'

/**
 * Header-based mapping of collection CSVs from other apps (ManaBox, Collectr,
 * TCG Collector, ...). There is no universal column standard, so each field
 * accepts the aliases seen in the wild; only a name column is mandatory.
 */

export interface CsvCardRow {
	name: string
	setCode: string | null
	setName: string | null
	number: string | null
	quantity: number
	variant: CardVariant
	condition: CardCondition
	/** 1-based line in the CSV (header is line 1). */
	line: number
}

export interface CsvImportResult {
	rows: CsvCardRow[]
	errors: CardListError[]
}

const HEADER_ALIASES: Record<string, string[]> = {
	name: ['name', 'card name', 'card', 'product name'],
	setCode: ['set code', 'set_code', 'code'],
	setName: ['set name', 'set_name', 'set', 'expansion', 'edition'],
	number: ['collector number', 'collector_number', 'card number', 'number', 'no'],
	quantity: ['quantity', 'qty', 'count', 'amount'],
	variant: ['foil', 'printing', 'variant', 'variance', 'finish'],
	condition: ['condition', 'cond'],
}

export function mapCsvRows(cells: string[][]): CsvImportResult {
	if (cells.length === 0) return { rows: [], errors: [] }

	const header = cells[0].map((cell) => cell.trim().toLowerCase())
	const columnOf = (field: string) =>
		header.findIndex((cell) => HEADER_ALIASES[field].includes(cell))

	const nameCol = columnOf('name')
	if (nameCol < 0) {
		return { rows: [], errors: [{ line: 1, text: 'No name column found in the CSV header' }] }
	}
	const setCodeCol = columnOf('setCode')
	const setNameCol = columnOf('setName')
	const numberCol = columnOf('number')
	const quantityCol = columnOf('quantity')
	const variantCol = columnOf('variant')
	const conditionCol = columnOf('condition')

	const rows: CsvCardRow[] = []
	const errors: CardListError[] = []

	for (let i = 1; i < cells.length; i++) {
		const cell = (col: number) => (col >= 0 ? (cells[i][col] ?? '').trim() : '')
		const name = cell(nameCol)
		if (!name) {
			errors.push({ line: i + 1, text: cells[i].join(',') })
			continue
		}

		const rawQty = cell(quantityCol)
		const quantity = rawQty ? Number(rawQty) : 1
		if (!Number.isInteger(quantity) || quantity <= 0) {
			errors.push({ line: i + 1, text: cells[i].join(',') })
			continue
		}

		rows.push({
			name,
			setCode: cell(setCodeCol).toUpperCase() || null,
			setName: cell(setNameCol) || null,
			number: normalizeNumber(cell(numberCol)),
			quantity,
			variant: mapVariant(cell(variantCol)),
			condition: mapCondition(cell(conditionCol)),
			line: i + 1,
		})
	}

	return { rows, errors }
}

/** "045/198" → "45"; keeps letter-prefixed numbers ("TG12") intact. */
function normalizeNumber(value: string): string | null {
	if (!value) return null
	return stripLeadingZeros(value.split('/')[0].trim())
}

function mapVariant(value: string): CardVariant {
	const v = value.toLowerCase()
	if (v.includes('reverse')) return 'reverse-holo'
	if (v.includes('holo') || v === 'foil' || v === 'true' || v === 'etched') return 'holo'
	if (v.includes('promo')) return 'promo'
	return 'normal'
}

function mapCondition(value: string): CardCondition {
	const v = value.toLowerCase()
	if (v === 'nm' || v.includes('near mint') || v === 'mint' || v === 'm') return 'NM'
	if (v === 'lp' || v.includes('lightly') || v.includes('excellent') || v === 'ex' || v === 'good') return 'LP'
	if (v === 'mp' || v.includes('moderately') || v === 'played') return 'MP'
	if (v === 'hp' || v.includes('heavily')) return 'HP'
	if (v === 'dmg' || v.includes('damaged') || v === 'poor') return 'DMG'
	return 'NM'
}
