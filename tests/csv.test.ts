import { describe, expect, it } from 'vitest'
import { parseCsv } from '../src/domain/csv'

describe('parseCsv', () => {
	it('parses plain rows', () => {
		expect(parseCsv('a,b,c\n1,2,3')).toEqual([
			['a', 'b', 'c'],
			['1', '2', '3'],
		])
	})

	it('handles quoted fields with commas and escaped quotes', () => {
		expect(parseCsv('"Pikachu, ex","he said ""hi""",3')).toEqual([
			['Pikachu, ex', 'he said "hi"', '3'],
		])
	})

	it('handles newlines inside quotes and CRLF endings', () => {
		expect(parseCsv('"line1\nline2",x\r\na,b')).toEqual([
			['line1\nline2', 'x'],
			['a', 'b'],
		])
	})

	it('skips fully empty trailing lines', () => {
		expect(parseCsv('a,b\n\n')).toEqual([['a', 'b']])
	})
})
