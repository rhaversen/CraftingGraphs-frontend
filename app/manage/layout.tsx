'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import type { ReactNode } from 'react'
import { useGameData } from '../components/GameDataProvider'

export default function ManageLayout({ children }: { children: ReactNode }) {
	const { games, items, benches, recipes, loading, error, clearError } = useGameData()
	const searchParams = useSearchParams()
	const selectedGameId = searchParams.get('game')
	const pathname = usePathname()

	if (loading) {
		return (
			<main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-4">
				<div className="h-10 w-64 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
				<div className="h-96 w-full animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800" />
			</main>
		)
	}

	const gameItems = items.filter((i) => i.gameId === selectedGameId)
	const gameBenches = benches.filter((b) => b.gameId === selectedGameId)
	const gameRecipes = recipes.filter((r) => r.gameId === selectedGameId)

	const tabs: { href: string; label: string; count: number }[] = [
		{ href: '/manage/games', label: 'Games', count: games.length },
		{ href: '/manage/items', label: 'Items', count: gameItems.length },
		{ href: '/manage/benches', label: 'Benches', count: gameBenches.length },
		{ href: '/manage/recipes', label: 'Recipes', count: gameRecipes.filter((r) => r.outputs.length > 0).length },
		{ href: '/manage/missing', label: 'Missing', count: 0 },
		{ href: '/manage/cleanup', label: 'Cleanup', count: 0 },
	]

	return (
		<main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-4">
			{error && (
				<div className="rounded-md border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950 p-2 text-sm text-red-700 dark:text-red-300">
					{error}
					<button className="ml-2 underline" onClick={clearError}>dismiss</button>
				</div>
			)}

			{!selectedGameId && pathname !== '/manage/games' && (
				<div className="rounded-md border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 p-2 text-sm text-amber-700 dark:text-amber-300">
					Select a game in the navbar above to manage its items, benches, and recipes. The Games tab is always available.
				</div>
			)}

			{/* Tab bar */}
			<div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
				{tabs.map((t) => {
					const active = pathname === t.href
					const href = selectedGameId ? `${t.href}?game=${selectedGameId}` : t.href
					return (
						<Link
							key={t.href}
							href={href}
							className={`rounded-t-md px-4 py-2 text-sm font-medium transition-colors ${active
									? 'border-x border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400'
									: 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
								}`}
						>
							{t.label}
							<span className="ml-1.5 text-xs text-gray-400">{t.count}</span>
						</Link>
					)
				})}
			</div>

			{children}
		</main>
	)
}
