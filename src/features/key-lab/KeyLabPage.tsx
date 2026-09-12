import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  AlertTriangle,
  Check,
  ChevronDown,
  CircleHelp,
  Clipboard,
  Copy,
  FastForward,
  Flag,
  Info,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Sparkles,
  Target,
  X,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, RefObject } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  createDefaultKeyScenario,
  decodeScenario,
  encodeScenario,
  simulateKeyScenario,
} from '../../simulator'
import type {
  FiberFlag,
  FiberSnapshot,
  KeyScenario,
  KeyStrategy,
  ListOperation,
  SimulationResult,
  SimulationSnapshot,
} from '../../simulator'
import styles from './KeyLabPage.module.scss'

type PlaybackStatus = 'prediction' | 'ready' | 'playing' | 'paused' | 'complete'
type MobilePanel = 'controls' | 'stage' | 'inspector'

interface PreviousSummary {
  keyStrategy: KeyStrategy
  operation: string
  answer: string
}

const phaseLabels: Record<SimulationSnapshot['event']['phase'], string> = {
  trigger: '触发',
  render: '渲染',
  reconcile: '对齐',
  commit: '提交',
}

const strategyLabels: Record<KeyStrategy, { label: string; code: string; tone: string }> = {
  id: { label: '稳定身份', code: 'item.id', tone: 'cyan' },
  index: { label: '数组位置', code: 'index', tone: 'coral' },
  none: { label: '无 key', code: '—', tone: 'amber' },
}

const operationLabels: Record<ListOperation['type'], string> = {
  prepend: '插入到头部',
  delete: '删除一行',
  reverse: '反转顺序',
}

const playbackLabels: Record<PlaybackStatus, string> = {
  prediction: '等待预测',
  ready: '可以播放',
  playing: '正在运行',
  paused: '已暂停',
  complete: '观测完成',
}

const speedOptions = [0.5, 1, 1.5, 2]

function parseStep(value: string | null, max: number): number {
  if (value === null || !/^\d+$/.test(value)) {
    return 0
  }

  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? Math.min(Math.max(parsed, 0), max) : 0
}

function trackedItemFor(scenario: KeyScenario): KeyScenario['items'][number] {
  return (
    scenario.items.find(({ id }) => id === 'B') ??
    scenario.items.find(({ state }) => state !== 0) ??
    scenario.items[0]
  )
}

function expectedReceiver(result: SimulationResult, trackedId: string): string {
  const finalSnapshot = result.snapshots.at(-1)
  const receiver = finalSnapshot?.workInProgress.find(({ alternateId }) => alternateId === trackedId)
  return receiver?.id ?? 'none'
}

function resultRowLabel(id: string, trackedId: string): string {
  return id === 'none' ? `${trackedId} 不再出现` : `${id} 这一行`
}

function flagTone(flag: FiberFlag): string {
  if (flag === 'Placement') return styles.flagPlacement
  if (flag === 'Deletion') return styles.flagDeletion
  return styles.flagUpdate
}

function rowTone(fiber: FiberSnapshot): string {
  const motion = fiberMotionToken(fiber)
  if (motion === 'mounted') return styles.fiberMounted
  if (motion === 'deleted') return styles.fiberDeleted
  if (motion === 'updated') return styles.fiberUpdated
  if (motion === 'moved') return styles.fiberMoved
  return styles.fiberReused
}

/**
 * Keep a Fiber row mounted while the timeline advances. The token only
 * changes when the row enters a meaningful visual state, so a reused row
 * does not restart its opacity animation on every snapshot.
 */
function fiberMotionToken(fiber: FiberSnapshot): 'mounted' | 'deleted' | 'updated' | 'moved' | 'reused' {
  if (fiber.reuse === 'mounted') return 'mounted'
  if (fiber.reuse === 'deleted') return 'deleted'
  if (fiber.flags.includes('Update')) return 'updated'
  if (fiber.flags.includes('Placement')) return 'moved'
  return 'reused'
}

function eventColor(phase: SimulationSnapshot['event']['phase']): string {
  if (phase === 'trigger') return styles.eventTrigger
  if (phase === 'render') return styles.eventRender
  if (phase === 'commit') return styles.eventCommit
  return styles.eventReconcile
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return reduced
}

interface FiberRowProps {
  fiber: FiberSnapshot
  selected: boolean
  focused: boolean
  entryOffsetY?: number
  motionToken?: ReturnType<typeof fiberMotionToken>
  onSelect: (id: string) => void
}

function FiberRow({ fiber, selected, focused, entryOffsetY = 0, motionToken, onSelect }: FiberRowProps) {
  const motionStyle = {
    '--fiber-entry-offset-y': `${entryOffsetY}px`,
  } as CSSProperties

  return (
    <button
      type="button"
      className={`${styles.fiberRow} ${rowTone(fiber)} ${selected ? styles.fiberSelected : ''} ${
        focused ? styles.fiberFocused : ''
      }`}
      style={motionStyle}
      data-entry-offset-y={entryOffsetY || undefined}
      data-motion={motionToken ?? fiberMotionToken(fiber)}
      aria-pressed={selected}
      onClick={() => onSelect(fiber.id)}
    >
      <span className={styles.fiberIndex}>{String(fiber.index).padStart(2, '0')}</span>
      <span className={styles.fiberNode} aria-hidden="true">
        <span />
      </span>
      <span className={styles.fiberIdentity}>
        <strong>{fiber.id}</strong>
        <small>{fiber.type}</small>
      </span>
      <span className={styles.fiberKey}>
        key
        <code>{fiber.key ?? '∅'}</code>
      </span>
      <span className={styles.fiberState}>
        <span>state</span>
        <strong>{fiber.state}</strong>
      </span>
      <span className={styles.fiberStatus}>
        {fiber.reuse === 'reused' && 'reused'}
        {fiber.reuse === 'mounted' && 'mount'}
        {fiber.reuse === 'deleted' && 'delete'}
      </span>
      {fiber.flags.length > 0 && (
        <span className={styles.flagList} aria-label={`flags: ${fiber.flags.join(', ')}`}>
          {fiber.flags.map((flag) => (
            <span className={`${styles.flag} ${flagTone(flag)}`} key={flag}>
              {flag}
            </span>
          ))}
        </span>
      )}
    </button>
  )
}

