import type {
  FiberFlag,
  FiberSnapshot,
  KeyScenario,
  KeyStrategy,
  ListOperation,
  SimulationResult,
  SimulationSnapshot,
  TimelineEvent,
} from './types'

type ScenarioItem = KeyScenario['items'][number]

interface MatchedFiber {
  fiber: FiberSnapshot
  item: ScenarioItem
  oldIndex: number | null
}

const VERSION = '19.3' as const
const DEFAULT_SEED = 42
const MAX_ITEMS = 12
const ID_PATTERN = /^[A-Za-z0-9_-]{1,24}$/

export const DEFAULT_KEY_SCENARIO: KeyScenario = {
  version: VERSION,
  keyStrategy: 'id',
  operation: { type: 'prepend', itemId: 'X' },
  items: [
    { id: 'A', label: 'A', state: 0 },
    { id: 'B', label: 'B', state: 3 },
    { id: 'C', label: 'C', state: 0 },
  ],
  seed: DEFAULT_SEED,
}

/** A fresh default protects callers from accidentally sharing mutable item arrays. */
export function createDefaultKeyScenario(): KeyScenario {
  return cloneScenario(DEFAULT_KEY_SCENARIO)
}

function cloneScenario(scenario: KeyScenario): KeyScenario {
  return {
    ...scenario,
    operation: { ...scenario.operation },
    items: scenario.items.map((item) => ({ ...item })),
  }
}

function isKeyStrategy(value: unknown): value is KeyStrategy {
  return value === 'id' || value === 'index' || value === 'none'
}

function normalizeItems(value: unknown): ScenarioItem[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_ITEMS) {
    return null
  }

  const ids = new Set<string>()
  const items: ScenarioItem[] = []

  for (const candidate of value) {
    if (typeof candidate !== 'object' || candidate === null) {
      return null
    }

    const { id, label, state } = candidate as Record<string, unknown>
    if (
      typeof id !== 'string' ||
      !ID_PATTERN.test(id) ||
      ids.has(id) ||
      typeof label !== 'string' ||
      label.trim().length === 0 ||
      label.length > 48 ||
      typeof state !== 'number' ||
      !Number.isSafeInteger(state)
    ) {
      return null
    }

    ids.add(id)
    items.push({ id, label, state })
  }

  return items
}

function normalizeSeed(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : DEFAULT_SEED
}

function normalizeItemId(value: unknown, fallback: string): string {
  return typeof value === 'string' && ID_PATTERN.test(value) ? value : fallback
}

function firstAvailableId(items: ScenarioItem[]): string {
  const ids = new Set(items.map(({ id }) => id))
  if (!ids.has('X')) {
    return 'X'
  }

  for (let index = 2; index <= MAX_ITEMS + 1; index += 1) {
    const candidate = `X${index}`
    if (!ids.has(candidate)) {
      return candidate
    }
  }

  return 'NEW'
}

function normalizeOperation(value: unknown, items: ScenarioItem[]): ListOperation {
  if (typeof value !== 'object' || value === null || !('type' in value)) {
    return { type: 'prepend', itemId: firstAvailableId(items) }
  }

  const operation = value as { type?: unknown; itemId?: unknown }
  if (operation.type === 'reverse') {
    return { type: 'reverse' }
  }

  if (operation.type === 'delete') {
    const preferredFallback = items.some(({ id }) => id === 'B') ? 'B' : items[0].id
    const itemId = normalizeItemId(operation.itemId, preferredFallback)
    return {
      type: 'delete',
      itemId: items.some(({ id }) => id === itemId) ? itemId : preferredFallback,
    }
  }

  if (operation.type === 'prepend') {
    const fallback = firstAvailableId(items)
    const requestedId = normalizeItemId(operation.itemId, fallback)
    return {
      type: 'prepend',
      itemId: items.some(({ id }) => id === requestedId) ? fallback : requestedId,
    }
  }

  return { type: 'prepend', itemId: firstAvailableId(items) }
}

function normalizeScenario(value: Partial<KeyScenario>): KeyScenario {
  const defaultScenario = createDefaultKeyScenario()
  const items = normalizeItems(value.items) ?? defaultScenario.items

  return {
    version: VERSION,
    keyStrategy: isKeyStrategy(value.keyStrategy)
      ? value.keyStrategy
      : defaultScenario.keyStrategy,
    operation: normalizeOperation(value.operation, items),
    items,
    seed: normalizeSeed(value.seed),
  }
}

function keyFor(item: ScenarioItem, index: number, strategy: KeyStrategy): string | null {
  if (strategy === 'id') {
    return item.id
  }

  if (strategy === 'index') {
    return String(index)
  }

  return null
}

