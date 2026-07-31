'use client'

import { AttributeEditor, type AttrRow } from './AttributeEditor'
import { Combobox, type ComboboxOption } from './Combobox'

const inputCls =
	'block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none'

export function NewItemFields({
	name,
	setName,
	category,
	setCategory,
	attrRows,
	setAttrRows,
	autoFocus,
	existingNames,
	categories,
	ref,
	nameTabIndex,
	categoryTabIndex,
	attrBaseTabIndex,
}: {
	name: string
	setName: (s: string) => void
	category: string
	setCategory: (s: string) => void
	attrRows: AttrRow[]
	setAttrRows: (r: AttrRow[]) => void
	autoFocus?: boolean
	existingNames?: string[]
	categories?: ComboboxOption[]
	ref?: React.Ref<HTMLInputElement>
	nameTabIndex?: number
	categoryTabIndex?: number
	attrBaseTabIndex?: number
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
			tabIndex={nameTabIndex ?? 1}
			/>
			{isDuplicate && (
				<p className="text-xs text-red-600 dark:text-red-400">An item with this name already exists</p>
			)}
			{categories ? (
				<Combobox
					className={inputCls}
					value={category}
					onChange={setCategory}
					options={categories}
					placeholder="Category (optional)"
					tabIndex={categoryTabIndex ?? 2}
				/>
			) : (
				<input
					className={inputCls}
					value={category}
					onChange={(e) => setCategory(e.target.value)}
					placeholder="Category (optional)"
					tabIndex={categoryTabIndex ?? 2}
				/>
			)}
			<AttributeEditor rows={attrRows} setRows={setAttrRows} baseTabIndex={attrBaseTabIndex ?? 3} />
		</div>
	)
}
