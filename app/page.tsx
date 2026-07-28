'use client'

import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useGameData } from './components/GameDataProvider'
import RecipeGraph from './components/RecipeGraph'

export default function Page() {
	const { games, items, benches, recipes, loading, error, clearError } = useGameData()
	const searchParams = useSearchParams()
	const selectedGameId = searchParams.get('game')

	const gameItems = useMemo(
		() => items.filter((i) => i.gameId === selectedGameId),
		[items, selectedGameId],
	)
	const gameRecipes = useMemo(
		() => recipes.filter((r) => r.gameId === selectedGameId && r.outputs.length > 0),
		[recipes, selectedGameId],
	)
	const gameBenches = useMemo(
		() => benches.filter((b) => b.gameId === selectedGameId),
		[benches, selectedGameId],
	)

	if (loading) {
		return (
			<main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-4">
				<div className="flex flex-col gap-2">
					<div className="h-5 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
					<div className="h-[60vh] lg:h-[85vh] w-full animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800" />
				</div>
			</main>
		)
	}

	return (
		<main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-4">
			{error && (
				<div className="rounded-md border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950 p-2 text-sm text-red-700 dark:text-red-300">
					{error}
					<button className="ml-2 underline" onClick={clearError}>
						dismiss
					</button>
				</div>
			)}

			{!selectedGameId ? (
				<div className="flex flex-1 flex-col items-center justify-center gap-6 py-8">
					<div className="text-center">
						<div className="text-5xl">🕸</div>
						<p className="mt-3 text-lg font-medium text-gray-600 dark:text-gray-400">Select a game to view its crafting graph</p>
					</div>
					{games.length > 0 ? (
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 max-w-3xl w-full">
							{games.map((g) => {
								const gItems = items.filter((i) => i.gameId === g.id)
								const gRecipes = recipes.filter((r) => r.gameId === g.id && r.outputs.length > 0)
								const gBenches = benches.filter((b) => b.gameId === g.id)
								return (
									<a
										key={g.id}
										href={`/?game=${g.id}`}
										className="group rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm hover:border-blue-400 hover:shadow-md transition-all"
									>
										<div className="font-semibold text-gray-800 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
											{g.name}
										</div>
										<div className="mt-2 flex gap-3 text-xs text-gray-400">
											<span>{gItems.length} items</span>
											<span>{gBenches.length} benches</span>
											<span>{gRecipes.length} recipes</span>
										</div>
									</a>
								)
							})}
						</div>
					) : (
						<p className="text-sm text-gray-400">
							No games yet. Go to <a href="/manage" className="text-blue-600 hover:underline">Manage</a> to create one.
						</p>
					)}
				</div>
			) : (
				<div className="flex flex-1 flex-col gap-2">
					<div className="flex items-center gap-2 text-sm text-gray-500">
						<span>{gameItems.length} items</span>
						<span>·</span>
						<span>{gameBenches.length} benches</span>
						<span>·</span>
						<span>{gameRecipes.length} recipes</span>
					</div>
					<div className="h-[60vh] lg:h-[85vh] w-full rounded-lg border border-gray-200 dark:border-gray-800">
						<RecipeGraph
							items={gameItems}
							benches={gameBenches}
							recipes={gameRecipes}
						/>
					</div>
				</div>
			)}
		</main>
	)
}
