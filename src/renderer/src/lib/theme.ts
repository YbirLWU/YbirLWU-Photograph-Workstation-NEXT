import type { SettingsState, ThemeName } from '@shared/types'
import { mediaUrl } from './bridge'

export const THEMES: Array<{ value: ThemeName; label: string; hint: string; swatch: [string, string, string] }> = [
  { value: 'dark', label: '专业深色', hint: '中性灰 + 蓝主色，长时间看图不刺眼', swatch: ['#0f1115', '#171a21', '#4c8dff'] },
  { value: 'graphite', label: '石墨灰', hint: '更暖的深灰，主色偏琥珀', swatch: ['#14130f', '#1e1c17', '#e0a44a'] },
  { value: 'light', label: '明亮浅色', hint: '白天 / 投屏使用，对比清晰', swatch: ['#eef1f5', '#ffffff', '#2f6df0'] },
  { value: 'nord', label: '冷调蓝灰', hint: '低饱和蓝灰，接近修图软件的暗房观感', swatch: ['#151b23', '#1d2530', '#6fb3d2'] },
  { value: 'ember', label: '炉火暖棕', hint: '暖棕色暗房氛围，主色为炉火橙', swatch: ['#1a1512', '#261f1a', '#e08a3c'] },
  { value: 'violet', label: '紫罗兰夜', hint: '深紫夜色，主色为紫罗兰', swatch: ['#14121e', '#1e1a2b', '#9a7ff0'] }
]

export function applySettings(state: SettingsState | null): void {
  const root = document.documentElement
  const settings = state?.settings
  root.dataset.theme = settings?.theme ?? 'dark'

  const hasBackground = Boolean(state?.backgroundPath)
  root.classList.toggle('has-bg', hasBackground)
  if (hasBackground && state?.backgroundPath) {
    root.style.setProperty('--app-bg-image', `url("${mediaUrl(state.backgroundPath)}")`)
    root.style.setProperty('--app-bg-opacity', String((settings?.backgroundOpacity ?? 28) / 100))
    root.style.setProperty('--app-bg-blur', `${settings?.backgroundBlur ?? 6}px`)
  } else {
    root.style.removeProperty('--app-bg-image')
    root.style.setProperty('--app-bg-opacity', '0')
  }
}

export function readLocalTheme(): ThemeName {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('theme')
    if (
      fromUrl === 'light' ||
      fromUrl === 'graphite' ||
      fromUrl === 'nord' ||
      fromUrl === 'ember' ||
      fromUrl === 'violet' ||
      fromUrl === 'dark'
    )
      return fromUrl
  } catch {
  }
  try {
    const value = window.localStorage.getItem('ybirlwu.theme')
    if (
      value === 'light' ||
      value === 'graphite' ||
      value === 'nord' ||
      value === 'ember' ||
      value === 'violet' ||
      value === 'dark'
    )
      return value
  } catch {
  }
  return 'dark'
}