function applyOperation(scenario: KeyScenario): ScenarioItem[] {
  const items = scenario.items.map((item) => ({ ...item }))

  switch (scenario.operation.type) {
    case 'prepend':
      return [
        { id: scenario.operation.itemId, label: scenario.operation.itemId, state: 0 },
        ...items,
      ]
    case 'delete':
      {
        const deletedId = scenario.operation.itemId
        return items.filter(({ id }) => id !== deletedId)
      }
    case 'reverse':
      return items.reverse()
  }
}

function createCurrentFibers(scenario: KeyScenario): FiberSnapshot[] {
  return scenario.items.map((item, index) => ({
    id: item.id,
    key: keyFor(item, index, scenario.keyStrategy),
    type: 'Row',
    index,
    state: item.state,
    reuse: 'reused',
    flags: [],
  }))
}

function addFlag(flags: FiberFlag[], flag: FiberFlag): FiberFlag[] {
  return flags.includes(flag) ? flags : [...flags, flag]
}

function matchFibers(
  scenario: KeyScenario,
  nextItems: ScenarioItem[],
  current: FiberSnapshot[],
): { matched: MatchedFiber[]; deletedIds: Set<string> } {
  const usedCurrentIds = new Set<string>()
  const currentByKey = new Map<string, FiberSnapshot>()

  if (scenario.keyStrategy !== 'none') {
    for (const fiber of current) {
      if (fiber.key !== null) {
        currentByKey.set(`Row:${fiber.key}`, fiber)
      }
    }
  }

  let lastPlacedIndex = 0
  const matched = nextItems.map((item, index): MatchedFiber => {
    const key = keyFor(item, index, scenario.keyStrategy)
    const oldFiber =
      scenario.keyStrategy === 'none'
        ? current[index]
        : currentByKey.get(`Row:${String(key)}`)
    const canReuse = oldFiber !== undefined && !usedCurrentIds.has(oldFiber.id)

    if (!canReuse) {
      return {
        item,
        oldIndex: null,
        fiber: {
          id: item.id,
          key,
          type: 'Row',
          index,
          state: item.state,
          reuse: 'mounted',
          flags: ['Placement'],
        },
      }
    }

    usedCurrentIds.add(oldFiber.id)
    let flags: FiberFlag[] = []
    if (oldFiber.index < lastPlacedIndex) {
      flags = addFlag(flags, 'Placement')
    } else {
      lastPlacedIndex = oldFiber.index
    }

    const oldItem = scenario.items[oldFiber.index]
    if (oldItem.id !== item.id || oldItem.label !== item.label) {
      flags = addFlag(flags, 'Update')
    }

    return {
      item,
      oldIndex: oldFiber.index,
      fiber: {
        id: item.id,
        key,
        type: 'Row',
        index,
        state: oldFiber.state,
        reuse: 'reused',
        flags,
        alternateId: oldFiber.id,
      },
    }
  })

  return {
    matched,
    deletedIds: new Set(current.filter(({ id }) => !usedCurrentIds.has(id)).map(({ id }) => id)),
  }
}

function operationDescription(operation: ListOperation): string {
  switch (operation.type) {
    case 'prepend':
      return `在列表头部插入 ${operation.itemId}，React 收到一次新的元素序列。`
    case 'delete':
      return `从列表中删除 ${operation.itemId}，React 收到一次新的元素序列。`
    case 'reverse':
      return '反转列表顺序，React 收到一次新的元素序列。'
  }
}

function matchDescription(strategy: KeyStrategy, matched: MatchedFiber[]): string {
  const reusedCount = matched.filter(({ fiber }) => fiber.reuse === 'reused').length
  const mountedCount = matched.length - reusedCount

  if (strategy === 'id') {
    return `按 key + type 查找旧 Fiber：复用 ${reusedCount} 个，新建 ${mountedCount} 个。稳定 id 让 state 跟随逻辑身份。`
  }

  if (strategy === 'index') {
    return `按数组下标生成 key：复用 ${reusedCount} 个，新建 ${mountedCount} 个。位置变化时，旧 state 可能被交给另一个数据项。`
  }

  return `没有 key 时按位置匹配同类型节点：复用 ${reusedCount} 个，新建 ${mountedCount} 个。这是教学简化模型，位置变化同样可能造成 state 错配。`
}

function effectDescription(matched: MatchedFiber[], deletedIds: Set<string>): string {
  const placementCount = matched.filter(({ fiber }) => fiber.flags.includes('Placement')).length
  const updateCount = matched.filter(({ fiber }) => fiber.flags.includes('Update')).length
  return `生成 effect 标记：Placement ${placementCount} 个、Update ${updateCount} 个、Deletion ${deletedIds.size} 个；DOM 仍未改变。`
}

