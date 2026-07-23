import { useEffect, useState } from 'react'
import { debounce } from 'obsidian'
import { useApp } from '../context'

/**
 * Increments (debounced) whenever vault metadata changes — components derive
 * vault-backed data with useMemo keyed on this version.
 */
export function useVaultVersion(): number {
	const app = useApp()
	const [version, setVersion] = useState(0)

	useEffect(() => {
		const bump = debounce(() => setVersion((v) => v + 1), 150)
		const metaRef = app.metadataCache.on('changed', bump)
		const deleteRef = app.vault.on('delete', bump)
		const renameRef = app.vault.on('rename', bump)
		return () => {
			app.metadataCache.offref(metaRef)
			app.vault.offref(deleteRef)
			app.vault.offref(renameRef)
		}
	}, [app])

	return version
}
