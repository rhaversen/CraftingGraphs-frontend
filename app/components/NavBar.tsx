'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useGameData } from './GameDataProvider'
import { useTheme } from './ThemeProvider'

export default function NavBar() {
	const { theme, toggleTheme } = useTheme()
	const { games, refreshing, refreshAll } = useGameData()
	const pathname = usePathname()
	const router = useRouter()
	const searchParams = useSearchParams()
	const selectedGameId = searchParams.get('game')

	const setGame = (id: string | null) => {
		const params = new URLSearchParams(searchParams.toString())
		if (id) params.set('game', id)
		else params.delete('game')
		router.push(`${pathname}?${params.toString()}`)
	}

	const navLink = (href: string, label: string) => {
		const active = pathname === href || (href === '/' && pathname === '/')
		return (
			<Link
				href={selectedGameId ? `${href}?game=${selectedGameId}` : href}
				className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${active
						? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
						: 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
					}`}
			>
				{label}
			</Link>
		)
	}

	return (
		<header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 px-4 py-3 backdrop-blur-sm">
			<div className="flex items-center gap-4">
				<Link href="/" className="text-xl font-bold text-gray-800 dark:text-gray-200">
					CraftingGraphs
				</Link>
				<nav className="flex items-center gap-1">
					{navLink('/', 'Explore')}
					{navLink('/manage', 'Manage')}
				</nav>
			</div>
			<div className="flex items-center gap-2">
				<select
					className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm"
					value={selectedGameId ?? ''}
					onChange={(e) => setGame(e.target.value || null)}
				>
					<option value="">Select a game...</option>
					{games.map((g) => (
						<option key={g.id} value={g.id}>
							{g.name}
						</option>
					))}
				</select>
				<button
					onClick={toggleTheme}
					className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
					title="Toggle dark mode"
				>
					{theme === 'dark' ? '☀' : '☾'}
				</button>
				<button
					onClick={refreshAll}
					disabled={refreshing}
					className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
					title="Refresh data"
				>
					{refreshing ? '↻' : '⟳'} Refresh
				</button>
			</div>
		</header>
	)
}