interface DomRowProps {
  row: SimulationSnapshot['domRows'][number]
  selected: boolean
  entryOffsetY?: number
  motionToken?: string
  onSelect: (id: string) => void
}

function DomRow({ row, selected, entryOffsetY = 0, motionToken = 'stable', onSelect }: DomRowProps) {
  const motionStyle = {
    '--dom-entry-offset-y': `${entryOffsetY}px`,
  } as CSSProperties

  return (
    <button
      type="button"
      className={`${styles.domRow} ${selected ? styles.domRowSelected : ''}`}
      style={motionStyle}
      data-entry-offset-y={entryOffsetY || undefined}
      data-motion={motionToken}
      aria-pressed={selected}
      onClick={() => onSelect(row.id)}
    >
      <span className={styles.domTag}>&lt;Row /&gt;</span>
      <span className={styles.domLabel}>{row.label}</span>
      <span className={styles.domState}>state: {row.state}</span>
      <ArrowRight size={14} aria-hidden="true" />
    </button>
  )
}

interface InspectorProps {
  fiber: FiberSnapshot | undefined
  result: SimulationResult
  snapshot: SimulationSnapshot
  unlocked: boolean
}

function Inspector({ fiber, result, snapshot, unlocked }: InspectorProps) {
  if (!fiber) {
    return (
      <aside className={styles.inspectorEmpty} aria-label="节点检查器">
        <Target size={22} aria-hidden="true" />
        <strong>选择一个 Fiber 节点</strong>
        <p>点击舞台里的节点，查看它如何被匹配、复用或重新挂载。</p>
      </aside>
    )
  }

  const transferText = fiber.alternateId
    ? `复用了旧 Fiber ${fiber.alternateId}`
    : fiber.reuse === 'mounted'
      ? '没有找到可复用的旧 Fiber'
      : fiber.reuse === 'deleted'
        ? '该节点在当前快照中被删除'
        : '当前 Fiber 尚未生成 alternate'

  return (
    <aside className={styles.inspector} aria-label="节点检查器">
      <div className={styles.inspectorHeading}>
        <div>
          <span className={styles.panelEyebrow}>NODE INSPECTOR</span>
          <h2>{fiber.id} · Row</h2>
        </div>
        <span className={`${styles.inspectorState} ${rowTone(fiber)}`}>{fiber.reuse}</span>
      </div>

      <div className={styles.inspectorGrid}>
        <div>
          <span>key</span>
          <code>{fiber.key ?? '∅'}</code>
        </div>
        <div>
          <span>index</span>
          <code>{fiber.index}</code>
        </div>
        <div>
          <span>state</span>
          <code>{fiber.state}</code>
        </div>
        <div>
          <span>alternate</span>
          <code>{fiber.alternateId ?? '—'}</code>
        </div>
      </div>

      <div className={styles.inspectorCallout}>
        <span className={styles.calloutIcon} aria-hidden="true">
          {fiber.reuse === 'reused' ? <Check size={15} /> : <Zap size={15} />}
        </span>
        <div>
          <strong>{transferText}</strong>
          <p>
            {fiber.reuse === 'reused'
              ? 'state 沿着匹配到的身份继续存在。'
              : fiber.reuse === 'mounted'
                ? 'React 需要为它创建新的工作单元。'
                : fiber.reuse === 'deleted'
                  ? 'Commit 时会移除对应的 DOM 节点。'
                  : 'Render 开始后，alternate 会记录它与 WIP 的关系。'}
          </p>
        </div>
      </div>

      <div className={styles.inspectorSection}>
        <div className={styles.sectionLabel}>FLAGS</div>
        {fiber.flags.length > 0 ? (
          <div className={styles.inspectorFlags}>
            {fiber.flags.map((flag) => (
              <span className={`${styles.flag} ${flagTone(flag)}`} key={flag}>
                {flag}
              </span>
            ))}
          </div>
        ) : (
          <span className={styles.noFlags}>本步骤没有待提交的变更</span>
        )}
      </div>

      <div className={styles.inspectorSection}>
        <div className={styles.sectionLabel}>CURRENT EVENT</div>
        <p className={styles.inspectorExplanation}>{snapshot.event.explanation}</p>
      </div>

      {unlocked && snapshot.step === result.snapshots.length - 1 && (
        <div className={styles.answerBox}>
          <span className={styles.sectionLabel}>OBSERVATION RESULT</span>
          <p>{result.finalAnswer}</p>
        </div>
      )}

      <a
        className={styles.sourceReference}
        href="https://react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key"
        target="_blank"
        rel="noreferrer"
      >
        <Info size={14} aria-hidden="true" />
        查看 React 官方关于 key 的说明
        <ArrowUp size={13} aria-hidden="true" />
      </a>

      <details className={styles.sourceDetails}>
        <summary>
          <Info size={13} aria-hidden="true" />
          源码观察：匹配的最小单位
        </summary>
        <div className={styles.sourceDetailsBody}>
          <p>教学模型用 <code>key + type</code> 判断身份，再把旧 Fiber 的 state token 转移到新的位置。</p>
          <code className={styles.sourceCodeBlock}>
            sameIdentity = old.key === next.key &amp;&amp; old.type === next.type
          </code>
          <p>真实实现还会受到调度、边界和宿主配置影响；这里的字段只用于建立可验证的心智模型。</p>
        </div>
      </details>
    </aside>
  )
}

interface KeyLabControlsProps {
  scenario: KeyScenario
  unlocked: boolean
  prediction: string
  predictionResult: boolean | null
  previousSummary: PreviousSummary | null
  trackedItem: KeyScenario['items'][number]
  answerOptions: string[]
  onScenarioChange: (next: KeyScenario) => void
  onPredictionChange: (value: string) => void
  onSubmitPrediction: () => void
  onReset: () => void
}

