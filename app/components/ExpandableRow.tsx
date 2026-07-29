'use client'

import { useState, type ReactNode } from 'react'

export function useExpanded() {
	const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
	const toggleExpand = (id: string) =>
		setExpandedIds((prev) => {
			const next = new Set(prev)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})
	return { expandedIds, toggleExpand }
}

export function ExpandableRow({
	isExpanded,
	onToggle,
	summary,
	details,
	actions,
}: {
	isExpanded: boolean
	onToggle: () => void
	summary: ReactNode
	details: ReactNode
	actions?: ReactNode
}) {
	return (
		<div>
			<div className="group flex items-center gap-2">
				<button type="button" onClick={onToggle} className="flex flex-1 items-center gap-2 text-left min-w-0">
					<span className="select-none text-xs text-gray-400">{isExpanded ? '▾' : '▸'}</span>
					{summary}
				</button>
				{actions}
			</div>
			{isExpanded && (
				<div className="mt-2 border-t border-gray-100 dark:border-gray-800 pt-2 text-sm text-gray-600 dark:text-gray-400">
					{details}
				</div>
			)}
		</div>
	)
}
