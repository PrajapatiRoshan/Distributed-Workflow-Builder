import { create } from 'zustand'
import type { Node, Edge, Connection, NodeChange, EdgeChange, XYPosition } from 'reactflow'
import { applyNodeChanges, applyEdgeChanges, addEdge } from 'reactflow'
import type { WorkflowNode, WorkflowEdge, WorkflowDefinition, ValidationResult, PluginType } from '@/types'
import { generateId } from '@/lib/utils'
import { DEFAULT_RETRY_POLICY } from '@/lib/constants'
import workflowsApi from '@/api/workflows.api'

interface BuilderState {
  // Canvas state
  nodes: Node<WorkflowNode>[]
  edges: Edge<WorkflowEdge>[]
  selectedNodeId: string | null
  selectedEdgeId: string | null

  // Metadata
  workflowId: string | null
  workflowName: string
  workflowDescription: string
  isDirty: boolean
  validationResult: ValidationResult | null
  isSaving: boolean
  isValidating: boolean

  // Actions
  setNodes: (nodes: Node<WorkflowNode>[]) => void
  setEdges: (edges: Edge<WorkflowEdge>[]) => void
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void
  addNode: (type: PluginType, position: XYPosition, label?: string) => string
  updateNodeConfig: (nodeId: string, config: Record<string, unknown>) => void
  updateNodeLabel: (nodeId: string, label: string) => void
  updateEdgeCondition: (edgeId: string, condition?: string, expression?: string) => void
  deleteSelected: () => void
  selectNode: (id: string | null) => void
  selectEdge: (id: string | null) => void

  // Workflow operations
  loadWorkflow: (id: string | null, name: string, description: string, definition: WorkflowDefinition) => void
  saveWorkflow: () => Promise<void>
  validateWorkflow: () => Promise<ValidationResult>
  resetBuilder: () => void
  setWorkflowName: (name: string) => void
  setWorkflowDescription: (description: string) => void
}

const defaultPluginConfig: Record<PluginType, Record<string, unknown>> = {
  TEXT_TRANSFORM: { operation: 'uppercase', text: '' },
  API_PROXY: { url: '', method: 'GET', headers: {}, body: {} },
  DATA_AGGREGATOR: { inputs: [], operation: 'merge' },
  DELAY: { delayMs: 1000 },
  CUSTOM: { code: '' },
}

function workflowNodesToReactFlowNodes(nodes: WorkflowNode[]): Node<WorkflowNode>[] {
  return nodes.map((node) => ({
    id: node.id,
    type: 'custom',
    position: node.position,
    data: node,
  }))
}

function workflowEdgesToReactFlowEdges(edges: WorkflowEdge[]): Edge<WorkflowEdge>[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    data: edge,
    animated: edge.condition !== undefined,
    style: edge.condition ? { stroke: edge.condition === 'true' ? '#22c55e' : '#ef4444' } : undefined,
  }))
}

function reactFlowNodesToWorkflowNodes(nodes: Node<WorkflowNode>[]): WorkflowNode[] {
  return nodes.map((node) => ({
    ...node.data,
    position: node.position,
  }))
}

function reactFlowEdgesToWorkflowEdges(edges: Edge<WorkflowEdge>[]): WorkflowEdge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    condition: edge.data?.condition,
    conditionExpression: edge.data?.conditionExpression,
  }))
}

