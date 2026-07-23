import { describe, expect, it } from 'vitest'
import { sanitizeFileName } from '../src/utils/file-name'

describe('sanitizeFileName', () => {
	it('keeps ordinary card note titles untouched', () => {
		expect(sanitizeFileName('Pikachu ex (SVI 45)')).toBe('Pikachu ex (SVI 45)')
	})

	it('keeps apostrophes', () => {
		expect(sanitizeFileName("N's Zoroark (STG 98)")).toBe("N's Zoroark (STG 98)")
	})

	it('removes characters Obsidian forbids in file names', () => {
		expect(sanitizeFileName('Type: Null (CIN 108)')).toBe('Type Null (CIN 108)')
		expect(sanitizeFileName('a/b\\c:d*e?f"g<h>i|j#k^l[m]n')).toBe('abcdefghijklmn')
	})

	it('collapses whitespace left behind by removed characters', () => {
		expect(sanitizeFileName('  a   b  ')).toBe('a b')
	})
})
