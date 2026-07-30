'use client'

import { useMemo, useState } from 'react'
import { api } from '../api'
import type { Attributes, Item } from '../types'

type ToastType = 'success' | 'error'

const inputCls =
	'block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none'

const btnPrimary =
	'rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50'
const btnGhost =
	'rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
const btnDanger =
	'rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950'

interface ValueOccurrence {
	count: number
	items: { item: Item; rawValue: string | string[] }[]
}

type Analysis = Map<string, Map<string, ValueOccurrence>>

interface FlaggedEntry {
	key: string
	value: string
	item: Item
	rawValue: string | string[]
	allValues: { value: string; count: number }[]
}

interface SimilarKeyPair {
	keyA: string
	keyB: string
	distance: number
	similarity: number
	countA: number
	countB: number
}

function levenshtein(a: string, b: string): number {
	if (a === b) return 0
	if (a.length === 0) return b.length
	if (b.length === 0) return a.length
	const prev = new Array(b.length + 1)
	const curr = new Array(b.length + 1)
	for (let j = 0; j <= b.length; j++) prev[j] = j
	for (let i = 1; i <= a.length; i++) {
		curr[0] = i
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1
			curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
		}
		prev.splice(0, prev.length, ...curr)
	}
	return prev[b.length]
}

function isNumeric(s: string): boolean {
	return /^-?\d+(\.\d+)?$/.test(s.trim())
}

function hasLetters(s: string): boolean {
	return /[a-zA-Z]/.test(s)
}

function analyze(items: Item[]): Analysis {
	const byKey: Analysis = new Map()
	for (const item of items) {
		if (!item.attributes) continue
		for (const [key, val] of Object.entries(item.attributes)) {
			if (!byKey.has(key)) byKey.set(key, new Map())
			const valMap = byKey.get(key)!
			const vals = Array.isArray(val) ? val : [val]
			for (const v of vals) {
				if (!valMap.has(v)) valMap.set(v, { count: 0, items: [] })
				const entry = valMap.get(v)!
				entry.count++
				entry.items.push({ item, rawValue: val })
			}
		}
	}
	return byKey
}

function fixValue(item: Item, key: string, oldValue: string, newValue: string): Attributes {
	const attrs: Attributes = { ...item.attributes }
	const current = attrs[key]
	if (current === undefined) return attrs
	if (Array.isArray(current)) {
		attrs[key] = current.map((v) => (v === oldValue ? newValue : v))
	} else if (current === oldValue) {
		attrs[key] = newValue
	}
	return attrs
}

function deleteValue(item: Item, key: string, value: string): Attributes {
	const attrs: Attributes = { ...item.attributes }
	const current = attrs[key]
	if (current === undefined) return attrs
	if (Array.isArray(current)) {
		const filtered = current.filter((v) => v !== value)
		if (filtered.length === 0) delete attrs[key]
		else if (filtered.length === 1) attrs[key] = filtered[0]
		else attrs[key] = filtered
	} else if (current === value) {
		delete attrs[key]
	}
	return attrs
}

function mergeKey(item: Item, fromKey: string, toKey: string): Attributes {
	const attrs: Attributes = { ...item.attributes }
	const fromVal = attrs[fromKey]
	if (fromVal === undefined) return attrs
	delete attrs[fromKey]
	if (fromKey === toKey) return attrs
	const toVal = attrs[toKey]
	const fromVals = Array.isArray(fromVal) ? fromVal : [fromVal]
	if (toVal === undefined) {
		attrs[toKey] = fromVals.length === 1 ? fromVals[0] : fromVals
	} else {
		const toVals = Array.isArray(toVal) ? toVal : [toVal]
		const merged = [...toVals]
		for (const v of fromVals) {
			if (!merged.includes(v)) merged.push(v)
		}
		attrs[toKey] = merged.length === 1 ? merged[0] : merged
	}
	return attrs
}

