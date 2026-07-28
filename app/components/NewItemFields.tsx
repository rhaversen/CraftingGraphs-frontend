'use client'

import { AttributeEditor, type AttrRow } from './AttributeEditor'

const inputCls =
	'block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none'

export function NewItemFields({
	name,
	setName,
	attrRows,
	setAttrRows,
	autoFocus,
}: {
	name: string
	setName: (s: string) => void
	attrRows: AttrRow[]
	setAttrRows: (r: AttrRow[]) => void
	autoFocus?: boolean
}) {
	return (
		<div className="space-y-2">
			<input
				className={inputCls}
				value={name}
				onChange={(e) => setName(e.target.value)}
				placeholder="Item name"
				autoFocus={autoFocus}
			/>
			<AttributeEditor rows={attrRows} setRows={setAttrRows} />
		</div>
	)
}
