export interface SimNode {
	id: string
	label: string
	x: number
	y: number
	vx: number
	vy: number
	fx: number | null
	fy: number | null
	level: number
	inDegree: number
	outDegree: number
	isSource: boolean
	isSink: boolean
	scc: number
	inCycle: boolean
	radius: number
	/** 'item' = normal item node, 'recipe' = intermediate recipe node */
	kind: 'item' | 'recipe'
	/** For recipe nodes: the recipe this node represents */
	recipeId?: string
	/** For recipe nodes: the bench name */
	benchName?: string
	/** For item nodes: benches that produce this item (for display) */
	benches: string[]
}

export interface SimEdge {
	id: string
	source: string
	target: string
	recipeId: string
	benchName: string
	isBackEdge: boolean
}

export interface GraphModel {
	nodes: SimNode[]
	edges: SimEdge[]
	nodeMap: Map<string, SimNode>
	adjacency: Map<string, string[]>
	reverseAdjacency: Map<string, string[]>
	levels: number[]
	maxLevel: number
	cycles: string[][]
}

export interface SimParams {
	repulsion: number
	springStrength: number
	springLength: number
	flowStrength: number
	centerStrength: number
	barycenterStrength: number
	levelStrength: number
	levelSpacing: number
	gravity: number
	crossingPenalty: number
	damping: number
	alpha: number
	alphaDecay: number
	alphaMin: number
	velocityDecay: number
}

export const DEFAULT_PARAMS: SimParams = {
	repulsion: 4000,
	springStrength: 0.03,
	springLength: 110,
	flowStrength: 0.06,
	centerStrength: 0.01,
	barycenterStrength: 0.04,
	levelStrength: 0.08,
	levelSpacing: 220,
	gravity: 0.003,
	crossingPenalty: 0.5,
	damping: 0.85,
	alpha: 1,
	alphaDecay: 0.015,
	alphaMin: 0.001,
	velocityDecay: 0.6,
}

export interface Metrics {
	crossings: number
	crossingPairs: [string, string][]
	directionViolations: number
	nodeOverlaps: number
	avgEdgeLength: number
	stddevEdgeLength: number
	maxEdgeLength: number
	minEdgeLength: number
	congestion: number
	energy: number
	alpha: number
	tick: number
	converged: boolean
}
