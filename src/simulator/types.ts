export type KeyStrategy = 'id' | 'index' | 'none'

export type ListOperation =
  | { type: 'prepend'; itemId: string }
  | { type: 'delete'; itemId: string }
  | { type: 'reverse' }

export type FiberFlag = 'Placement' | 'Update' | 'Deletion'

export interface KeyScenario {
  version: '19.3'
  keyStrategy: KeyStrategy
  operation: ListOperation
  items: Array<{ id: string; label: string; state: number }>
  seed: number
}

export interface FiberSnapshot {
  id: string
  key: string | null
  type: 'Row'
  index: number
  state: number
  reuse: 'reused' | 'mounted' | 'deleted'
  flags: FiberFlag[]
  alternateId?: string
}

export interface TimelineEvent {
  id: string
  phase: 'trigger' | 'render' | 'reconcile' | 'commit'
  title: string
  explanation: string
  focusIds: string[]
}

export interface SimulationSnapshot {
  step: number
  current: FiberSnapshot[]
  workInProgress: FiberSnapshot[]
  domRows: Array<{ id: string; label: string; state: number }>
  event: TimelineEvent
}

export interface SimulationResult {
  scenario: KeyScenario
  snapshots: SimulationSnapshot[]
  finalAnswer: string
}