function buildEvents(
  scenario: KeyScenario,
  matched: MatchedFiber[],
  deletedIds: Set<string>,
): TimelineEvent[] {
  const nextIds = matched.map(({ item }) => item.id)
  const effectIds = [
    ...matched.filter(({ fiber }) => fiber.flags.length > 0).map(({ item }) => item.id),
    ...deletedIds,
  ]
  const triggerFocus =
    scenario.operation.type === 'reverse'
      ? scenario.items.map(({ id }) => id)
      : [scenario.operation.itemId]

  return [
    {
      id: 'keys-trigger',
      phase: 'trigger',
      title: 'Trigger · 触发更新',
      explanation: operationDescription(scenario.operation),
      focusIds: triggerFocus,
    },
    {
      id: 'keys-render',
      phase: 'render',
      title: 'Render · 计算下一棵树',
      explanation: '组件返回新的 Row 描述。Render 阶段只计算目标界面，不修改 DOM。',
      focusIds: nextIds,
    },
    {
      id: 'keys-reconcile',
      phase: 'reconcile',
      title: 'Reconcile · 对齐新旧子节点',
      explanation:
        scenario.keyStrategy === 'none'
          ? '当前没有 key，教学模型会用位置 + type 对齐节点，并明确标出由此带来的身份风险。'
          : `当前使用 ${scenario.keyStrategy === 'id' ? 'item.id' : 'index'} 作为 key，比较单位是 key + type。`,
      focusIds: nextIds,
    },
    {
      id: 'keys-match',
      phase: 'reconcile',
      title: 'Match / Reuse · 转移 state',
      explanation: matchDescription(scenario.keyStrategy, matched),
      focusIds: matched
        .filter(({ fiber }) => fiber.reuse === 'reused')
        .map(({ item }) => item.id),
    },
    {
      id: 'keys-effects',
      phase: 'reconcile',
      title: 'Effects · 标记变更',
      explanation: effectDescription(matched, deletedIds),
      focusIds: effectIds,
    },
    {
      id: 'keys-commit',
      phase: 'commit',
      title: 'Commit · 应用到 DOM',
      explanation:
        'React 按 effect 标记更新 DOM。舞台保留 Current 与 Work-in-progress 两棵树，便于回看复用关系。',
      focusIds: effectIds.length > 0 ? effectIds : nextIds,
    },
  ]
}

function trackedItemForAnswer(scenario: KeyScenario): ScenarioItem | undefined {
  return (
    scenario.items.find(({ id }) => id === 'B') ??
    scenario.items.find(({ state }) => state !== 0) ??
    scenario.items[0]
  )
}

function buildFinalAnswer(scenario: KeyScenario, matched: MatchedFiber[]): string {
  const trackedItem = trackedItemForAnswer(scenario)
  if (trackedItem === undefined) {
    return '列表中没有可追踪的 state。'
  }

  const receiver = matched.find(({ fiber }) => fiber.alternateId === trackedItem.id)
  const stateTransfers = matched.filter(
    ({ fiber, item }) => fiber.alternateId !== undefined && fiber.alternateId !== item.id,
  )
  const isDefaultTrackedItem = trackedItem.id === 'B'

  if (receiver === undefined) {
    return `旧 ${trackedItem.id} 被删除，它持有的 state ${trackedItem.state} 不再出现在提交后的列表中。`
  }

  if (receiver.item.id === trackedItem.id) {
    if (stateTransfers.length > 0) {
      const affectedIds = stateTransfers.map(({ item }) => item.id).join('、')
      return `${trackedItem.id} 与旧 Fiber ${trackedItem.id} 匹配，state ${receiver.fiber.state} 仍留在 ${trackedItem.id}；但 ${affectedIds} 等 ${stateTransfers.length} 个节点发生了 state 身份错配，位置 key 无法表达稳定身份。`
    }

    if (isDefaultTrackedItem) {
      return `B 与旧 Fiber B 匹配，state ${receiver.fiber.state} 仍留在 B。稳定身份使 state 没有串位。`
    }

    const positionNote =
      scenario.keyStrategy === 'id'
        ? '稳定身份使 state 没有串位。'
        : '这次操作没有让它换位，但位置 key 仍可能在其他重排中错配。'
    return `${trackedItem.id} 与旧 Fiber ${trackedItem.id} 匹配，state ${receiver.fiber.state} 仍留在 ${trackedItem.id}。${positionNote}`
  }

  return `旧 ${trackedItem.id} Fiber 的 state ${receiver.fiber.state} 被位置 ${receiver.fiber.index} 的 ${receiver.item.id} 复用；${trackedItem.id} 的数据身份与 state 已经错配。`
}

