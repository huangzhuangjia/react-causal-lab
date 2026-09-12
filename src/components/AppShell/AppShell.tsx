import type { PropsWithChildren } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { BookOpen, FlaskConical, Github, Sparkles } from 'lucide-react'
import styles from './AppShell.module.scss'

type AppShellProps = PropsWithChildren

const navigation = [
  { to: '/', label: '首页', icon: Sparkles, end: true },
  { to: '/learn', label: '学习路径', icon: BookOpen },
  { to: '/lab/keys', label: '实验室', icon: FlaskConical },
]

export function AppShell({ children }: AppShellProps) {
  const location = useLocation()
  const isLab = location.pathname.startsWith('/lab')

  return (
    <div className={`${styles.app} ${isLab ? styles.labMode : ''}`}>
      <a className={styles.skipLink} href="#main-content" data-focus-background>
        跳到主要内容
      </a>
      <header className={styles.header} data-focus-background>
        <div className={styles.headerInner}>
          <NavLink className={styles.brand} to="/" aria-label="React 因果实验室首页">
            <span className={styles.brandMark} aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className={styles.brandCopy}>
              <strong>React 因果实验室</strong>
              <small>FIBER LAB</small>
            </span>
          </NavLink>

          <nav className={styles.desktopNav} aria-label="主导航">
            {navigation.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
              >
                <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className={styles.headerActions}>
            <span className={styles.versionBadge} aria-label="当前版本 React 19.3">
              <span className={styles.statusDot} aria-hidden="true" />
              React 19.3
            </span>
            <a
              className={styles.sourceLink}
              href="https://github.com/facebook/react"
              target="_blank"
              rel="noreferrer"
              aria-label="打开 React GitHub 源码（新窗口）"
            >
              <Github size={16} aria-hidden="true" />
              <span>源码</span>
            </a>
          </div>
        </div>
      </header>

      <main id="main-content" className={styles.main} tabIndex={-1}>
        {children}
      </main>

      <nav className={styles.mobileNav} aria-label="移动端主导航" data-focus-background>
        {navigation.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `${styles.mobileNavLink} ${isActive ? styles.mobileNavLinkActive : ''}`}
          >
            <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
