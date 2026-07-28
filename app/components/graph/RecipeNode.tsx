'use client'

import { memo } from 'react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'

export type RecipeNodeData = {
	label: string
	inCycle: boolean
	[key: string]: unknown
}

type RecipeNode = Node<RecipeNodeData, 'recipe'>

function RecipeNodeComponent({ data }: NodeProps<RecipeNode>) {
	const d = data as unknown as RecipeNodeData
	const color = d.inCycle ? '#ef4444' : '#6366f1'
	return (
		<div
			className="flex items-center justify-center rounded-md border-2 px-2 py-1 text-[10px] font-medium shadow-sm transition-colors"
			style={{
				borderColor: color,
				backgroundColor: d.inCycle ? '#fef2f2' : '#eef2ff',
				color: color,
				minWidth: 50,
				maxWidth: 80,
			}}
		>
			<Handle type="target" position={Position.Left} style={{ background: color, width: 6, height: 6 }} />
			<span className="truncate">{d.label}</span>
			<Handle type="source" position={Position.Right} style={{ background: color, width: 6, height: 6 }} />
		</div>
	)
}

export const RecipeNode = memo(RecipeNodeComponent)