export function CleanupTab({
	items,
	onChanged,
	showToast,
}: {
	items: Item[]
	onChanged: () => void
	showToast: (type: ToastType, message: string) => void
}) {
	const analysis = useMemo(() => analyze(items), [items])

	const flagged = useMemo<FlaggedEntry[]>(() => {
		const result: FlaggedEntry[] = []
		for (const [key, valMap] of analysis) {
			const allValues = Array.from(valMap.entries())
				.map(([value, occ]) => ({ value, count: occ.count }))
				.sort((a, b) => b.count - a.count)
			const numericCount = allValues.filter((v) => isNumeric(v.value)).length
			if (numericCount === allValues.length) continue
			const mostlyNumeric = numericCount > allValues.length / 2
			for (const [value, occ] of valMap) {
				if (mostlyNumeric) {
					if (hasLetters(value)) {
						for (const { item, rawValue } of occ.items) {
							result.push({ key, value, item, rawValue, allValues })
						}
					}
				} else if (occ.count === 1 && occ.items.length === 1) {
					result.push({
						key,
						value,
						item: occ.items[0].item,
						rawValue: occ.items[0].rawValue,
						allValues,
					})
				}
			}
		}
		return result.sort((a, b) => a.key.localeCompare(b.key) || a.value.localeCompare(b.value))
	}, [analysis])

	const similarKeys = useMemo<SimilarKeyPair[]>(() => {
		const keys = Array.from(analysis.keys())
		const result: SimilarKeyPair[] = []
		for (let i = 0; i < keys.length; i++) {
			for (let j = i + 1; j < keys.length; j++) {
				const a = keys[i]
				const b = keys[j]
				const dist = levenshtein(a.toLowerCase(), b.toLowerCase())
				const maxLen = Math.max(a.length, b.length)
				const similarity = 1 - dist / maxLen
				if (dist > 0 && similarity >= 0.7) {
					result.push({
						keyA: a,
						keyB: b,
						distance: dist,
						similarity,
						countA: analysis.get(a)!.size,
						countB: analysis.get(b)!.size,
					})
				}
			}
		}
		return result.sort((x, y) => y.similarity - x.similarity)
	}, [analysis])

	const [editKey, setEditKey] = useState<string | null>(null)
	const [editItemId, setEditItemId] = useState<string | null>(null)
	const [editValue, setEditValue] = useState('')

	const startEdit = (key: string, itemId: string, value: string) => {
		setEditKey(key)
		setEditItemId(itemId)
		setEditValue(value)
	}

	const handleFix = async (entry: FlaggedEntry) => {
		if (!editValue.trim()) return
		try {
			const newAttrs = fixValue(entry.item, entry.key, entry.value, editValue.trim())
			await api.items.update(entry.item.id, { attributes: newAttrs })
			showToast('success', `Fixed "${entry.value}" → "${editValue.trim()}" on ${entry.item.name ?? entry.item.id}`)
			setEditKey(null)
			setEditItemId(null)
			onChanged()
		} catch (err) {
			showToast('error', err instanceof Error ? err.message : 'Failed to fix value')
		}
	}

	const handleDelete = async (entry: FlaggedEntry) => {
		try {
			const newAttrs = deleteValue(entry.item, entry.key, entry.value)
			await api.items.update(entry.item.id, { attributes: newAttrs })
			showToast('success', `Deleted "${entry.value}" from ${entry.item.name ?? entry.item.id}`)
			onChanged()
		} catch (err) {
			showToast('error', err instanceof Error ? err.message : 'Failed to delete value')
		}
	}

	const [mergeFrom, setMergeFrom] = useState<string | null>(null)
	const [mergeTo, setMergeTo] = useState<string | null>(null)

	const startMerge = (fromKey: string, toKey: string) => {
		setMergeFrom(fromKey)
		setMergeTo(toKey)
	}

	const handleMerge = async () => {
		if (!mergeFrom || !mergeTo || mergeFrom === mergeTo) return
		const affected = items.filter((it) => it.attributes[mergeFrom] !== undefined)
		try {
			for (const it of affected) {
				const newAttrs = mergeKey(it, mergeFrom, mergeTo)
				await api.items.update(it.id, { attributes: newAttrs })
			}
			showToast('success', `Merged "${mergeFrom}" into "${mergeTo}" across ${affected.length} item${affected.length === 1 ? '' : 's'}`)
			setMergeFrom(null)
			setMergeTo(null)
			onChanged()
		} catch (err) {
			showToast('error', err instanceof Error ? err.message : 'Failed to merge keys')
		}
	}

	if (items.length === 0) {
		return <div className="py-6 text-center text-sm text-gray-400">No items to analyze.</div>
	}

	if (flagged.length === 0 && similarKeys.length === 0) {
		return <div className="py-6 text-center text-sm text-gray-400">No issues found. Everything looks consistent!</div>
	}

	const grouped = flagged.reduce<Record<string, FlaggedEntry[]>>((acc, entry) => {
		(acc[entry.key] ??= []).push(entry)
		return acc
	}, {})

	return (
		<div className="space-y-4">
			{similarKeys.length > 0 && (
				<>
					<div className="rounded-md border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 p-3 text-sm text-amber-700 dark:text-amber-300">
						<strong>{similarKeys.length}</strong> pair{similarKeys.length === 1 ? '' : 's'} of similar attribute names found. These may be spelling variations.
					</div>
					{similarKeys.map((pair) => {
						const isMerging = mergeFrom === pair.keyA && mergeTo === pair.keyB || mergeFrom === pair.keyB && mergeTo === pair.keyA
						return (
							<div key={`${pair.keyA}-${pair.keyB}`} className="rounded-lg border border-gray-200 dark:border-gray-800">
								<div className="space-y-2 p-3">
									<div className="flex items-center gap-2">
										<span className="font-mono text-sm text-blue-600 dark:text-blue-400">{pair.keyA}</span>
										<span className="text-xs text-gray-400">vs</span>
										<span className="font-mono text-sm text-blue-600 dark:text-blue-400">{pair.keyB}</span>
										<span className="ml-auto text-xs text-gray-400">{Math.round(pair.similarity * 100)}% similar</span>
									</div>
									<div className="flex gap-3 text-xs text-gray-500">
										<span>{pair.keyA}: {pair.countA} value{pair.countA === 1 ? '' : 's'}</span>
										<span>{pair.keyB}: {pair.countB} value{pair.countB === 1 ? '' : 's'}</span>
									</div>
									{isMerging ? (
										<div className="flex items-center gap-2">
											<span className="text-xs text-gray-600 dark:text-gray-400">Merge</span>
											<button onClick={() => { setMergeFrom(pair.keyA); setMergeTo(pair.keyB) }} className={`rounded px-2 py-0.5 text-xs ${mergeFrom === pair.keyA ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>{pair.keyA}</button>
											<span className="text-xs text-gray-400">←</span>
											<button onClick={() => { setMergeFrom(pair.keyB); setMergeTo(pair.keyA) }} className={`rounded px-2 py-0.5 text-xs ${mergeFrom === pair.keyB ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>{pair.keyB}</button>
											<div className="ml-auto flex gap-1">
												<button onClick={() => handleMerge()} className={btnPrimary}>Merge</button>
												<button onClick={() => { setMergeFrom(null); setMergeTo(null) }} className={btnGhost}>Cancel</button>
											</div>
										</div>
									) : (
										<div className="flex justify-end gap-1">
											<button onClick={() => startMerge(pair.keyA, pair.keyB)} className={btnGhost}>Merge</button>
										</div>
									)}
								</div>
							</div>
						)
					})}
				</>
			)}
			{flagged.length > 0 && (
				<>
					<div className="rounded-md border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 p-3 text-sm text-amber-700 dark:text-amber-300">
						<strong>{flagged.length}</strong> attribute value{flagged.length === 1 ? '' : 's'} may need attention — single-occurrence values or non-numeric values in mostly-numeric fields.
					</div>
					{Object.entries(grouped).map(([key, entries]) => (
						<div key={key} className="rounded-lg border border-gray-200 dark:border-gray-800">
							<div className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3 py-2">
								<span className="text-sm font-medium text-gray-700 dark:text-gray-300">{key}</span>
								<span className="ml-2 text-xs text-gray-400">{entries.length} flagged</span>
							</div>
							<div className="space-y-1 p-2">
								<div className="mb-2 flex flex-wrap gap-1.5">
									{entries[0].allValues.map((v) => (
										<span
											key={v.value}
											className={`rounded px-1.5 py-0.5 text-xs ${v.count === 1 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}
										>
											{v.value} <span className="opacity-50">×{v.count}</span>
										</span>
									))}
								</div>
								{entries.map((entry) => {
									const isEditing = editKey === entry.key && editItemId === entry.item.id
									return (
										<div key={`${entry.item.id}-${entry.value}`} className="flex items-center gap-2 rounded-md border border-gray-100 dark:border-gray-800 p-2">
											<div className="min-w-0 flex-1">
												<div className="flex items-center gap-2">
													<span className="font-mono text-sm text-red-600 dark:text-red-400">{entry.value}</span>
													<span className="text-xs text-gray-400">on</span>
													<span className="truncate text-sm text-gray-700 dark:text-gray-300">{entry.item.name ?? entry.item.id}</span>
												</div>
												{isEditing && (
													<div className="mt-2 space-y-2">
														<input
															className={inputCls}
															value={editValue}
															onChange={(e) => setEditValue(e.target.value)}
															placeholder="Corrected value"
															autoFocus
														/>
														<div className="flex flex-wrap gap-1">
															{entry.allValues.filter((v) => v.count > 1).map((v) => (
																<button
																	key={v.value}
																	type="button"
																	className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
																	onClick={() => setEditValue(v.value)}
																>
																	{v.value}
																</button>
															))}
														</div>
													</div>
												)}
											</div>
											{isEditing ? (
												<div className="flex shrink-0 gap-1">
													<button onClick={() => handleFix(entry)} className={btnPrimary}>Save</button>
													<button onClick={() => { setEditKey(null); setEditItemId(null) }} className={btnGhost}>Cancel</button>
												</div>
											) : (
												<div className="flex shrink-0 gap-1">
													<button onClick={() => startEdit(entry.key, entry.item.id, entry.value)} className={btnGhost}>Fix</button>
													<button onClick={() => handleDelete(entry)} className={btnDanger}>Delete</button>
												</div>
											)}
										</div>
									)
								})}
							</div>
						</div>
					))}
				</>
			)}
		</div>
	)
}
