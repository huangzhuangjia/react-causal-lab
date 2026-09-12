import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react'
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Circle,
  Clock3,
  Code2,
  FlaskConical,
  GitBranch,
  LockKeyhole,
  PlayCircle,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
} from 'lucide-react'

import styles from './LearningPathPage.module.scss'

export interface LearningPathPageProps {
  /** Optional adapter for applications that use client-side routing. */
  onNavigate?: (path: string) => void
}

type TrackFilter = 'all' | 'runtime' | 'features'

interface Course {
  id: string
  track: 'runtime' | 'features'
  order: string
  title: string
  subtitle: string
  description: string
  difficulty: '入门' | '进阶' | '挑战'
  duration: string
  prerequisite: string
  version: string
  label: '心智模型' | '公开 API' | '实现观察'
  status: 'available' | 'preview'
  href?: string
  icon: ReactNode
}

const courses: Course[] = [
  {
    id: 'keys-diff',
    track: 'runtime',
    order: '01',
    title: 'Keys 与 Diff',
    subtitle: '身份如何保留 state',
    description: '把列表插入、删除、反转拆成一帧一帧的 Fiber 匹配，亲眼看见 state 为什么会“跑位”。',
    difficulty: '进阶',
    duration: '8 min',
    prerequisite: '会写 JSX、Hooks',
    version: 'React 19.3',
    label: '心智模型',
    status: 'available',
    href: '/lab/keys',
    icon: <GitBranch aria-hidden="true" size={20} strokeWidth={1.7} />,
  },
  {
    id: 'render-commit',
    track: 'runtime',
    order: '02',
    title: 'Render → Commit',
    subtitle: '更新怎样抵达 DOM',
    description: '追踪一次 setState 的完整生命周期，区分计算结果与真正发生的 DOM 变化。',
    difficulty: '进阶',
    duration: '10 min',
    prerequisite: 'Keys 与 Diff',
    version: 'React 19.3',
    label: '公开 API',
    status: 'preview',
    icon: <Target aria-hidden="true" size={20} strokeWidth={1.7} />,
  },
  {
    id: 'state-queue',
    track: 'runtime',
    order: '03',
    title: 'State Snapshot',
    subtitle: '队列里的每一次更新',
    description: '在值更新和 updater function 之间切换，理解批处理、快照与闭包的边界。',
    difficulty: '进阶',
    duration: '9 min',
    prerequisite: 'Render → Commit',
    version: 'React 19.3',
    label: '心智模型',
    status: 'preview',
    icon: <Code2 aria-hidden="true" size={20} strokeWidth={1.7} />,
  },
  {
    id: 'lanes',
    track: 'runtime',
    order: '04',
    title: 'Scheduler 与 Lanes',
    subtitle: '谁应该先被处理',
    description: '同时触发 urgent 与 transition 更新，观察调度器如何决定下一次工作。',
    difficulty: '挑战',
    duration: '12 min',
    prerequisite: 'State Snapshot',
    version: 'React 19.3',
    label: '实现观察',
    status: 'preview',
    icon: <FlaskConical aria-hidden="true" size={20} strokeWidth={1.7} />,
  },
  {
    id: 'actions',
    track: 'features',
    order: '01',
    title: 'Actions 与乐观更新',
    subtitle: '提交、等待与回滚',
    description: '用 useActionState 和 useOptimistic 拆开一个表单提交，看到 pending 与错误如何流动。',
    difficulty: '进阶',
    duration: '11 min',
    prerequisite: '会使用 Form Action',
    version: 'React 19.0',
    label: '公开 API',
    status: 'preview',
    icon: <Sparkles aria-hidden="true" size={20} strokeWidth={1.7} />,
  },
  {
    id: 'use-suspense',
    track: 'features',
    order: '02',
    title: 'use 与 Suspense',
    subtitle: 'Promise 挂起之后',
    description: '控制 Promise 的延迟、成功与失败，看 fallback、retry 和边界之间的因果关系。',
    difficulty: '挑战',
    duration: '13 min',
    prerequisite: 'Render → Commit',
    version: 'React 19.0',
    label: '公开 API',
    status: 'preview',
    icon: <Circle aria-hidden="true" size={20} strokeWidth={1.7} />,
  },
  {
    id: 'activity',
    track: 'features',
    order: '03',
    title: 'Activity',
    subtitle: '隐藏，但不丢失状态',
    description: '将一个视图切到 hidden，观察它如何保留状态、延后 Effect，并在恢复时继续工作。',
    difficulty: '挑战',
    duration: '10 min',
    prerequisite: 'State Snapshot',
    version: 'React 19.2',
    label: '公开 API',
    status: 'preview',
    icon: <BookOpen aria-hidden="true" size={20} strokeWidth={1.7} />,
  },
  {
    id: 'view-transition',
    track: 'features',
    order: '04',
    title: 'ViewTransition',
    subtitle: '让状态变化有连续感',
    description: '把 enter、exit、update 与共享元素动画放进时间线，理解动画发生在哪个阶段。',
    difficulty: '挑战',
    duration: '12 min',
    prerequisite: 'Activity',
    version: 'React 19.3',
    label: '实现观察',
    status: 'preview',
    icon: <Trophy aria-hidden="true" size={20} strokeWidth={1.7} />,
  },
]

