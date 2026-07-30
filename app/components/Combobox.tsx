'use client'

import { useState, useRef, useEffect, type KeyboardEvent } from 'react'

export interface ComboboxOption {
	value: string
	label: string
}

export function Combobox({
	value,
	onChange,
	options,
	placeholder,
	className,
	tabIndex,
}: {
	value: string
	onChange: (value: string) => void
	options: ComboboxOption[]
	placeholder?: string
	className?: string
	tabIndex?: number
}) {
	const [query, setQuery] = useState('')
	const [open, setOpen] = useState(false)
	const [highlight, setHighlight] = useState(0)
	const ref = useRef<HTMLDivElement>(null)

	const selected = options.find((o) => o.value === value)
	const inputText = open ? query : (selected?.label ?? '')

	const filtered = query
		? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
		: options

	useEffect(() => {
		const handler = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				setOpen(false)
				setQuery('')
			}
		}
		document.addEventListener('mousedown', handler)
		return () => document.removeEventListener('mousedown', handler)
	}, [])

	const select = (val: string) => {
		onChange(val)
		setOpen(false)
		setQuery('')
	}

	const onKey = (e: KeyboardEvent) => {
		if (e.key === 'ArrowDown') {
			e.preventDefault()
			setOpen(true)
			setHighlight((h) => Math.min(h + 1, filtered.length - 1))
		} else if (e.key === 'ArrowUp') {
			e.preventDefault()
			setHighlight((h) => Math.max(h - 1, 0))
		} else if (e.key === 'Enter' && open && filtered[highlight]) {
			e.preventDefault()
			select(filtered[highlight].value)
		} else if (e.key === 'Escape') {
			setOpen(false)
			setQuery('')
		}
	}

	return (
		<div ref={ref} className="relative">
			<input
				className={className}
				value={inputText}
				placeholder={placeholder}
				tabIndex={tabIndex}
				onChange={(e) => {
					setQuery(e.target.value)
					setOpen(true)
					setHighlight(0)
				}}
				onFocus={() => {
					setOpen(true)
					setQuery('')
				}}
				onBlur={() => {
					setOpen(false)
					setQuery('')
				}}
				onKeyDown={onKey}
			/>
			{open && (
				<div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
					{filtered.length === 0 ? (
						<div className="px-2 py-1 text-xs text-gray-400">No matches</div>
					) : (
						filtered.map((o, i) => (
							<button
								key={o.value}
								type="button"
								className={`block w-full px-2 py-1 text-left text-sm ${i === highlight
										? 'bg-blue-50 dark:bg-gray-700'
										: 'hover:bg-blue-50 dark:hover:bg-gray-700'
									}`}
								onClick={() => select(o.value)}
								onMouseDown={(e) => e.preventDefault()}
								onMouseEnter={() => setHighlight(i)}
							>
								{o.label}
							</button>
						))
					)}
				</div>
			)}
		</div>
	)
}
