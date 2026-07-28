'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildGraphModel, initializeLayout } from './model'
import { tick, reduceCrossings } from './simulation'
import { computeMetrics } from './metrics'
import { DEFAULT_PARAMS, type GraphModel, type Metrics, type SimParams } from './types'
import type { Bench, Item, Recipe } from '../../types'

interface UseGraphSimResult {
	model: GraphModel | null
	metrics: Metrics | null
	running: boolean
	tickCount: number
	params: SimParams
	setParams: (updater: (prev: SimParams) => SimParams) => void
	restart: () => void
	toggleRunning: () => void
	stepOnce: () => void
	reheat: () => void
}

type Snapshot = { version: number; model: GraphModel; metrics: Metrics }

export function useGraphSim(
	items: Item[],
	benches: Bench[],
	recipes: Recipe[],
	recipeCount: number,
	vertical = false,
): UseGraphSimResult {
	const modelRef = useRef<GraphModel | null>(null)
	const paramsRef = useRef<SimParams>({ ...DEFAULT_PARAMS })
	const rafRef = useRef<number | null>(null)
	const runningRef = useRef(true)
	const tickCountRef = useRef(0)
	const versionRef = useRef(0)
	const crossingReducedRef = useRef(false)
	const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
	const [running, setRunning] = useState(true)
	const [params, setParamsState] = useState<SimParams>({ ...DEFAULT_PARAMS })

	// Build the model deterministically (pure) when inputs change.
	// Store in a ref via a mount effect; refs may be written in effects.
	const builtModel = useMemo(
		() => buildModel(items, benches, recipes, recipeCount, vertical),
		[items, benches, recipes, recipeCount, vertical],
	)

	useEffect(() => {
		modelRef.current = builtModel
		paramsRef.current = { ...DEFAULT_PARAMS, alpha: 1 }
		tickCountRef.current = 0
		versionRef.current++
		runningRef.current = true
		crossingReducedRef.current = false
		const mt = computeMetrics(builtModel, paramsRef.current)
		mt.tick = 0
		setSnapshot({ version: versionRef.current, model: builtModel, metrics: mt })
		setRunning(true)
	}, [builtModel])

	// rAF loop — mount once; reads refs, writes state only in the frame callback
	useEffect(() => {
		const loop = () => {
			const m = modelRef.current
			if (m && runningRef.current && paramsRef.current.alpha > paramsRef.current.alphaMin) {
				// When the layout has mostly settled, run crossing reduction once,
				// then reheat to let forces relax around the improved ordering.
				if (!crossingReducedRef.current && paramsRef.current.alpha < 0.15) {
					reduceCrossings(m)
					crossingReducedRef.current = true
					paramsRef.current.alpha = Math.max(paramsRef.current.alpha, 0.3)
					// Force a snapshot so the reordering is visible immediately
					tickCountRef.current++
					const mt0 = computeMetrics(m, paramsRef.current)
					mt0.tick = tickCountRef.current
					versionRef.current++
					setSnapshot({
						version: versionRef.current,
						model: { ...m, nodes: m.nodes.map((n) => ({ ...n })) },
						metrics: mt0,
					})
				}
				tick(m, paramsRef.current)
				paramsRef.current.alpha *= 1 - paramsRef.current.alphaDecay
				tickCountRef.current++
				if (tickCountRef.current % 5 === 0) {
					const mt = computeMetrics(m, paramsRef.current)
					mt.tick = tickCountRef.current
					versionRef.current++
					setSnapshot({
						version: versionRef.current,
						model: { ...m, nodes: m.nodes.map((n) => ({ ...n })) },
						metrics: mt,
					})
				}
			}
			rafRef.current = requestAnimationFrame(loop)
		}
		rafRef.current = requestAnimationFrame(loop)
		return () => {
			if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
		}
	}, [])

	const setParams = useCallback((updater: (prev: SimParams) => SimParams) => {
		paramsRef.current = updater(paramsRef.current)
		setParamsState(paramsRef.current)
	}, [])

	const restart = useCallback(() => {
		const m = modelRef.current
		if (!m) return
		initializeLayout(m, vertical)
		paramsRef.current = { ...DEFAULT_PARAMS, alpha: 1 }
		tickCountRef.current = 0
		runningRef.current = true
		crossingReducedRef.current = false
		versionRef.current++
		const mt = computeMetrics(m, paramsRef.current)
		mt.tick = 0
		setSnapshot({ version: versionRef.current, model: { ...m, nodes: m.nodes.map((n) => ({ ...n })) }, metrics: mt })
		setRunning(true)
	}, [vertical])

	const toggleRunning = useCallback(() => {
		runningRef.current = !runningRef.current
		setRunning(runningRef.current)
	}, [])

	const stepOnce = useCallback(() => {
		const m = modelRef.current
		if (!m) return
		runningRef.current = false
		setRunning(false)
		tick(m, paramsRef.current)
		paramsRef.current.alpha *= 1 - paramsRef.current.alphaDecay
		tickCountRef.current++
		const mt = computeMetrics(m, paramsRef.current)
		mt.tick = tickCountRef.current
		versionRef.current++
		setSnapshot({ version: versionRef.current, model: { ...m, nodes: m.nodes.map((n) => ({ ...n })) }, metrics: mt })
	}, [])

	const reheat = useCallback(() => {
		paramsRef.current = { ...paramsRef.current, alpha: 1 }
		crossingReducedRef.current = false
		setParamsState(paramsRef.current)
		runningRef.current = true
		setRunning(true)
	}, [])

	return {
		model: snapshot?.model ?? null,
		metrics: snapshot?.metrics ?? null,
		running,
		tickCount: snapshot?.metrics.tick ?? 0,
		params,
		setParams,
		restart,
		toggleRunning,
		stepOnce,
		reheat,
	}
}

function buildModel(
	items: Item[],
	benches: Bench[],
	recipes: Recipe[],
	recipeCount: number,
	vertical: boolean,
): GraphModel {
	const subset = recipes.slice(0, recipeCount)
	const usedItemIds = new Set<string>()
	for (const r of subset) {
		for (const inp of r.inputs) usedItemIds.add(inp.item)
		for (const state of r.outputs) usedItemIds.add(state.item)
	}
	const filteredItems = items.filter((i) => usedItemIds.has(i.id))
	const m = buildGraphModel(filteredItems, benches, subset)
	initializeLayout(m, vertical)
	return m
}