function cloneFibers(fibers: FiberSnapshot[]): FiberSnapshot[] {
  return fibers.map((fiber) => ({ ...fiber, flags: [...fiber.flags] }))
}

function toDomRows(items: ScenarioItem[], fibers: FiberSnapshot[]) {
  return items.map((item, index) => ({
    id: item.id,
    label: item.label,
    state: fibers[index]?.state ?? item.state,
  }))
}

function buildSnapshots(
  scenario: KeyScenario,
  nextItems: ScenarioItem[],
  current: FiberSnapshot[],
  matched: MatchedFiber[],
  deletedIds: Set<string>,
  events: TimelineEvent[],
): SimulationSnapshot[] {
  const currentBeforeEffects = cloneFibers(current)
  const currentWithEffects = current.map((fiber) =>
    deletedIds.has(fiber.id)
      ? { ...fiber, reuse: 'deleted' as const, flags: ['Deletion' as const] }
      : { ...fiber, flags: [...fiber.flags] },
  )
  const workInProgress = matched.map(({ fiber }) => ({ ...fiber, flags: [] }))
  const workInProgressWithEffects = matched.map(({ fiber }) => ({
    ...fiber,
    flags: [...fiber.flags],
  }))
  const oldDom = toDomRows(scenario.items, current)
  const committedDom = toDomRows(nextItems, workInProgressWithEffects)

  return events.map((event, step) => {
    const effectsVisible = step >= 4
    return {
      step,
      current: effectsVisible ? cloneFibers(currentWithEffects) : cloneFibers(currentBeforeEffects),
      workInProgress:
        step === 0
          ? []
          : cloneFibers(effectsVisible ? workInProgressWithEffects : workInProgress),
      domRows: (step === events.length - 1 ? committedDom : oldDom).map((row) => ({ ...row })),
      event: { ...event, focusIds: [...event.focusIds] },
    }
  })
}

export function simulateKeyScenario(input: KeyScenario): SimulationResult {
  const scenario = normalizeScenario(input)
  const nextItems = applyOperation(scenario)
  const current = createCurrentFibers(scenario)
  const { matched, deletedIds } = matchFibers(scenario, nextItems, current)
  const events = buildEvents(scenario, matched, deletedIds)

  return {
    scenario: cloneScenario(scenario),
    snapshots: buildSnapshots(scenario, nextItems, current, matched, deletedIds, events),
    finalAnswer: buildFinalAnswer(scenario, matched),
  }
}

function scenariosHaveDefaultItems(items: ScenarioItem[]): boolean {
  return JSON.stringify(items) === JSON.stringify(DEFAULT_KEY_SCENARIO.items)
}

/** Returns a canonical query string without a leading question mark. */
export function encodeScenario(input: KeyScenario): string {
  const scenario = normalizeScenario(input)
  const params = new URLSearchParams()
  params.set('key', scenario.keyStrategy)
  params.set('op', scenario.operation.type)

  if (scenario.operation.type !== 'reverse') {
    params.set('target', scenario.operation.itemId)
  }

  params.set('seed', String(scenario.seed))
  if (!scenariosHaveDefaultItems(scenario.items)) {
    params.set('items', JSON.stringify(scenario.items))
  }

  return params.toString()
}

function parseItemsParam(value: string | null): ScenarioItem[] | undefined {
  if (value === null) {
    return undefined
  }

  try {
    return normalizeItems(JSON.parse(value)) ?? undefined
  } catch {
    return undefined
  }
}

function parseSeedParam(value: string | null): number | undefined {
  if (value === null || !/^\d+$/.test(value)) {
    return undefined
  }

  const seed = Number(value)
  return Number.isSafeInteger(seed) ? seed : undefined
}

export function decodeScenario(params: URLSearchParams): KeyScenario {
  const defaultScenario = createDefaultKeyScenario()
  const items = parseItemsParam(params.get('items')) ?? defaultScenario.items
  const rawOperation = params.get('op')
  let operation: ListOperation

  if (rawOperation === 'reverse') {
    operation = { type: 'reverse' }
  } else if (rawOperation === 'delete') {
    operation = { type: 'delete', itemId: params.get('target') ?? 'B' }
  } else {
    operation = { type: 'prepend', itemId: params.get('target') ?? 'X' }
  }

  return normalizeScenario({
    version: VERSION,
    keyStrategy: (params.get('key') ?? undefined) as KeyStrategy | undefined,
    operation,
    items,
    seed: parseSeedParam(params.get('seed')),
  })
}
