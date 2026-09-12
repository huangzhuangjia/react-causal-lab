import { describe, expect, it } from 'vitest'

import {
  createDefaultKeyScenario,
  decodeScenario,
  encodeScenario,
  simulateKeyScenario,
} from './index'
import type { KeyScenario } from './types'

function scenarioWith(
  changes: Partial<Pick<KeyScenario, 'keyStrategy' | 'operation' | 'seed'>>,
): KeyScenario {
  return { ...createDefaultKeyScenario(), ...changes }
}

describe('simulateKeyScenario', () => {
  it('keeps B state on B when a stable id key prepends X', () => {
    const result = simulateKeyScenario(
      scenarioWith({
        keyStrategy: 'id',
        operation: { type: 'prepend', itemId: 'X' },
      }),
    )
    const committed = result.snapshots.at(-1)

    expect(committed?.domRows).toEqual([
      { id: 'X', label: 'X', state: 0 },
      { id: 'A', label: 'A', state: 0 },
      { id: 'B', label: 'B', state: 3 },
      { id: 'C', label: 'C', state: 0 },
    ])
    expect(committed?.workInProgress.find(({ id }) => id === 'B')).toMatchObject({
      alternateId: 'B',
      state: 3,
      reuse: 'reused',
    })
  })

  it('shows state moving by position when an index key prepends X', () => {
    const result = simulateKeyScenario(
      scenarioWith({
        keyStrategy: 'index',
        operation: { type: 'prepend', itemId: 'X' },
      }),
    )
    const committed = result.snapshots.at(-1)

    expect(committed?.domRows).toEqual([
      { id: 'X', label: 'X', state: 0 },
      { id: 'A', label: 'A', state: 3 },
      { id: 'B', label: 'B', state: 0 },
      { id: 'C', label: 'C', state: 0 },
    ])
    expect(committed?.workInProgress.find(({ id }) => id === 'A')).toMatchObject({
      alternateId: 'B',
      flags: ['Update'],
      state: 3,
    })
    expect(result.finalAnswer).toContain('state 3')
    expect(result.finalAnswer).toContain('A')
  })

  it('marks the removed current Fiber with Deletion', () => {
    const result = simulateKeyScenario(
      scenarioWith({
        keyStrategy: 'id',
        operation: { type: 'delete', itemId: 'B' },
      }),
    )
    const effects = result.snapshots[4]
    const deleted = effects.current.find(({ id }) => id === 'B')

    expect(deleted).toMatchObject({ reuse: 'deleted', flags: ['Deletion'] })
    expect(result.snapshots.at(-1)?.domRows.map(({ id }) => id)).toEqual(['A', 'C'])
  })

  it('uses a stable lastPlacedIndex pass to mark moves when reversing', () => {
    const result = simulateKeyScenario(
      scenarioWith({ keyStrategy: 'id', operation: { type: 'reverse' } }),
    )
    const committedFibers = result.snapshots.at(-1)?.workInProgress ?? []

    expect(committedFibers.map(({ id }) => id)).toEqual(['C', 'B', 'A'])
    expect(committedFibers.find(({ id }) => id === 'C')?.flags).toEqual([])
    expect(committedFibers.find(({ id }) => id === 'B')?.flags).toContain('Placement')
    expect(committedFibers.find(({ id }) => id === 'A')?.flags).toContain('Placement')
    expect(committedFibers.find(({ id }) => id === 'B')?.state).toBe(3)
  })

  it('does not call an index-key reverse stable when B happens to stay in place', () => {
    const result = simulateKeyScenario(
      scenarioWith({ keyStrategy: 'index', operation: { type: 'reverse' } }),
    )

    expect(result.finalAnswer).toContain('B 与旧 Fiber B 匹配')
    expect(result.finalAnswer).toContain('2 个节点发生了 state 身份错配')
    expect(result.finalAnswer).not.toContain('稳定身份使 state 没有串位')
  })

  it('tracks the first non-zero state item when a custom list has no B', () => {
    const result = simulateKeyScenario({
      version: '19.3',
      keyStrategy: 'index',
      operation: { type: 'prepend', itemId: 'X' },
      items: [
        { id: 'one', label: '第一行', state: 0 },
        { id: 'two', label: '第二行', state: 7 },
      ],
      seed: 99,
    })

    expect(result.finalAnswer).toContain('旧 two Fiber')
    expect(result.finalAnswer).toContain('state 7')
    expect(result.finalAnswer).toContain('位置 1 的 one')
  })

  it('produces byte-for-byte equivalent snapshots for the same scenario and seed', () => {
    const scenario = scenarioWith({
      keyStrategy: 'none',
      operation: { type: 'reverse' },
      seed: 7,
    })

    expect(simulateKeyScenario(scenario)).toEqual(simulateKeyScenario(scenario))
  })
})

describe('scenario URL encoding', () => {
  it('round-trips a customized scenario', () => {
    const scenario: KeyScenario = {
      version: '19.3',
      keyStrategy: 'index',
      operation: { type: 'delete', itemId: 'two' },
      items: [
        { id: 'one', label: '第一行', state: 1 },
        { id: 'two', label: '第二行', state: 8 },
      ],
      seed: 99,
    }

    expect(decodeScenario(new URLSearchParams(encodeScenario(scenario)))).toEqual(scenario)
  })

  it('falls back safely for invalid query values', () => {
    const decoded = decodeScenario(
      new URLSearchParams('key=unstable&op=destroy&target=%3Cscript%3E&seed=-1&items=nope'),
    )

    expect(decoded).toEqual(createDefaultKeyScenario())
  })
})
