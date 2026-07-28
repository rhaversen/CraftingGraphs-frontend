'use client'

import { memo } from 'react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'

export type ItemNodeData = {
	label: string
	category: 'raw' | 'final' | 'intermediate'
	inDegree: number
	outDegree: number
	inCycle: boolean
	[key: string]: unknown
}

type ItemNode = Node<ItemNodeData, 'item'>

const CATEGORY_COLORS: Record<ItemNodeData['category'], string> = {
	raw: '#10b981',
	final: '#f59e0b',
	intermediate: '#3b82f6',
}

function ItemNodeComponent({ data }: NodeProps<ItemNode>) {
	const d = data as unknown as ItemNodeData
	const color = CATEGORY_COLORS[d.category]
	return (
		<div className="flex flex-col items-center" style={{ minWidth: 70 }}>
			<div
				className="flex items-center justify-center rounded-full border-2 px-3 py-2 text-xs font-medium shadow-md transition-colors"
				style={{
					borderColor: color,
					backgroundColor: d.inCycle ? '#fef3c7' : '#fff',
					color: '#1f2937',
				}}
			>
				<Handle type="target" position={Position.Left} style={{ background: color, width: 8, height: 8 }} />
				<span className="truncate" style={{ maxWidth: 90 }}>{d.label}</span>
				<Handle type="source" position={Position.Right} style={{ background: color, width: 8, height: 8 }} />
			</div>
		</div>
	)
}

export const ItemNode = memo(ItemNodeComponent)
