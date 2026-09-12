import { useMemo, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import {
  ArrowRight,
  Check,
  ChevronRight,
  CircleDot,
  Code2,
  Eye,
  GitBranch,
  Layers3,
  Play,
  Sparkles,
  Terminal,
  Zap,
} from 'lucide-react'

import styles from './LandingPage.module.scss'

export interface LandingPageProps {
  /** Optional adapter for applications that use client-side routing. */
  onNavigate?: (path: string) => void
}

type PreviewStrategy = 'id' | 'index'

interface PreviewRow {
  id: string
  label: string
  state: number
  status: 'new' | 'reused' | 'moved'
  note?: string
}

const previewRows: Record<PreviewStrategy, PreviewRow[]> = {
  id: [
    { id: 'x', label: 'X', state: 0, status: 'new', note: 'mount' },
    { id: 'a', label: 'A', state: 0, status: 'reused', note: 'reuse' },
    { id: 'b', label: 'B', state: 3, status: 'reused', note: 'state stays' },
    { id: 'c', label: 'C', state: 0, status: 'reused', note: 'reuse' },
  ],
  index: [
    { id: 'x', label: 'X', state: 0, status: 'new', note: 'mount' },
    { id: 'a', label: 'A', state: 3, status: 'moved', note: 'state leaks' },
    { id: 'b', label: 'B', state: 0, status: 'moved', note: 'state shifts' },
    { id: 'c', label: 'C', state: 0, status: 'reused', note: 'reuse' },
  ],
}

const mechanismCards: Array<{
  id: string
  step: string
  title: string
  body: string
  accent: string
  icon: ReactNode
}> = [
  {
    id: 'trigger',
    step: '01',
    title: 'Trigger',
    body: '一次点击、一条网络响应，或一个 setState，让更新进入队列。',
    accent: 'cyan',
    icon: <Zap aria-hidden="true" size={20} strokeWidth={1.8} />,
  },
  {
    id: 'render',
    step: '02',
    title: 'Render',
    body: 'React 计算下一棵树，沿着 Fiber 找到真正需要改变的节点。',
    accent: 'violet',
    icon: <GitBranch aria-hidden="true" size={20} strokeWidth={1.8} />,
  },
  {
    id: 'commit',
    step: '03',
    title: 'Commit',
    body: '只有确认过的结果才会落到 DOM，浏览器随后负责绘制。',
    accent: 'gold',
    icon: <Eye aria-hidden="true" size={20} strokeWidth={1.8} />,
  },
]

const learningTracks = [
  {
    id: 'runtime',
    eyebrow: 'RUNTIME CORE',
    title: '追踪一次更新',
    description: '从状态快照到 Commit，建立能够预测 React 行为的底层心智模型。',
    lessons: '6 个实验',
    progress: 17,
    color: 'cyan',
    icon: <Layers3 aria-hidden="true" size={18} strokeWidth={1.8} />,
  },
  {
    id: 'features',
    eyebrow: 'REACT 19.X',
    title: '新能力的运行时',
    description: '用可交互的时间线理解 Actions、use、Activity 与 ViewTransition。',
    lessons: '5 个实验',
    progress: 0,
    color: 'violet',
    icon: <Sparkles aria-hidden="true" size={18} strokeWidth={1.8} />,
  },
]

function navigate(
  onNavigate: LandingPageProps['onNavigate'],
  path: string,
  event: MouseEvent<HTMLAnchorElement>,
) {
  if (onNavigate) {
    event.preventDefault()
    onNavigate(path)
  }
}

/** Landing page for the React Causal Lab learning experience. */
export function LandingPage({ onNavigate }: LandingPageProps) {
  const [strategy, setStrategy] = useState<PreviewStrategy>('id')
  const rows = useMemo(() => previewRows[strategy], [strategy])

  return (
    <div className={styles.page}>
      <div className={styles.ambientGlow} aria-hidden="true" />
      <section className={styles.hero} aria-labelledby="landing-title">
        <div className={styles.heroCopy}>
          <div className={styles.kicker}>
            <span className={styles.kickerLine} aria-hidden="true" />
            INTERACTIVE REACT RUNTIME
          </div>
          <h1 id="landing-title">
            看见 React
            <br />
            <span>看不见的运行过程</span>
          </h1>
          <p className={styles.heroLead}>
            把一次 <code>setState</code> 拆成可暂停、可检查的因果链。像调试器一样学习，
            在每个 Fiber 节点上找到“为什么”。
          </p>
          <div className={styles.heroActions}>
            <a
              className={`${styles.button} ${styles.buttonPrimary}`}
              href="/lab/keys"
              onClick={(event) => navigate(onNavigate, '/lab/keys', event)}
            >
              <Play aria-hidden="true" size={16} fill="currentColor" />
              开始第一次 Fiber 观测
            </a>
            <a
              className={`${styles.button} ${styles.buttonGhost}`}
              href="/learn"
              onClick={(event) => navigate(onNavigate, '/learn', event)}
            >
              查看学习路径 <ChevronRight aria-hidden="true" size={16} />
            </a>
          </div>
          <div className={styles.heroFootnote}>
            <CircleDot aria-hidden="true" size={13} />
            <span>无需登录 · 约 8 分钟完成首个实验</span>
          </div>
        </div>

        <div className={styles.heroPreview} aria-label="Keys 与 Diff 实验预览">
          <div className={styles.previewHeader}>
            <div>
              <span className={styles.previewEyebrow}>LIVE OBSERVATION / 01</span>
              <h2>状态会跟着谁？</h2>
            </div>
            <span className={styles.previewSignal}>
              <span className={styles.signalPulse} aria-hidden="true" />
              SIMULATED
            </span>
          </div>
          <p className={styles.previewDescription}>
            在列表头部插入 <code>X</code>，观察 B 的 state 如何寻找自己的位置。
          </p>
          <div className={styles.previewControls} role="group" aria-label="预览 key 策略">
            <span className={styles.controlLabel}>KEY STRATEGY</span>
            <div className={styles.segmentedControl}>
              <button
                type="button"
                className={strategy === 'id' ? styles.segmentActive : ''}
                aria-pressed={strategy === 'id'}
                onClick={() => setStrategy('id')}
              >
                <code>item.id</code>
              </button>
              <button
                type="button"
                className={strategy === 'index' ? styles.segmentActive : ''}
                aria-pressed={strategy === 'index'}
                onClick={() => setStrategy('index')}
              >
                <code>index</code>
              </button>
            </div>
          </div>
          <div className={styles.previewBoard}>
            <div className={styles.boardTopline}>
              <span>WIP TREE</span>
              <span className={styles.boardEvent}>
                <ArrowRight aria-hidden="true" size={13} /> PREPEND X
              </span>
            </div>
            <div className={styles.fiberRows}>
              {rows.map((row, index) => (
                <div
                  className={`${styles.fiberRow} ${row.status === 'moved' ? styles.rowMoved : ''} ${
                    row.status === 'new' ? styles.rowNew : ''
                  }`}
                  key={`${strategy}-${row.id}`}
                  style={{ '--row-index': index } as CSSProperties}
                >
                  <span className={styles.rowIndex}>{String(index).padStart(2, '0')}</span>
                  <span className={styles.nodeGlyph} aria-hidden="true">
                    <span />
                  </span>
                  <span className={styles.rowLabel}>{row.label}</span>
                  <span className={styles.rowKey}>
                    key={strategy === 'id' ? `'${row.id}'` : index}
                  </span>
                  <span className={styles.rowState}>state: {row.state}</span>
                  <span className={styles.rowNote}>{row.note}</span>
                </div>
              ))}
            </div>
            <div className={styles.previewConclusion}>
              <span className={strategy === 'id' ? styles.conclusionGood : styles.conclusionWarn}>
                {strategy === 'id' ? <Check aria-hidden="true" size={13} /> : <Zap aria-hidden="true" size={13} />}
                {strategy === 'id' ? 'B 保留 state = 3' : 'state = 3 跑到了 A'}
              </span>
              <span className={styles.stepCounter}>STEP 04 / 06</span>
            </div>
          </div>
          <div className={styles.previewTimeline} aria-hidden="true">
            <span className={styles.timelineActive} />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className={styles.previewLegend}>
            <span><i className={styles.legendDotCyan} />reused</span>
            <span><i className={styles.legendDotGold} />mounted</span>
            <span><i className={styles.legendDotViolet} />state transfer</span>
          </div>
        </div>
      </section>

      <section className={styles.mechanismSection} aria-labelledby="mechanism-title">
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.sectionEyebrow}>THE MENTAL MODEL</span>
            <h2 id="mechanism-title">从事件到像素，<span>一步不跳过</span></h2>
          </div>
          <p>每个实验都遵循同一条可复现的路径。先预测，再播放，最后用证据验证。</p>
        </div>
        <div className={styles.mechanismGrid}>
          {mechanismCards.map((card, index) => (
            <article className={`${styles.mechanismCard} ${styles[`accent${card.accent}`]}`} key={card.id}>
              <div className={styles.mechanismTopline}>
                <span className={styles.mechanismStep}>{card.step}</span>
                <span className={styles.mechanismIcon}>{card.icon}</span>
              </div>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
              {index < mechanismCards.length - 1 && (
                <ArrowRight className={styles.mechanismArrow} aria-hidden="true" size={18} />
              )}
            </article>
          ))}
        </div>
      </section>

      <section className={styles.tracksSection} aria-labelledby="tracks-title">
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.sectionEyebrow}>LEARNING TRACKS</span>
            <h2 id="tracks-title">选择你的<span>观测路线</span></h2>
          </div>
          <a
            className={styles.textLink}
            href="/learn"
            onClick={(event) => navigate(onNavigate, '/learn', event)}
          >
            查看全部课程 <ArrowRight aria-hidden="true" size={15} />
          </a>
        </div>
        <div className={styles.trackGrid}>
          {learningTracks.map((track) => (
            <a
              className={`${styles.trackCard} ${styles[`track${track.color}`]}`}
              href="/learn"
              key={track.id}
              onClick={(event) => navigate(onNavigate, '/learn', event)}
            >
              <div className={styles.trackIcon}>{track.icon}</div>
              <div className={styles.trackContent}>
                <span className={styles.trackEyebrow}>{track.eyebrow}</span>
                <h3>{track.title}</h3>
                <p>{track.description}</p>
                <div className={styles.trackMeta}>
                  <span>{track.lessons}</span>
                  <span>{track.progress ? `已完成 ${track.progress}%` : '尚未开始'}</span>
                </div>
                <div className={styles.progressRail} aria-label={`课程进度 ${track.progress}%`}>
                  <span style={{ width: `${track.progress}%` }} />
                </div>
              </div>
              <ArrowRight className={styles.trackArrow} aria-hidden="true" size={18} />
            </a>
          ))}
        </div>
      </section>

      <section className={styles.accuracySection} aria-labelledby="accuracy-title">
        <div className={styles.accuracyIcon} aria-hidden="true">
          <Terminal size={21} strokeWidth={1.7} />
        </div>
        <div className={styles.accuracyCopy}>
          <span className={styles.sectionEyebrow}>TRUST THE MODEL</span>
          <h2 id="accuracy-title">每一步都标注它的<span>真实边界</span></h2>
          <p>教学模型帮助你建立直觉；它不会冒充 React 的私有实现。版本变化时，知识依然可靠。</p>
        </div>
        <div className={styles.accuracyTags}>
          <span><i className={styles.tagPublic} />公开 API</span>
          <span><i className={styles.tagModel} />心智模型</span>
          <span><i className={styles.tagObserve} />实现观察</span>
        </div>
      </section>

      <section className={styles.finalCta} aria-labelledby="cta-title">
        <div>
          <span className={styles.sectionEyebrow}>READY TO TRACE?</span>
          <h2 id="cta-title">让下一次渲染，<span>不再神秘。</span></h2>
        </div>
        <a
          className={`${styles.button} ${styles.buttonPrimary}`}
          href="/lab/keys"
          onClick={(event) => navigate(onNavigate, '/lab/keys', event)}
        >
          进入 Keys 实验室 <ArrowRight aria-hidden="true" size={16} />
        </a>
      </section>

      <footer className={styles.footer}>
        <span>© 2026 React 因果实验室</span>
        <span className={styles.footerRuntime}><Code2 aria-hidden="true" size={14} /> built for curious minds</span>
        <a href="/learn" onClick={(event) => navigate(onNavigate, '/learn', event)}>学习路径</a>
      </footer>
    </div>
  )
}

export default LandingPage