function KeyLabControls({
  scenario,
  unlocked,
  prediction,
  predictionResult,
  previousSummary,
  trackedItem,
  answerOptions,
  onScenarioChange,
  onPredictionChange,
  onSubmitPrediction,
  onReset,
}: KeyLabControlsProps) {
  const strategy = strategyLabels[scenario.keyStrategy]
  const operation = scenario.operation

  const updateStrategy = (keyStrategy: KeyStrategy) => {
    onScenarioChange({ ...scenario, keyStrategy })
  }

  const updateOperation = (type: ListOperation['type']) => {
    const nextOperation: ListOperation =
      type === 'delete' ? { type, itemId: 'B' } : type === 'prepend' ? { type, itemId: 'X' } : { type }
    onScenarioChange({ ...scenario, operation: nextOperation })
  }

  const updateDeleteTarget = (itemId: string) => {
    if (operation.type !== 'delete') return
    onScenarioChange({ ...scenario, operation: { type: 'delete', itemId } })
  }

  return (
    <div className={styles.controlsStack}>
      <section className={styles.controlCard} aria-labelledby="scenario-title">
        <div className={styles.controlCardHeading}>
          <div>
            <span className={styles.panelEyebrow}>SCENARIO INPUT</span>
            <h2 id="scenario-title">先改变一个变量</h2>
          </div>
          <button className={styles.iconButton} type="button" onClick={onReset} aria-label="重置实验">
            <RotateCcw size={16} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.controlGroup}>
          <span className={styles.controlLabel} id="key-strategy-label">
            KEY STRATEGY
          </span>
          <div
            id="key-strategy"
            className={styles.strategyList}
            role="group"
            aria-labelledby="key-strategy-label"
          >
            {(Object.keys(strategyLabels) as KeyStrategy[]).map((keyStrategy) => {
              const item = strategyLabels[keyStrategy]
              return (
                <button
                  type="button"
                  className={`${styles.strategyButton} ${
                    scenario.keyStrategy === keyStrategy ? styles.strategyActive : ''
                  }`}
                  key={keyStrategy}
                  aria-pressed={scenario.keyStrategy === keyStrategy}
                  onClick={() => updateStrategy(keyStrategy)}
                >
                  <span className={styles.strategyDot} data-tone={item.tone} aria-hidden="true" />
                  <span>
                    <strong>{item.code}</strong>
                    <small>{item.label}</small>
                  </span>
                  {scenario.keyStrategy === keyStrategy && <Check size={15} aria-hidden="true" />}
                </button>
              )
            })}
          </div>
        </div>

        <div className={styles.controlGroup}>
          <span className={styles.controlLabel}>OPERATION</span>
          <div className={styles.operationList} role="group" aria-label="选择列表操作">
            {(Object.keys(operationLabels) as ListOperation['type'][]).map((type) => (
              <button
                type="button"
                className={`${styles.operationButton} ${operation.type === type ? styles.operationActive : ''}`}
                key={type}
                aria-pressed={operation.type === type}
                onClick={() => updateOperation(type)}
              >
                {type === 'prepend' && <ArrowDown size={14} aria-hidden="true" />}
                {type === 'delete' && <X size={14} aria-hidden="true" />}
                {type === 'reverse' && <ArrowLeft size={14} aria-hidden="true" />}
                {operationLabels[type]}
              </button>
            ))}
          </div>
          {operation.type === 'delete' && (
            <label className={styles.selectLabel} htmlFor="delete-target">
              删除目标
              <span className={styles.selectWrap}>
                <select
                  id="delete-target"
                  value={operation.itemId}
                  onChange={(event) => updateDeleteTarget(event.target.value)}
                >
                  {scenario.items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.id} · state {item.state}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} aria-hidden="true" />
              </span>
            </label>
          )}
        </div>

        <div className={styles.scenarioSummary}>
          <span className={`${styles.tonePill} ${styles[`tone${strategy.tone}`]}`}>
            <span className={styles.toneDot} aria-hidden="true" />
            {strategy.code}
          </span>
          <span className={styles.summaryArrow}>→</span>
          <span className={styles.summaryText}>{operationLabels[operation.type]}</span>
        </div>
        {scenario.keyStrategy === 'none' && (
          <div className={styles.strategyWarning} role="status">
            <AlertTriangle size={13} aria-hidden="true" />
            <span>无 key 是教学模式：真实 React 会提示列表项缺少 key。</span>
          </div>
        )}
      </section>

      <section className={`${styles.predictionCard} ${unlocked ? styles.predictionComplete : ''}`}>
        <div className={styles.predictionHeading}>
          <span className={styles.predictionIcon} aria-hidden="true">
            {unlocked ? <Check size={16} /> : <CircleHelp size={16} />}
          </span>
          <div>
            <span className={styles.panelEyebrow}>MAKE A PREDICTION</span>
            <h2>{unlocked ? '预测已记录' : '先猜一猜'}</h2>
          </div>
        </div>
        <p className={styles.predictionPrompt}>
          这次{operationLabels[operation.type]}后，{trackedItem.id} 的 state = {trackedItem.state} 会跟着哪一行？
        </p>
        {!unlocked && (
          <div className={styles.predictionOptions} role="radiogroup" aria-label="选择你的预测">
            {answerOptions.map((answer) => (
              <label className={styles.predictionOption} key={answer}>
                <input
                  type="radio"
                  name="prediction"
                  value={answer}
                  checked={prediction === answer}
                  onChange={() => onPredictionChange(answer)}
                />
                <span>{resultRowLabel(answer, trackedItem.id)}</span>
              </label>
            ))}
          </div>
        )}
        {!unlocked ? (
          <button
            className={styles.predictionButton}
            type="button"
            disabled={!prediction}
            onClick={onSubmitPrediction}
          >
            锁定预测 <ArrowRight size={15} aria-hidden="true" />
          </button>
        ) : (
          <div
            className={`${styles.predictionFeedback} ${
              predictionResult === null
                ? styles.feedbackNeutral
                : predictionResult
                  ? styles.feedbackCorrect
                  : styles.feedbackWrong
            }`}
            role="status"
            aria-live="polite"
          >
            {predictionResult === true ? <Check size={15} aria-hidden="true" /> : <Info size={15} aria-hidden="true" />}
            {predictionResult === null
              ? '已从分享链接恢复实验，可直接继续观测。'
              : predictionResult
                ? '命中。现在逐步验证你的推理。'
                : '实验结果已经揭晓，看看 state 为什么会错位。'}
          </div>
        )}
      </section>

      <div className={styles.controlHint}>
        <Sparkles size={14} aria-hidden="true" />
        <span>提示：点击舞台中的任意节点，右侧会展开它的 alternate 和 flags。</span>
      </div>

      {previousSummary && (
        <aside className={styles.previousSummary} aria-label="上一轮实验结果">
          <div className={styles.previousSummaryHeading}>
            <span className={styles.panelEyebrow}>LAST RUN / COMPARE</span>
            <span className={styles.previousSummaryBadge}>上一轮</span>
          </div>
          <div className={styles.previousSummaryMeta}>
            <code>{strategyLabels[previousSummary.keyStrategy].code}</code>
            <span>→</span>
            <span>{previousSummary.operation}</span>
          </div>
          <p>{previousSummary.answer}</p>
        </aside>
      )}
    </div>
  )
}