export const useBuilderStore = create<BuilderState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  selectedEdgeId: null,
  workflowId: null,
  workflowName: 'Untitled Workflow',
  workflowDescription: '',
  isDirty: false,
  validationResult: null,
  isSaving: false,
  isValidating: false,

  setNodes: (nodes) => set({ nodes, isDirty: true }),
  setEdges: (edges) => set({ edges, isDirty: true }),

  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
      isDirty: true,
    })
  },

  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
      isDirty: true,
    })
  },

  onConnect: (connection) => {
    if (!connection.source || !connection.target) return

    const newEdge: Edge<WorkflowEdge> = {
      id: generateId(),
      source: connection.source,
      target: connection.target,
      data: {
        id: generateId(),
        source: connection.source,
        target: connection.target,
      },
    }

    set({
      edges: addEdge(newEdge, get().edges),
      isDirty: true,
    })
  },

  addNode: (type, position, label) => {
    const id = generateId()
    const newNode: Node<WorkflowNode> = {
      id,
      type: 'custom',
      position,
      data: {
        id,
        type,
        pluginId: type.toLowerCase(),
        pluginVersion: '1.0.0',
        label: label || `${type.replace('_', ' ')} Node`,
        config: { ...defaultPluginConfig[type] },
        position,
        retryPolicy: { ...DEFAULT_RETRY_POLICY },
      },
    }

    set({
      nodes: [...get().nodes, newNode],
      isDirty: true,
      selectedNodeId: id,
    })

    return id
  },

  updateNodeConfig: (nodeId, config) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, config: { ...node.data.config, ...config } } }
          : node
      ),
      isDirty: true,
    })
  },

  updateNodeLabel: (nodeId, label) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, label } }
          : node
      ),
      isDirty: true,
    })
  },

  updateEdgeCondition: (edgeId, condition, expression) => {
    set({
      edges: get().edges.map((edge) =>
        edge.id === edgeId
          ? {
              ...edge,
              data: { ...edge.data!, condition, conditionExpression: expression },
              animated: condition !== undefined,
              style: condition ? { stroke: condition === 'true' ? '#22c55e' : '#ef4444' } : undefined,
            }
          : edge
      ),
      isDirty: true,
    })
  },

  deleteSelected: () => {
    const { selectedNodeId, selectedEdgeId, nodes, edges } = get()

    if (selectedNodeId) {
      set({
        nodes: nodes.filter((n) => n.id !== selectedNodeId),
        edges: edges.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId),
        selectedNodeId: null,
        isDirty: true,
      })
    } else if (selectedEdgeId) {
      set({
        edges: edges.filter((e) => e.id !== selectedEdgeId),
        selectedEdgeId: null,
        isDirty: true,
      })
    }
  },

  selectNode: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),
  selectEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),

  loadWorkflow: (id, name, description, definition) => {
    set({
      workflowId: id,
      workflowName: name,
      workflowDescription: description,
      nodes: workflowNodesToReactFlowNodes(definition.nodes),
      edges: workflowEdgesToReactFlowEdges(definition.edges),
      isDirty: false,
      validationResult: null,
      selectedNodeId: null,
      selectedEdgeId: null,
    })
  },

  saveWorkflow: async () => {
    const { workflowId, workflowName, workflowDescription, nodes, edges } = get()

    const definition: WorkflowDefinition = {
      nodes: reactFlowNodesToWorkflowNodes(nodes),
      edges: reactFlowEdgesToWorkflowEdges(edges),
    }

    set({ isSaving: true })

    try {
      if (workflowId) {
        await workflowsApi.update(workflowId, {
          name: workflowName,
          description: workflowDescription,
          definition,
        })
      } else {
        const { data } = await workflowsApi.create({
          name: workflowName,
          description: workflowDescription,
          definition,
        })
        if (data.data) {
          set({ workflowId: data.data.id })
        }
      }
      set({ isDirty: false, isSaving: false })
    } catch (error) {
      set({ isSaving: false })
      throw error
    }
  },

  validateWorkflow: async () => {
    const { nodes, edges } = get()

    const definition: WorkflowDefinition = {
      nodes: reactFlowNodesToWorkflowNodes(nodes),
      edges: reactFlowEdgesToWorkflowEdges(edges),
    }

    set({ isValidating: true })

    try {
      const { data } = await workflowsApi.validate(definition)
      const result = data.data || { valid: false, errors: [{ message: 'Validation failed' }], warnings: [] }
      set({ validationResult: result, isValidating: false })
      return result
    } catch (error) {
      const result: ValidationResult = { valid: false, errors: [{ message: 'Validation request failed' }], warnings: [] }
      set({ validationResult: result, isValidating: false })
      return result
    }
  },

  resetBuilder: () => {
    set({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      selectedEdgeId: null,
      workflowId: null,
      workflowName: 'Untitled Workflow',
      workflowDescription: '',
      isDirty: false,
      validationResult: null,
    })
  },

  setWorkflowName: (name) => set({ workflowName: name, isDirty: true }),
  setWorkflowDescription: (description) => set({ workflowDescription: description, isDirty: true }),
}))
