'use client'

import { useState, type ReactNode } from 'react'

export type ToastType = 'success' | 'error'
export interface ToastMsg {
	id: number
	type: ToastType
	message: string
}

let toastCounter = 0

export function useToast() {
	const [toasts, setToasts] = useState<ToastMsg[]>([])

	const showToast = (type: ToastType, message: string) => {
		const id = ++toastCounter
		setToasts((prev) => [...prev, { id, type, message }])
		setTimeout(() => {
			setToasts((prev) => prev.filter((t) => t.id !== id))
		}, 3000)
	}

	return { showToast, toasts }
}

export const inputCls =
	'block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none'

export const btnPrimary =
	'rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50'
export const btnGhost =
	'rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
export const btnDanger =
	'rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950'

export function Toasts({ toasts }: { toasts: ToastMsg[] }) {
	return (
		<div className="fixed bottom-4 right-4 z-50 space-y-2">
			{toasts.map((t) => (
				<div
					key={t.id}
					className={`rounded-md px-4 py-2 text-sm shadow-lg ${t.type === 'success'
							? 'border border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200'
							: 'border border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200'
						}`}
				>
					{t.message}
				</div>
			))}
		</div>
	)
}

export function SectionCard({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
	return (
		<div className="rounded-lg border border-gray-200 dark:border-gray-800">
			<div className="flex items-center justify-between px-3 py-2">
				<span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
					{title}
					{count !== undefined && (
						<span className="ml-2 text-xs text-gray-400">({count})</span>
					)}
				</span>
			</div>
			<div className="px-3 pb-3">{children}</div>
		</div>
	)
}

export function EmptyState({ message }: { message: string }) {
	return (
		<div className="py-6 text-center text-sm text-gray-400">{message}</div>
	)
}
