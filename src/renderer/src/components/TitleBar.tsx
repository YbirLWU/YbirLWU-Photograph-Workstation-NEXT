import { useEffect, useState } from 'react'
import { FolderTree, HardDrive, Minus, Usb, X } from 'lucide-react'
import type { DriveInfo } from '@shared/types'
import { api, isDesktop } from '@/lib/bridge'
import { shortenPath } from '@/lib/format'
import { APP_NAME, APP_VERSION_LABEL, BUILD_CHANNEL_LABEL, BUILD_DATE } from '@shared/version'
import { Logo } from './Logo'

export function TitleBar({
  demo,
  drive,
  root,
  stage
}: {
  demo: string | null
  drive: DriveInfo | null
  root: string
  stage: string
}) {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => api.window.onState((state) => setMaximized(state.maximized)), [])

  return (
    <header className="titlebar">
      <div className="titlebar__brand">
        <span className="brandmark">
          <Logo size={18} />
        </span>
        <span className="titlebar__text">
          <span className="titlebar__name">{APP_NAME}</span>
          <span className="titlebar__sub" title={`构建编码 · ${BUILD_CHANNEL_LABEL} · 构建日期 ${BUILD_DATE}`}>
            {APP_VERSION_LABEL}
          </span>
        </span>
      </div>

      <div className="titlebar__stage" title="当前所在步骤">
        {stage}
      </div>

      <div className="titlebar__crumb" title={root || '尚未打开工作区'}>
        <FolderTree size={12} strokeWidth={1.9} />
        <span>{root ? shortenPath(root, 3) : '尚未打开工作区'}</span>
      </div>

      <div className="titlebar__right">
        {drive && (
          <span className={`titlebar__drive${drive.external ? ' is-external' : ''}`} title={drive.model}>
            {drive.external ? <Usb size={11} strokeWidth={2.2} /> : <HardDrive size={11} strokeWidth={2.2} />}
            {drive.root}
            {drive.external ? ' 外置设备' : ' 本地磁盘'}
          </span>
        )}
        {demo && <span className="titlebar__badge">演示界面 · 示例数据</span>}

        {isDesktop && (
          <div className="titlebar__controls">
            <button className="wbtn" onClick={() => api.window.minimize()} aria-label="最小化" title="最小化">
              <Minus size={14} strokeWidth={2} />
            </button>
            <button
              className="wbtn"
              onClick={() => api.window.toggleMaximize()}
              aria-label={maximized ? '还原窗口' : '最大化窗口'}
              title={maximized ? '还原窗口' : '最大化窗口'}
            >
              {maximized ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                  <rect x="1.4" y="3.4" width="7.2" height="7.2" rx="1.2" stroke="currentColor" strokeWidth="1.1" />
                  <path
                    d="M3.6 3.2V2.6A1.2 1.2 0 0 1 4.8 1.4h4.6A1.2 1.2 0 0 1 10.6 2.6v4.6A1.2 1.2 0 0 1 9.4 8.4h-.6"
                    stroke="currentColor"
                    strokeWidth="1.1"
                  />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                  <rect x="1.6" y="1.6" width="8.8" height="8.8" rx="1.3" stroke="currentColor" strokeWidth="1.1" />
                </svg>
              )}
            </button>
            <button className="wbtn wbtn--close" onClick={() => api.window.close()} aria-label="关闭窗口" title="关闭窗口">
              <X size={15} strokeWidth={2} />
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