interface LabStageProps {
  snapshot: SimulationSnapshot
  previousSnapshot?: SimulationSnapshot
  stageRef: RefObject<HTMLElement | null>
  selectedId: string
  isFocusMode: boolean
  focusButtonRef: RefObject<HTMLButtonElement | null>
  onSelect: (id: string) => void
  onToggleFocusMode: () => void
}

function LabStage({
  snapshot,
  previousSnapshot,
  stageRef,
  selectedId,
  isFocusMode,
  focusButtonRef,
  onSelect,
  onToggleFocusMode,
}: LabStageProps) {
  const focused = new Set(snapshot.event.focusIds)
  const current = snapshot.current.filter((fiber) => fiber.reuse !== 'deleted')
  const deleted = snapshot.current.filter((fiber) => fiber.reuse === 'deleted')
  const previousDomRows = previousSnapshot?.domRows ?? []

  function fiberEntryOffset(fiber: FiberSnapshot, source: FiberSnapshot[]) {
    const sourceId = fiber.alternateId ?? fiber.id
    const sourceFiber = source.find(({ id }) => id === sourceId)
    if (!sourceFiber || sourceFiber.index === fiber.index) return 0
    // The row's desktop rhythm is 55px + 6px gap. Using that rhythm for the
    // entry offset keeps a reordered Fiber visually connected to its origin;
    // the reduced-motion media query still removes the animation entirely.
    return (sourceFiber.index - fiber.index) * 61
  }

  function domEntryOffset(row: SimulationSnapshot['domRows'][number]) {
    const previousIndex = previousDomRows.findIndex(({ id }) => id === row.id)
    const nextIndex = snapshot.domRows.findIndex(({ id }) => id === row.id)
    if (previousIndex < 0 || previousIndex === nextIndex) return 0
    // DOM rows are 38px high with a 6px grid gap.
    return (previousIndex - nextIndex) * 44
  }

  function domMotionToken(row: SimulationSnapshot['domRows'][number]) {
    // The first snapshot is the initial scene, not a DOM mutation. Keep its
    // keys stable so the first timeline step does not remount every row.
    if (!previousSnapshot) return 'stable'

    const previousIndex = previousDomRows.findIndex(({ id }) => id === row.id)
    const nextIndex = snapshot.domRows.findIndex(({ id }) => id === row.id)
    const previousRow = previousDomRows.find(({ id }) => id === row.id)

    if (previousIndex < 0) return 'enter'
    if (previousIndex !== nextIndex) return `move-${previousIndex}-${nextIndex}`
    if (previousRow?.label !== row.label || previousRow?.state !== row.state) return 'update'
    return 'stable'
  }

  return (
    <section ref={stageRef} className={styles.stageCard} aria-labelledby="stage-title">
      <div className={styles.stageHeader}>
        <div>
          <span className={styles.panelEyebrow}>ANIMATION STAGE</span>
          <h2 id="stage-title">Fiber 如何找到自己的位置</h2>
        </div>
        <div className={styles.stageHeaderActions}>
          <div className={`${styles.phaseBadge} ${eventColor(snapshot.event.phase)}`}>
            <span className={styles.phaseDot} aria-hidden="true" />
            {phaseLabels[snapshot.event.phase]}
          </div>
          <button
            ref={focusButtonRef}
            className={`${styles.focusModeButton} ${isFocusMode ? styles.focusModeButtonActive : ''}`}
            type="button"
            aria-label={isFocusMode ? '退出全屏演示' : '进入全屏演示'}
            aria-pressed={isFocusMode}
            aria-controls="lab-stage-workspace"
            onClick={onToggleFocusMode}
          >
            {isFocusMode ? <Minimize2 size={15} aria-hidden="true" /> : <Maximize2 size={15} aria-hidden="true" />}
            <span>{isFocusMode ? '退出全屏' : '全屏演示'}</span>
            <kbd>{isFocusMode ? 'Esc' : 'F'}</kbd>
          </button>
        </div>
      </div>

      <div className={styles.eventBanner} aria-live="polite">
        <div className={styles.eventNumber}>{String(snapshot.step + 1).padStart(2, '0')}</div>
        <div>
          <strong>{snapshot.event.title}</strong>
          <p>{snapshot.event.explanation}</p>
        </div>
      </div>

      <div className={styles.treeWorkspace} data-phase={snapshot.event.phase} data-stage-tree>
        <div className={styles.treeColumn}>
          <div className={styles.treeColumnHeader}>
            <span className={styles.treeTitle}><span className={styles.currentLegend} /> CURRENT TREE</span>
            <span className={styles.treeMeta}>提交前</span>
          </div>
          <div className={styles.fiberList}>
            {current.length > 0 ? (
              current.map((fiber) => (
                <FiberRow
                  key={`current-${fiber.id}-${fiberMotionToken(fiber)}`}
                  fiber={fiber}
                  selected={selectedId === fiber.id}
                  focused={focused.has(fiber.id)}
                  entryOffsetY={fiberEntryOffset(fiber, previousSnapshot?.current ?? [])}
                  motionToken={fiberMotionToken(fiber)}
                  onSelect={onSelect}
                />
              ))
            ) : (
              <div className={styles.emptyTree}>初始树尚未生成</div>
            )}
            {deleted.map((fiber) => (
              <FiberRow
                key={`deleted-${fiber.id}-${fiberMotionToken(fiber)}`}
                fiber={fiber}
                selected={selectedId === fiber.id}
                focused={focused.has(fiber.id)}
                entryOffsetY={fiberEntryOffset(fiber, previousSnapshot?.current ?? [])}
                motionToken={fiberMotionToken(fiber)}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>

        <div className={styles.treeConnector} aria-hidden="true">
          <span className={styles.connectorLine} />
          <ArrowRight size={16} />
          <span className={styles.connectorLabel}>reconcile</span>
        </div>

        <div className={styles.treeColumn}>
          <div className={styles.treeColumnHeader}>
            <span className={styles.treeTitle}><span className={styles.wipLegend} /> WORK-IN-PROGRESS</span>
            <span className={styles.treeMeta}>下一棵树</span>
          </div>
          <div className={styles.fiberList}>
            {snapshot.workInProgress.length > 0 ? (
              snapshot.workInProgress.map((fiber) => (
                <FiberRow
                  key={`wip-${fiber.id}-${fiberMotionToken(fiber)}`}
                  fiber={fiber}
                  selected={selectedId === fiber.id}
                  focused={focused.has(fiber.id)}
                  entryOffsetY={fiberEntryOffset(fiber, snapshot.current)}
                  motionToken={fiberMotionToken(fiber)}
                  onSelect={onSelect}
                />
              ))
            ) : (
              <div className={styles.emptyTree}>等待 Render 开始</div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.domSection} data-phase={snapshot.event.phase} data-stage-dom>
        <div className={styles.treeColumnHeader}>
          <span className={styles.treeTitle}><span className={styles.domLegend} /> DOM RESULT</span>
          <span className={styles.treeMeta}>{snapshot.step === 5 ? '已提交' : '保持不变'}</span>
        </div>
        <div className={styles.domList}>
          {snapshot.domRows.map((row) => (
            <DomRow
              key={`${row.id}-${domMotionToken(row)}`}
              row={row}
              selected={selectedId === row.id}
              entryOffsetY={domEntryOffset(row)}
              motionToken={domMotionToken(row)}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

interface TimelineProps {
  result: SimulationResult
  snapshot: SimulationSnapshot
  step: number
  status: PlaybackStatus
  speed: number
  breakpoint: boolean
  onStep: (nextStep: number) => void
  onTogglePlay: () => void
  onSpeedChange: (speed: number) => void
  onBreakpointChange: (value: boolean) => void
  onShare: () => void
  shareLabel: string
  isFocusMode: boolean
  onToggleFocusMode: () => void
}

function Timeline({
  result,
  snapshot,
  step,
  status,
  speed,
  breakpoint,
  onStep,
  onTogglePlay,
  onSpeedChange,
  onBreakpointChange,
  onShare,
  shareLabel,
  isFocusMode,
  onToggleFocusMode,
}: TimelineProps) {
  const maxStep = result.snapshots.length - 1
  const canPlay = status !== 'prediction'

  return (
    <section className={styles.timelineCard} aria-label="实验时间线">
      <div className={styles.timelineTopline}>
        <div>
          <span className={styles.panelEyebrow}>EVENT TIMELINE</span>
          <strong>{snapshot.event.title}</strong>
        </div>
        <span className={`${styles.playbackStatus} ${styles[`status${status}`]}`}>
          <span className={styles.statusDotSmall} aria-hidden="true" />
          {playbackLabels[status]}
        </span>
        <button
          className={styles.timelineFocusButton}
          type="button"
          aria-label={isFocusMode ? '退出全屏演示' : '进入全屏演示'}
          aria-pressed={isFocusMode}
          onClick={onToggleFocusMode}
        >
          {isFocusMode ? <Minimize2 size={14} aria-hidden="true" /> : <Maximize2 size={14} aria-hidden="true" />}
          <span>{isFocusMode ? '退出' : '全屏'}</span>
        </button>
      </div>
      <div className={styles.timelineTrackWrap}>
        <input
          className={styles.timelineRange}
          type="range"
          min={0}
          max={maxStep}
          step={1}
          value={step}
          disabled={!canPlay}
          onChange={(event) => onStep(Number(event.target.value))}
          aria-label={`当前步骤 ${step + 1}，共 ${maxStep + 1} 步`}
        />
        <div className={styles.timelineMarkers} aria-hidden="true">
          {result.snapshots.map((item, index) => (
            <span className={index <= step ? styles.markerActive : ''} key={item.event.id} />
          ))}
        </div>
      </div>
      <div className={styles.timelineEvents} aria-label="事件步骤">
        {result.snapshots.map((item, index) => (
          <button
            type="button"
            className={`${styles.timelineEvent} ${index === step ? styles.timelineEventActive : ''}`}
            key={item.event.id}
            disabled={!canPlay}
            onClick={() => onStep(index)}
          >
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{item.event.title.split(' · ')[0]}</strong>
          </button>
        ))}
      </div>
      <div className={styles.timelineControls}>
        <div className={styles.controlCluster}>
          <button
            className={styles.timelineIconButton}
            type="button"
            disabled={!canPlay || step === 0}
            onClick={() => onStep(Math.max(0, step - 1))}
            aria-label="上一步"
          >
            <SkipBack size={16} aria-hidden="true" />
          </button>
          <button
            className={`${styles.playButton} ${status === 'playing' ? styles.playButtonActive : ''}`}
            type="button"
            disabled={!canPlay}
            onClick={onTogglePlay}
            aria-label={status === 'playing' ? '暂停播放' : '播放实验'}
          >
            {status === 'playing' ? <Pause size={17} fill="currentColor" aria-hidden="true" /> : <Play size={17} fill="currentColor" aria-hidden="true" />}
          </button>
          <button
            className={styles.timelineIconButton}
            type="button"
            disabled={!canPlay || step === maxStep}
            onClick={() => onStep(Math.min(maxStep, step + 1))}
            aria-label="下一步"
          >
            <SkipForward size={16} aria-hidden="true" />
          </button>
        </div>
        <div className={styles.timelineOptions}>
          <label className={styles.speedControl}>
            <FastForward size={14} aria-hidden="true" />
            <span className={styles.srOnly}>播放速度</span>
            <select value={speed} onChange={(event) => onSpeedChange(Number(event.target.value))} disabled={!canPlay}>
              {speedOptions.map((option) => (
                <option value={option} key={option}>{option}×</option>
              ))}
            </select>
            <ChevronDown size={13} aria-hidden="true" />
          </label>
          <label className={styles.breakpointToggle}>
            <input
              type="checkbox"
              checked={breakpoint}
              onChange={(event) => onBreakpointChange(event.target.checked)}
              disabled={!canPlay}
            />
            <Flag size={14} aria-hidden="true" />
            <span>在 Commit 前暂停</span>
          </label>
          <button className={styles.shareButton} type="button" onClick={onShare}>
            <Copy size={14} aria-hidden="true" />
            {shareLabel}
          </button>
        </div>
      </div>
    </section>
  )
}

export function KeyLabPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const reducedMotion = useReducedMotion()
  const searchKey = searchParams.toString()
  const scenario = useMemo(() => decodeScenario(new URLSearchParams(searchKey)), [searchKey])
  const result = useMemo(() => simulateKeyScenario(scenario), [scenario])
  const maxStep = result.snapshots.length - 1
  const urlStep = parseStep(searchParams.get('step'), maxStep)
  const scenarioKey = encodeScenario(scenario)
  const trackedItem = trackedItemFor(scenario)
  const answerOptions = useMemo(() => {
    const finalSnapshot = result.snapshots.at(-1)
    return [...new Set([...(finalSnapshot?.workInProgress.map(({ id }) => id) ?? []), 'none'])]
  }, [result])
  const previousScenarioKey = useRef(scenarioKey)
  const pendingUrlStep = useRef<number | null>(null)
  const breakpointStep = useRef<number | null>(null)
  const [step, setStep] = useState(urlStep)
  const [status, setStatus] = useState<PlaybackStatus>(
    urlStep === maxStep ? 'complete' : urlStep > 0 ? 'paused' : 'prediction',
  )
  const [prediction, setPrediction] = useState('')
  const [predictionResult, setPredictionResult] = useState<boolean | null>(null)
  const [selectedId, setSelectedId] = useState(trackedItem.id)
  const [speed, setSpeed] = useState(1)
  const [breakpoint, setBreakpoint] = useState(false)
  const [shareLabel, setShareLabel] = useState('分享实验')
  const [shareFallbackUrl, setShareFallbackUrl] = useState('')
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(urlStep > 0 ? 'stage' : 'controls')
  const [previousSummary, setPreviousSummary] = useState<PreviousSummary | null>(null)
  const [isFocusMode, setIsFocusMode] = useState(false)
  const shareResetTimer = useRef<number | null>(null)
  const stageCardRef = useRef<HTMLElement>(null)
  const stageWorkspaceRef = useRef<HTMLDivElement>(null)
  const focusButtonRef = useRef<HTMLButtonElement>(null)
  const focusReturnRef = useRef<HTMLElement | null>(null)
  const wasFocusModeRef = useRef(false)

  const snapshot = result.snapshots[Math.min(step, maxStep)]
  const previousSnapshot = step > 0 ? result.snapshots[Math.min(step - 1, maxStep)] : undefined
  const selectedFiber = [...snapshot.workInProgress, ...snapshot.current].find(({ id }) => id === selectedId)
  const unlocked = status !== 'prediction'

  useEffect(() => {
    if (previousScenarioKey.current === scenarioKey) return
    previousScenarioKey.current = scenarioKey
    const nextStep = parseStep(searchParams.get('step'), maxStep)
    setStep(nextStep)
    setStatus(nextStep === maxStep ? 'complete' : nextStep > 0 ? 'paused' : 'prediction')
    setPrediction('')
    setPredictionResult(null)
    setSelectedId(trackedItem.id)
    setShareFallbackUrl('')
    setMobilePanel(nextStep > 0 ? 'stage' : 'controls')
    setIsFocusMode(false)
    focusReturnRef.current = null
    breakpointStep.current = null
  }, [maxStep, scenarioKey, searchParams, trackedItem.id])

  useEffect(() => {
    if (urlStep === step) {
      if (pendingUrlStep.current === step) pendingUrlStep.current = null
      return
    }
    // A state update and its URL update may commit in separate renders. Keep
    // the playing state intact while our own URL write catches up; only
    // external deep-link changes should reset playback status.
    if (pendingUrlStep.current === step) return
    setStep(urlStep)
    setStatus(urlStep === maxStep ? 'complete' : urlStep > 0 ? 'paused' : 'prediction')
    setMobilePanel(urlStep > 0 ? 'stage' : 'controls')
    setIsFocusMode(false)
    focusReturnRef.current = null
    breakpointStep.current = null
  }, [maxStep, step, urlStep])

  useEffect(() => {
    if (!isFocusMode) return

    const previousBodyOverflow = document.body.style.overflow
    const previousDocumentOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    const workspace = stageWorkspaceRef.current
    workspace?.focus({ preventScroll: true })

    const focusBackground = Array.from(
      document.querySelectorAll<HTMLElement>('[data-focus-background]'),
    ).map((element) => ({
      element,
      ariaHidden: element.getAttribute('aria-hidden'),
      inert: element.hasAttribute('inert'),
    }))
    focusBackground.forEach(({ element }) => {
      element.setAttribute('aria-hidden', 'true')
      element.setAttribute('inert', '')
    })

    const handleFocusKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        const target = event.target instanceof HTMLElement ? event.target : null
        if (target?.matches('select, input, textarea')) return
        event.preventDefault()
        setIsFocusMode(false)
        return
      }

      if (event.key !== 'Tab') return

      const currentWorkspace = stageWorkspaceRef.current
      if (!currentWorkspace) return

      const focusable = Array.from(
        currentWorkspace.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => {
        if (element.hidden) return false
        const style = window.getComputedStyle(element)
        return style.display !== 'none' && style.visibility !== 'hidden'
      })

      if (focusable.length === 0) {
        event.preventDefault()
        currentWorkspace.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const activeElement = document.activeElement

      if (event.shiftKey && (activeElement === first || !currentWorkspace.contains(activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (activeElement === last || !currentWorkspace.contains(activeElement))) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleFocusKeyDown)
    return () => {
      window.removeEventListener('keydown', handleFocusKeyDown)
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousDocumentOverflow
      focusBackground.forEach(({ element, ariaHidden, inert }) => {
        if (ariaHidden === null) element.removeAttribute('aria-hidden')
        else element.setAttribute('aria-hidden', ariaHidden)
        if (!inert) element.removeAttribute('inert')
        else element.setAttribute('inert', '')
      })

      const returnTarget = focusReturnRef.current
      focusReturnRef.current = null
      if (returnTarget && document.contains(returnTarget)) {
        window.requestAnimationFrame(() => returnTarget.focus({ preventScroll: true }))
      }
    }
  }, [isFocusMode])

  useEffect(() => {
    if (!isFocusMode) {
      wasFocusModeRef.current = false
      return
    }

    const stageCard = stageCardRef.current
    const justEnteredFocusMode = !wasFocusModeRef.current
    wasFocusModeRef.current = true
    if (justEnteredFocusMode) {
      if (stageCard) stageCard.scrollTop = 0
      return
    }

    const targetSelector = snapshot.event.phase === 'commit' ? '[data-stage-dom]' : '[data-stage-tree]'
    const target = stageCard?.querySelector<HTMLElement>(targetSelector)
    if (!target || typeof target.scrollIntoView !== 'function') return

    target.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: snapshot.event.phase === 'commit' ? 'end' : 'nearest',
    })
  }, [isFocusMode, reducedMotion, snapshot.event.phase, snapshot.step])

  useEffect(() => {
    if (status !== 'playing') return

    const duration = reducedMotion ? 80 : Math.max(220, 720 / speed)
    const timer = window.setTimeout(() => {
      const nextStep = Math.min(maxStep, step + 1)

      if (
        breakpoint &&
        breakpointStep.current !== step &&
        result.snapshots[nextStep].event.phase === 'commit'
      ) {
        breakpointStep.current = step
        setStatus('paused')
        return
      }

      breakpointStep.current = null
      pendingUrlStep.current = nextStep
      setStep(nextStep)
      setSearchParams((current) => {
        const next = new URLSearchParams(current)
        next.set('step', String(nextStep))
        return next
      }, { replace: true })

      if (nextStep === maxStep) {
        setStatus('complete')
      }
    }, duration)

    return () => window.clearTimeout(timer)
  }, [breakpoint, maxStep, reducedMotion, result.snapshots, setSearchParams, speed, status, step])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target instanceof HTMLElement ? event.target : null
      if (target?.closest('input, select, textarea, [contenteditable="true"]')) return
      if (event.key.toLowerCase() === 'f' && !target?.closest('button, a')) {
        event.preventDefault()
        handleToggleFocusMode()
        return
      }
      if (target?.closest('button, a')) return
      if (event.key === ' ') {
        if (unlocked) {
          event.preventDefault()
          handleTogglePlay()
        }
      }
      if (event.key === 'ArrowLeft' && unlocked) {
        event.preventDefault()
        handleStep(-1)
      }
      if (event.key === 'ArrowRight' && unlocked) {
        event.preventDefault()
        handleStep(1)
      }
      if (event.key.toLowerCase() === 'r') {
        event.preventDefault()
        handleReset()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  useEffect(() => () => {
    if (shareResetTimer.current !== null) {
      window.clearTimeout(shareResetTimer.current)
    }
  }, [])

  function setStepInUrl(nextStep: number) {
    const clamped = Math.min(Math.max(nextStep, 0), maxStep)
    breakpointStep.current = null
    pendingUrlStep.current = clamped
    setStep(clamped)
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set('step', String(clamped))
      return next
    }, { replace: true })
    if (clamped === maxStep) setStatus('complete')
    else if (status === 'complete' || status === 'playing') setStatus('paused')
  }

  function handleStep(delta: number) {
    if (!unlocked) return
    setStepInUrl(step + delta)
  }

  function handleTogglePlay() {
    if (!unlocked) return
    if (status === 'complete') {
      setStepInUrl(0)
      setStatus('playing')
      return
    }
    setStatus((current) => current === 'playing' ? 'paused' : 'playing')
  }

  function handleBreakpointChange(value: boolean) {
    if (!value) breakpointStep.current = null
    setBreakpoint(value)
  }

  function handleScenarioChange(nextScenario: KeyScenario) {
    if (encodeScenario(nextScenario) === scenarioKey) return
    setPreviousSummary({
      keyStrategy: scenario.keyStrategy,
      operation: operationLabels[scenario.operation.type],
      answer: result.finalAnswer,
    })
    const params = new URLSearchParams(encodeScenario(nextScenario))
    params.set('step', '0')
    pendingUrlStep.current = 0
    setSearchParams(params, { replace: true })
    setStep(0)
    setStatus('prediction')
    setPrediction('')
    setPredictionResult(null)
    setSelectedId(trackedItemFor(nextScenario).id)
    setShareFallbackUrl('')
    setBreakpoint(false)
    breakpointStep.current = null
    setMobilePanel('controls')
    setIsFocusMode(false)
    focusReturnRef.current = null
  }

  function handleReset() {
    const defaultScenario = createDefaultKeyScenario()
    const params = new URLSearchParams(encodeScenario(defaultScenario))
    params.set('step', '0')
    pendingUrlStep.current = 0
    setSearchParams(params, { replace: true })
    setStep(0)
    setStatus('prediction')
    setPrediction('')
    setPredictionResult(null)
    setSelectedId(trackedItemFor(defaultScenario).id)
    setShareLabel('分享实验')
    setShareFallbackUrl('')
    setBreakpoint(false)
    breakpointStep.current = null
    setMobilePanel('controls')
    setPreviousSummary(null)
    setIsFocusMode(false)
    focusReturnRef.current = null
  }

  function handleSubmitPrediction() {
    const isCorrect = prediction === expectedReceiver(result, trackedItem.id)
    setPredictionResult(isCorrect)
    setStatus('ready')
    setMobilePanel('stage')
  }

  function handleToggleFocusMode() {
    if (isFocusMode) {
      setIsFocusMode(false)
      return
    }

    const activeElement = document.activeElement
    focusReturnRef.current = activeElement instanceof HTMLElement ? activeElement : focusButtonRef.current
    setMobilePanel('stage')
    setIsFocusMode(true)
  }

  async function handleShare() {
    const params = new URLSearchParams(encodeScenario(scenario))
    params.set('step', String(step))
    const shareUrl = new URL(window.location.href)
    shareUrl.pathname = window.location.pathname
    shareUrl.search = params.toString()
    shareUrl.hash = ''
    const shareUrlText = shareUrl.toString()
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable')
      await navigator.clipboard.writeText(shareUrlText)
      setShareLabel('已复制链接')
      setShareFallbackUrl('')
    } catch {
      setShareLabel('复制失败，请复制地址')
      setShareFallbackUrl(shareUrlText)
    }
    if (shareResetTimer.current !== null) {
      window.clearTimeout(shareResetTimer.current)
    }
    shareResetTimer.current = window.setTimeout(() => setShareLabel('分享实验'), 2200)
  }

  return (
    <div className={`${styles.page} ${mobilePanel !== 'controls' ? styles.pageWorkspaceMode : ''}`}>
      <div className={styles.pageGlow} aria-hidden="true" />
      <div className={styles.labHeader} data-focus-background>
        <div className={styles.breadcrumbs}>
          <span>学习路径</span>
          <ChevronDown size={13} aria-hidden="true" />
          <strong>Runtime Core</strong>
          <ChevronDown size={13} aria-hidden="true" />
          <strong>Keys 与 Diff</strong>
        </div>
        <div className={styles.labHeaderMeta}>
          <span className={styles.modelBadge}><Sparkles size={13} aria-hidden="true" />教学模型</span>
          <span className={styles.versionBadge}>React 19.3</span>
        </div>
      </div>

      <div className={styles.titleRow} data-focus-background>
        <div>
          <span className={styles.pageEyebrow}>OBSERVATION 01 / IDENTITY</span>
          <h1>Keys 与 Diff</h1>
          <p>React 如何决定“这是同一个组件”，以及 state 为什么会在错误的 key 下错位。</p>
        </div>
        <div className={styles.keyboardHint}>
          <kbd>Space</kbd><span>播放</span>
          <kbd>←</kbd><kbd>→</kbd><span>单步</span>
          <kbd>F</kbd><span>全屏</span>
          <kbd>R</kbd><span>重置</span>
        </div>
      </div>

      <div className={styles.mobileTabs} role="tablist" aria-label="实验室面板" data-focus-background>
        {([
          ['controls', '输入'],
          ['stage', '动画'],
          ['inspector', '检查器'],
        ] as Array<[MobilePanel, string]>).map(([panel, label]) => (
          <button
            type="button"
            role="tab"
            id={`lab-tab-${panel}`}
            aria-controls={`lab-panel-${panel}`}
            aria-selected={mobilePanel === panel}
            className={mobilePanel === panel ? styles.mobileTabActive : ''}
            key={panel}
            onClick={() => setMobilePanel(panel)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={styles.labGrid}>
        <section
          id="lab-panel-controls"
          role="tabpanel"
          aria-labelledby="lab-tab-controls"
          className={`${styles.panelSlot} ${mobilePanel === 'controls' ? styles.mobilePanelVisible : styles.mobilePanelHidden}`}
          data-panel="controls"
          data-focus-background
        >
          <KeyLabControls
            scenario={scenario}
            unlocked={unlocked}
            prediction={prediction}
            predictionResult={predictionResult}
            previousSummary={previousSummary}
            trackedItem={trackedItem}
            answerOptions={answerOptions}
            onScenarioChange={handleScenarioChange}
            onPredictionChange={setPrediction}
            onSubmitPrediction={handleSubmitPrediction}
            onReset={handleReset}
          />
        </section>

        <section
          id="lab-panel-stage"
          role="tabpanel"
          aria-labelledby="lab-tab-stage"
          className={`${styles.panelSlot} ${mobilePanel === 'stage' ? styles.mobilePanelVisible : styles.mobilePanelHidden}`}
          data-panel="stage"
        >
          <div
            id="lab-stage-workspace"
            ref={stageWorkspaceRef}
            className={`${styles.stageWorkspace} ${isFocusMode ? styles.stageWorkspaceFocus : ''}`}
            role={isFocusMode ? 'dialog' : undefined}
            aria-modal={isFocusMode ? true : undefined}
            aria-label={isFocusMode ? '全屏演示区域' : undefined}
            aria-labelledby="stage-title"
            tabIndex={isFocusMode ? -1 : undefined}
            data-focus-mode={isFocusMode ? 'true' : undefined}
          >
            <LabStage
              snapshot={snapshot}
              previousSnapshot={previousSnapshot}
              stageRef={stageCardRef}
              selectedId={selectedId}
              isFocusMode={isFocusMode}
              focusButtonRef={focusButtonRef}
              onSelect={setSelectedId}
              onToggleFocusMode={handleToggleFocusMode}
            />
            <div className={styles.timelineDock}>
              <Timeline
                result={result}
                snapshot={snapshot}
                step={step}
                status={status}
                speed={speed}
                breakpoint={breakpoint}
                onStep={setStepInUrl}
                onTogglePlay={handleTogglePlay}
                onSpeedChange={setSpeed}
                onBreakpointChange={handleBreakpointChange}
                onShare={handleShare}
                shareLabel={shareLabel}
                isFocusMode={isFocusMode}
                onToggleFocusMode={handleToggleFocusMode}
              />
              {shareFallbackUrl && (
                <div className={styles.shareFallback} role="status">
                  <span>剪贴板不可用，手动复制这条链接：</span>
                  <code>{shareFallbackUrl}</code>
                </div>
              )}
            </div>
          </div>
        </section>

        <section
          id="lab-panel-inspector"
          role="tabpanel"
          aria-labelledby="lab-tab-inspector"
          className={`${styles.panelSlot} ${mobilePanel === 'inspector' ? styles.mobilePanelVisible : styles.mobilePanelHidden}`}
          data-panel="inspector"
          data-focus-background
        >
          <Inspector fiber={selectedFiber} result={result} snapshot={snapshot} unlocked={unlocked} />
          <div className={styles.truthCard}>
            <div className={styles.truthCardIcon}><Clipboard size={15} aria-hidden="true" /></div>
            <div>
              <strong>如何阅读这次观测</strong>
              <p>flags 和 alternate 是当前版本的实现观察，不是稳定公共 API。先记住身份，再记住字段。</p>
            </div>
          </div>
          {mobilePanel === 'inspector' && (
            <div className={styles.inspectorTimeline}>
              <Timeline
                result={result}
                snapshot={snapshot}
                step={step}
                status={status}
                speed={speed}
                breakpoint={breakpoint}
                onStep={setStepInUrl}
                onTogglePlay={handleTogglePlay}
                onSpeedChange={setSpeed}
                onBreakpointChange={handleBreakpointChange}
                onShare={handleShare}
                shareLabel={shareLabel}
                isFocusMode={isFocusMode}
                onToggleFocusMode={handleToggleFocusMode}
              />
              {shareFallbackUrl && (
                <div className={styles.shareFallback} role="status">
                  <span>剪贴板不可用，手动复制这条链接：</span>
                  <code>{shareFallbackUrl}</code>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      <footer className={styles.labFooter} data-focus-background>
        <span><span className={styles.footerDot} aria-hidden="true" />当前实验使用固定 seed = {scenario.seed}</span>
        <span>教学模型 · 可复现 · 无运行时代码注入</span>
      </footer>
    </div>
  )
}