const filterLabels: Array<{ id: TrackFilter; label: string; count: string }> = [
  { id: 'all', label: '全部实验', count: '08' },
  { id: 'runtime', label: 'Runtime Core', count: '04' },
  { id: 'features', label: 'React 19.x', count: '04' },
]

function navigate(
  onNavigate: LearningPathPageProps['onNavigate'],
  path: string,
  event: MouseEvent<HTMLAnchorElement>,
) {
  if (onNavigate) {
    event.preventDefault()
    onNavigate(path)
  }
}

function readProgress(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem('react-causal-lab:progress')
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.filter((value): value is string => typeof value === 'string')
    if (parsed && typeof parsed === 'object' && 'completed' in parsed) {
      const completed = (parsed as { completed?: unknown }).completed
      return Array.isArray(completed)
        ? completed.filter((value): value is string => typeof value === 'string')
        : []
    }
  } catch {
    // Corrupt local progress should never block the learning path.
  }
  return []
}

function writeProgress(progress: string[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem('react-causal-lab:progress', JSON.stringify({ completed: progress }))
  } catch {
    // Private browsing or disabled storage is a valid environment.
  }
}

/** Learning path overview with local-only progress persistence. */
export function LearningPathPage({ onNavigate }: LearningPathPageProps) {
  const [filter, setFilter] = useState<TrackFilter>('all')
  const [completed, setCompleted] = useState<string[]>([])

  useEffect(() => {
    setCompleted(readProgress())
  }, [])

  const visibleCourses = useMemo(
    () => (filter === 'all' ? courses : courses.filter((course) => course.track === filter)),
    [filter],
  )
  const completedCount = courses.filter((course) => completed.includes(course.id)).length
  const progressPercent = Math.round((completedCount / courses.length) * 100)
  const activeCourse = courses.find((course) => course.status === 'available') ?? courses[0]

  const toggleCompleted = (courseId: string) => {
    setCompleted((current) => {
      const next = current.includes(courseId)
        ? current.filter((id) => id !== courseId)
        : [...current, courseId]
      writeProgress(next)
      return next
    })
  }

  const resetProgress = () => {
    setCompleted([])
    writeProgress([])
  }

  return (
    <div className={styles.page}>
      <div className={styles.ambientGlow} aria-hidden="true" />
      <section className={styles.pathHero} aria-labelledby="path-title">
        <div className={styles.breadcrumb}>
          <a href="/" onClick={(event) => navigate(onNavigate, '/', event)}>首页</a>
          <ChevronRight aria-hidden="true" size={13} />
          <span>学习路径</span>
        </div>
        <div className={styles.pathHeroGrid}>
          <div>
            <span className={styles.sectionEyebrow}>CURRICULUM / 00</span>
            <h1 id="path-title">沿着因果链，<span>学会 React。</span></h1>
            <p>每个实验只回答一个关键问题。先建立运行时直觉，再把它带回真实项目。</p>
          </div>
          <div className={styles.progressCard} aria-label={`总课程进度 ${progressPercent}%`}>
            <div className={styles.progressCardTop}>
              <span className={styles.progressLabel}><Target aria-hidden="true" size={14} /> YOUR SIGNAL</span>
              <button type="button" className={styles.resetButton} onClick={resetProgress}>
                <RotateCcw aria-hidden="true" size={12} /> 重置
              </button>
            </div>
            <div className={styles.progressNumber}>{String(completedCount).padStart(2, '0')}<span> / {String(courses.length).padStart(2, '0')}</span></div>
            <div className={styles.progressBar}><span style={{ width: `${progressPercent}%` }} /></div>
            <div className={styles.progressCardBottom}><span>实验已完成</span><span>{progressPercent}%</span></div>
          </div>
        </div>
      </section>

      <section className={styles.nextSection} aria-labelledby="next-title">
        <div className={styles.nextMarker}><span className={styles.markerLine} /><span>NEXT SIGNAL</span></div>
        <div className={styles.nextCard}>
          <div className={styles.nextIcon}><PlayCircle aria-hidden="true" size={24} strokeWidth={1.6} /></div>
          <div className={styles.nextCopy}>
            <span className={styles.courseEyebrow}>RECOMMENDED FIRST</span>
            <h2 id="next-title">{activeCourse.title}<span> / {activeCourse.subtitle}</span></h2>
            <p>从最容易被误解的列表更新开始，8 分钟后你会知道 state 为什么会跑位。</p>
          </div>
          <a className={styles.nextAction} href={activeCourse.href ?? '/lab/keys'} onClick={(event) => navigate(onNavigate, activeCourse.href ?? '/lab/keys', event)}>
            {completed.includes(activeCourse.id) ? '再次观测' : '开始实验'} <ArrowRight aria-hidden="true" size={15} />
          </a>
        </div>
      </section>

      <section className={styles.curriculumSection} aria-labelledby="curriculum-title">
        <div className={styles.curriculumHeader}>
          <div>
            <span className={styles.sectionEyebrow}>THE CURRICULUM</span>
            <h2 id="curriculum-title">课程信号</h2>
          </div>
          <div className={styles.filterTabs} role="tablist" aria-label="课程分类">
            {filterLabels.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={filter === item.id}
                className={filter === item.id ? styles.filterActive : ''}
                onClick={() => setFilter(item.id)}
              >
                {item.label}<span>{item.count}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.courseList}>
          {visibleCourses.map((course) => {
            const isComplete = completed.includes(course.id)
            const isAvailable = course.status === 'available'
            return (
              <article className={`${styles.courseCard} ${isAvailable ? styles.courseAvailable : styles.coursePreview} ${isComplete ? styles.courseComplete : ''}`} key={course.id}>
                <div className={styles.courseOrder}>{course.order}</div>
                <div className={`${styles.courseIcon} ${course.track === 'runtime' ? styles.iconCyan : styles.iconViolet}`}>
                  {isAvailable ? course.icon : <LockKeyhole aria-hidden="true" size={18} strokeWidth={1.8} />}
                </div>
                <div className={styles.courseBody}>
                  <div className={styles.courseTitleLine}>
                    <div>
                      <span className={styles.courseEyebrow}>{course.track === 'runtime' ? 'RUNTIME CORE' : 'REACT 19.X'}</span>
                      <h3>{course.title}<span> / {course.subtitle}</span></h3>
                    </div>
                    <span className={`${styles.truthTag} ${styles[`truth${course.label.replace('心智模型', 'Model').replace('公开 API', 'Public').replace('实现观察', 'Observe')}`]}`}>
                      {course.label}
                    </span>
                  </div>
                  <p className={styles.courseDescription}>{course.description}</p>
                  <div className={styles.courseMeta}>
                    <span><Clock3 aria-hidden="true" size={13} /> {course.duration}</span>
                    <span><BookOpen aria-hidden="true" size={13} /> 前置：{course.prerequisite}</span>
                    <span><Code2 aria-hidden="true" size={13} /> {course.version}</span>
                    <span className={styles.difficulty}>{course.difficulty}</span>
                  </div>
                </div>
                <div className={styles.courseAction}>
                  {isAvailable ? (
                    <>
                      <a className={styles.courseLink} href={course.href ?? '/lab/keys'} onClick={(event) => navigate(onNavigate, course.href ?? '/lab/keys', event)}>
                        {isComplete ? '再次进入' : '进入实验'} <ArrowRight aria-hidden="true" size={15} />
                      </a>
                      <button type="button" className={`${styles.completeButton} ${isComplete ? styles.completeActive : ''}`} onClick={() => toggleCompleted(course.id)}>
                        {isComplete ? <Check aria-hidden="true" size={13} /> : <Circle aria-hidden="true" size={13} />}
                        {isComplete ? '已完成' : '标记完成'}
                      </button>
                    </>
                  ) : (
                    <span className={styles.previewLabel}>即将开放</span>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className={styles.methodSection} aria-labelledby="method-title">
        <div className={styles.methodIcon}><Sparkles aria-hidden="true" size={20} strokeWidth={1.7} /></div>
        <div>
          <span className={styles.sectionEyebrow}>HOW TO USE THIS PATH</span>
          <h2 id="method-title">预测 → 播放 → <span>验证</span></h2>
          <p>每次实验都会在开始前收集你的预测。不要急着点击播放——先下注，直觉才会留下痕迹。</p>
        </div>
        <div className={styles.methodSteps} aria-label="学习步骤">
          <span><b>01</b> 预测</span>
          <span><b>02</b> 单步</span>
          <span><b>03</b> 对比</span>
        </div>
      </section>

      <footer className={styles.footer}>
        <span>© 2026 React 因果实验室</span>
        <span className={styles.footerRuntime}><Code2 aria-hidden="true" size={14} /> built for curious minds</span>
        <a href="/lab/keys" onClick={(event) => navigate(onNavigate, '/lab/keys', event)}>进入实验室</a>
      </footer>
    </div>
  )
}

export default LearningPathPage
