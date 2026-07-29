'use client'

import { AttributeEditor, type AttrRow } from './AttributeEditor'

const inputCls =
	'block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none'

export function NewItemFields({
	name,
	setName,
	category,
	setCategory,
	attrRows,
	setAttrRows,
	autoFocus,
	existingNames,
	ref,
}: {
	name: string
	setName: (s: string) => void
	category: string
	setCategory: (s: string) => void
	attrRows: AttrRow[]
	setAttrRows: (r: AttrRow[]) => void
	autoFocus?: boolean
	existingNames?: string[]
	ref?: React.Ref<HTMLInputElement>
}) {
	const trimmed = name.trim().toLowerCase()
	const isDuplicate = trimmed !== '' && existingNames?.some((n) => n.toLowerCase() === trimmed) === true
	return (
		<div className="space-y-2">
			<input
				ref={ref}
				className={`${inputCls} ${isDuplicate ? 'border-red-500 focus:border-red-500' : ''}`}
				value={name}
				onChange={(e) => setName(e.target.value)}
				placeholder="Item name"
				autoFocus={autoFocus}
				tabIndex={1}
			/>
			{isDuplicate && (
				<p className="text-xs text-red-600 dark:text-red-400">An item with this name already exists</p>
			)}
			<input
				className={inputCls}
				value={category}
				onChange={(e) => setCategory(e.target.value)}
				placeholder="Category (optional)"
				tabIndex={2}
			/>
			<AttributeEditor rows={attrRows} setRows={setAttrRows} baseTabIndex={3} />
		</div>
	)
}
