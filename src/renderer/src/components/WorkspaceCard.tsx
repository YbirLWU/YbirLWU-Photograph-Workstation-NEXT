import { useMemo, useState } from 'react'
import { FolderOpen, FolderPlus, HardDrive, RefreshCw, Trash2, Usb } from 'lucide-react'
import { api, errorText } from '@/lib/bridge'
import { formatBytes, shortenPath } from '@/lib/format'
import { Modal } from '@/components/ui'
import type { Workspace } from '@shared/types'
import type { SharedState } from '@/modules/types'

type Counts = Workspace['counts']

const DIRECTORIES = [
  { key: 'raw', label: '原片', hint: 'RAW 原片：工作区根目录下的 RAW 文件夹', pick: (c?: Counts) => c?.raw ?? 0 },
  { key: 'jpg', label: '预览', hint: 'JPG 预览：工作区根目录下的 JPG 文件夹', pick: (c?: Counts) => c?.jpg ?? 0 },
  { key: 'cho', label: '入选', hint: '入选照片：处理区下的 CHO 文件夹', pick: (c?: Counts) => (c?.choRaw ?? 0) + (c?.choJpg ?? 0) },
  { key: 'edp', label: '精修', hint: '精修成片：处理区下的 EDP 文件夹', pick: (c?: Counts) => c?.edp ?? 0 },
  { key: 'end', label: '成品', hint: '最终成品：处理区下的 END 文件夹', pick: (c?: Counts) => c?.end ?? 0 }
] as const

export function WorkspaceCard({ shared }: { shared: SharedState }) {
  const { root, workspace } = shared
  const [busy, setBusy] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  const counts = workspace?.counts
  const drive = workspace?.drive
  const shortPath = useMemo(() => (root ? shortenPath(root, 2) : ''), [root])

  const pick = async (allowCreate: boolean): Promise<void> => {
    setBusy(true)
    try {
      const picked = await api.pickFolder({
        title: allowCreate ? '新建或选择图片工作区' : '选择图片工作区',
        defaultPath: root || undefined,
        allowCreate
      })
      if (!picked) return
      await shared.openRoot(picked)
    } catch (error) {
      shared.toast(errorText(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  const reset = async (): Promise<void> => {
    if (!root) return
    setBusy(true)
    try {
      const result = await api.workspace.resetImgt(root)
      await shared.refresh(root)
      shared.toast(`处理区已清空（删除 ${result.removed} 项），可以开始新一轮`, 'success')
      setConfirmReset(false)
    } catch (error) {
      shared.toast(errorText(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  const copyPath = (): void => {
    if (!root) return
    api.clipboard
      .write(root)
      .then(() => shared.toast('已复制工作区完整路径', 'success'))
      .catch((error) => shared.toast(errorText(error), 'error'))
  }

  if (!root) {
    return (
      <div className="project project--empty">
        <div className="project__label">未打开工作区</div>
        <p className="project__hint">
          选择和创建工作区，程序将在其中建立「RAW 原片」「JPG 预览」「处理区」三个目录
        </p>
        <div className="project__actions">
          <button className="btn btn--primary btn--sm" type="button" onClick={() => void pick(true)} disabled={busy}>
            <FolderPlus size={13} strokeWidth={2} />
            新建工作区
          </button>
          <button className="btn btn--ghost btn--sm" type="button" onClick={() => void pick(false)} disabled={busy}>
            选择已有
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="project">
      <div className="project__head">
        <span className="project__label">当前工作区</span>
        <span className="project__tools">
          <button className="project__icon" type="button" title="更换工作区" onClick={() => void pick(false)}>
            <FolderOpen size={12} strokeWidth={2} />
          </button>
          <button
            className="project__icon"
            type="button"
            title="刷新目录统计"
            onClick={() => void shared.refresh()}
            disabled={busy}
          >
            <RefreshCw size={12} strokeWidth={2} className={busy ? 'spin' : undefined} />
          </button>
          <button className="project__icon" type="button" title="清空处理区" onClick={() => setConfirmReset(true)}>
            <Trash2 size={12} strokeWidth={2} />
          </button>
        </span>
      </div>

      <button className="project__path" type="button" title={`${root}\n点击复制完整路径`} onClick={copyPath}>
        {shortPath}
      </button>

      <div className="project__counts">
        {DIRECTORIES.map((dir) => (
          <div
            className={`project__count${dir.key === 'raw' ? ' project__count--wide' : ''}`}
            key={dir.key}
            title={dir.hint}
          >
            <b>{dir.pick(counts)}</b>
            <span>{dir.label}</span>
          </div>
        ))}
      </div>

      {drive && (
        <div className={`drivechip${drive.external ? ' drivechip--ext' : ''}`} title={drive.model || drive.root}>
          {drive.external ? <Usb size={11} strokeWidth={2} /> : <HardDrive size={11} strokeWidth={2} />}
          <span>{drive.external ? '外置设备' : '本地磁盘'}</span>
          <span className="drivechip__sep">·</span>
          <span>{drive.root || '?'}</span>
          {drive.free > 0 && (
            <>
              <span className="drivechip__sep">·</span>
              <span>剩余 {formatBytes(drive.free)}</span>
            </>
          )}
        </div>
      )}

      <div className="project__actions">
        <button className="btn btn--sm btn--ghost" type="button" onClick={() => void pick(false)} disabled={busy}>
          更换
        </button>
        <button className="btn btn--sm btn--ghost" type="button" onClick={shared.closeWorkspace}>
          关闭
        </button>
      </div>

      <Modal
        open={confirmReset}
        title="清空处理区"
        desc="「入选照片」「精修成片」「最终成品」里的文件会被删除，RAW 原片与 JPG 预览不受影响。此操作无法撤销。"
        width={440}
        onClose={() => setConfirmReset(false)}
        footer={
          <>
            <button className="btn btn--sm" type="button" onClick={() => setConfirmReset(false)}>
              取消
            </button>
            <button className="btn btn--sm btn--danger" type="button" onClick={() => void reset()} disabled={busy}>
              <Trash2 size={12} strokeWidth={2} />
              确认清空
            </button>
          </>
        }
      >
        <div className="kv">
          <span>入选照片</span>
          <b>
            {counts?.choRaw ?? 0} 张原片 · {counts?.choJpg ?? 0} 张预览
          </b>
        </div>
        <div className="kv">
          <span>精修成片</span>
          <b>{counts?.edp ?? 0} 个文件</b>
        </div>
        <div className="kv">
          <span>最终成品</span>
          <b>{counts?.end ?? 0} 个文件</b>
        </div>
      </Modal>
    </div>
  )
}
