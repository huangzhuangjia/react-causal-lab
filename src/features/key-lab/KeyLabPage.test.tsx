import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { KeyLabPage } from './KeyLabPage'

function renderLab(entry = '/lab/keys') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <KeyLabPage />
    </MemoryRouter>,
  )
}

async function unlockWithCorrectPrediction() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('radio', { name: 'B 这一行' }))
  await user.click(screen.getByRole('button', { name: '锁定预测' }))
  return user
}

describe('KeyLabPage', () => {
  it('gates playback behind the prediction question', async () => {
    renderLab()

    expect(screen.getByRole('button', { name: '播放实验' })).toBeDisabled()
    await unlockWithCorrectPrediction()
    expect(screen.getByRole('button', { name: '播放实验' })).toBeEnabled()
    expect(document.getElementById('lab-tab-stage')).toHaveAttribute('aria-selected', 'true')
  })

  it('supports stepping and selecting a Fiber for the inspector', async () => {
    renderLab()
    const user = await unlockWithCorrectPrediction()
    await user.click(screen.getByRole('button', { name: '下一步' }))
    expect(screen.getByRole('slider')).toHaveValue('1')

    await user.click(screen.getByRole('button', { name: /01 A Row/ }))
    fireEvent.click(document.getElementById('lab-tab-inspector') as HTMLElement)
    expect(screen.getByRole('heading', { name: 'A · Row' })).toBeInTheDocument()
    expect(screen.getByText('alternate')).toBeInTheDocument()
  })

  it('resets to prediction and keeps a previous-run summary when the scenario changes', async () => {
    renderLab()
    const user = await unlockWithCorrectPrediction()
    fireEvent.click(document.getElementById('lab-tab-controls') as HTMLElement)
    await user.click(screen.getByRole('button', { name: /index 数组位置/ }))

    expect(screen.getByRole('button', { name: '锁定预测' })).toBeDisabled()
    expect(screen.getByRole('complementary', { name: '上一轮实验结果' })).toBeInTheDocument()
  })

  it('restores a deep-linked step without showing a false prediction result', () => {
    renderLab('/lab/keys?key=index&op=prepend&target=X&step=4&seed=42')

    expect(screen.getByRole('slider')).toHaveValue('4')
    expect(screen.getByRole('button', { name: '播放实验' })).toBeEnabled()
    expect(screen.getByText('已从分享链接恢复实验，可直接继续观测。')).toBeInTheDocument()
  })

  it('keeps a positional offset for reordered rows at commit', () => {
    renderLab('/lab/keys?key=id&op=reverse&step=5')

    const offsetRows = Array.from(document.querySelectorAll('[data-stage-tree] [data-entry-offset-y]'))
    expect(offsetRows.some((row) => Number(row.getAttribute('data-entry-offset-y')) !== 0)).toBe(true)
  })

  it('keeps the playback timeline in the animation workspace', () => {
    renderLab('/lab/keys?step=1')

    const stagePanel = document.querySelector('[data-panel="stage"]')
    expect(stagePanel).not.toBeNull()
    expect(stagePanel?.querySelector('[aria-label="实验时间线"]')).toBeInTheDocument()
    expect(document.querySelector(':scope > [aria-label="实验时间线"]')).toBeNull()

    fireEvent.click(document.getElementById('lab-tab-inspector') as HTMLElement)
    expect(screen.getByRole('slider', { name: /当前步骤/ })).toBeInTheDocument()
  })

  it('updates the stage phase marker as the timeline advances', async () => {
    renderLab('/lab/keys?step=1')
    const user = userEvent.setup()
    expect(document.querySelector('[data-stage-tree]')).toHaveAttribute('data-phase', 'render')

    await user.click(screen.getByRole('button', { name: '下一步' }))
    await waitFor(() => {
      expect(document.querySelector('[data-stage-tree]')).toHaveAttribute('data-phase', 'reconcile')
    })
  })

  it('keeps reused rows and event surfaces mounted while stepping', async () => {
    renderLab('/lab/keys?step=1')
    const user = userEvent.setup()
    const currentRow = document.querySelector('[data-stage-tree] .fiberList .fiberRow')
    const eventBanner = document.querySelector('[aria-live="polite"]')
    const phaseBadge = document.querySelector('[class*="phaseBadge"]')

    await user.click(screen.getByRole('button', { name: '下一步' }))

    expect(document.querySelector('[data-stage-tree] .fiberList .fiberRow')).toBe(currentRow)
    expect(document.querySelector('[aria-live="polite"]')).toBe(eventBanner)
    expect(document.querySelector('[class*="phaseBadge"]')).toBe(phaseBadge)
  })

  it('responds to keyboard single-step shortcuts', async () => {
    renderLab()
    await unlockWithCorrectPrediction()

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    await waitFor(() => expect(screen.getByRole('slider')).toHaveValue('1'))
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    await waitFor(() => expect(screen.getByRole('slider')).toHaveValue('0'))
  })

  it('enters and exits stage focus mode from the button while restoring body overflow', async () => {
    document.body.style.overflow = ''
    renderLab()
    const user = await unlockWithCorrectPrediction()

    const enterButton = screen.getByRole('button', { name: '进入全屏演示' })
    expect(enterButton).toHaveAttribute('aria-pressed', 'false')

    await user.click(enterButton)
    expect(screen.getByRole('button', { name: '退出全屏演示' })).toHaveAttribute('aria-pressed', 'true')
    expect(document.body.style.overflow).toBe('hidden')

    await user.click(screen.getByRole('button', { name: '退出全屏演示' }))
    expect(screen.getByRole('button', { name: '进入全屏演示' })).toHaveAttribute('aria-pressed', 'false')
    expect(document.body.style.overflow).toBe('')
  })

  it('exits stage focus mode with Escape and restores body overflow', async () => {
    document.body.style.overflow = ''
    renderLab()
    const user = await unlockWithCorrectPrediction()
    await user.click(screen.getByRole('button', { name: '进入全屏演示' }))

    expect(document.body.style.overflow).toBe('hidden')
    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.getByRole('button', { name: '进入全屏演示' })).toHaveAttribute('aria-pressed', 'false'))
    expect(document.body.style.overflow).toBe('')
  })

  it('enters and exits stage focus mode with the F shortcut', async () => {
    renderLab()
    const user = await unlockWithCorrectPrediction()

    await user.keyboard('f')
    await waitFor(() => expect(screen.getByRole('button', { name: '退出全屏演示' })).toHaveAttribute('aria-pressed', 'true'))

    await user.keyboard('F')
    await waitFor(() => expect(screen.getByRole('button', { name: '进入全屏演示' })).toHaveAttribute('aria-pressed', 'false'))
  })

  it('restores body overflow when unmounted in stage focus mode', async () => {
    document.body.style.overflow = ''
    const view = renderLab()
    const user = await unlockWithCorrectPrediction()
    await user.click(screen.getByRole('button', { name: '进入全屏演示' }))

    expect(document.body.style.overflow).toBe('hidden')
    view.unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('shows a manual URL when clipboard access is unavailable', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    renderLab()
    const user = await unlockWithCorrectPrediction()
    // userEvent.setup() installs its own clipboard shim; replace it after
    // creating the user instance so this test exercises the unavailable path.
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    await user.click(screen.getByRole('button', { name: '分享实验' }))

    expect(await screen.findByText('剪贴板不可用，手动复制这条链接：')).toBeInTheDocument()
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('?key=id&op=prepend'))
  })
})
