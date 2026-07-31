export interface SimNode {
	id: string
	label: string
	x: number
	y: number
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
}
