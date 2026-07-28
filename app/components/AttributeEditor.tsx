'use client'

import type { Attributes } from '../types'

export interface AttrRow {
	key: string
	value: string
}

export function attrsToRows(attrs: Attributes | undefined | null): AttrRow[] {
	if (!attrs) return [{ key: '', value: '' }]
	const rows = Object.entries(attrs).map(([k, v]) => ({
		key: k,
		value: Array.isArray(v) ? v.join(', ') : v,
	}))
	return rows.length > 0 ? rows : [{ key: '', value: '' }]
}

export function keysToRows(keys: string[] | undefined | null): AttrRow[] {
	if (!keys || keys.length === 0) return [{ key: '', value: '' }]
	return keys.map((key) => ({ key, value: '' }))
}

export function rowsToAttrs(rows: AttrRow[]): Attributes {
	const result: Attributes = {}
	for (const row of rows) {
		const key = row.key.trim()
		if (!key) continue
		const parts = row.value.split(',').map((p) => p.trim()).filter(Boolean)
		if (parts.length === 0) continue
		result[key] = parts.length === 1 ? parts[0] : parts
	}
	return result
}

const inputCls =
	'rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none'

export function AttributeEditor({
	rows,
	setRows,
	label = 'Custom Attributes',
}: {
	rows: AttrRow[]
	setRows: (r: AttrRow[]) => void
	label?: string
}) {
	const update = (idx: number, patch: Partial<AttrRow>) =>
		setRows(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)))

	return (
		<div>
			<span className="text-xs font-medium text-gray-600 dark:text-gray-400">{label}</span>
			<div className="space-y-1">
				{rows.map((row, idx) => (
					<div key={idx} className="flex gap-1">
						<input
							className={inputCls}
							value={row.key}
							onChange={(e) => update(idx, { key: e.target.value })}
							placeholder="key"
						/>
						<input
							className={inputCls}
							value={row.value}
							onChange={(e) => update(idx, { value: e.target.value })}
							placeholder="value (comma-separate for list)"
						/>
						{rows.length > 1 && (
							<button
								type="button"
								onClick={() => setRows(rows.filter((_, i) => i !== idx))}
								className="rounded px-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
							>
								✕
							</button>
						)}
					</div>
				))}
			</div>
			<button
				type="button"
				onClick={() => setRows([...rows, { key: '', value: '' }])}
				className="mt-1 text-xs text-blue-600 hover:underline"
			>
				+ Add attribute
			</button>
		</div>
	)
}
