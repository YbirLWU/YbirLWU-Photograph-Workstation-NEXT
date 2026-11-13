import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  FolderInput,
  Images,
  Search,
  Sparkles,
  Usb,
  X,
  ZoomIn
} from 'lucide-react'
import type { ImportProgress } from '@shared/types'
import { extLabel } from '@shared/media'
import { api, errorText, imageSrc } from '@/lib/bridge'
import { formatBytes, formatDuration } from '@/lib/format'
import { EmptyState, Meter, Modal, StatusPill } from '@/components/ui'
import { PageHeader } from '@/components/PageHeader'
import { StageNext } from '@/components/StageNext'
import { Viewer, type ViewerItem } from '@/components/Viewer'
import { MODULE_META } from '../meta'
import { resolvePageSize, type SharedState } from '../types'

const DEF = MODULE_META[1]

type Filter = 'all' | 'picked' | 'unpicked' | 'imported'

export function SelectModule({ shared }: { shared: SharedState }) {
  const report = shared.scan
  const pairs = report?.pairs ?? []
  const drive = shared.workspace?.drive
  const pageSize = resolvePageSize(shared)

  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'copy' | 'move'>('copy')
  const [page, setPage] = useState(1)
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importDone, setImportDone] = useState<{
    count: number
    duration: number
    failed: number
    skipped: number
  } | null>(null)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)

  useEffect(() => api.onImportProgress(setProgress), [])

  useEffect(() => {
    if (shared.demo !== 'select' || picked.size > 0 || pairs.length === 0) return
    const available = pairs.filter((pair) => !importedKeys.has(pair.key)).slice(0, 6)
    setPicked(new Set(available.map((pair) => pair.key)))
  }, [shared.demo, pairs.length])

  useEffect(() => {
    if (shared.demo !== 'viewer' || pairs.length === 0 || viewerIndex !== null) return
    setViewerIndex(1)
  }, [shared.demo, pairs.length])

  const importIndex = shared.workspace?.importIndex
  const sessionImported = shared.workspace?.session.imported

  const importedKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const pair of pairs) {
      const key = pair.baseName.toLowerCase()
      const entry = importIndex?.[key]
      const sized =
        entry &&
        (!entry.rawSize || entry.rawSize === pair.raw.size) &&
        (!entry.jpgSize || entry.jpgSize === pair.jpg.size)
      const listed = (sessionImported ?? []).some((item) => item.base.toLowerCase() === key)
      if (sized || (!entry && listed)) keys.add(pair.key)
    }
    return keys
  }, [pairs, importIndex, sessionImported])

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return pairs.filter((pair) => {
      const imported = importedKeys.has(pair.key)
      if (filter === 'picked' && !picked.has(pair.key)) return false
      if (filter === 'unpicked' && picked.has(pair.key)) return false
      if (filter === 'imported' && !imported) return false
      if (keyword && !pair.baseName.toLowerCase().includes(keyword)) return false
      return true
    })
  }, [pairs, filter, picked, query, importedKeys])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  useEffect(() => {
    setPage(1)
  }, [filter, query, pageSize])

  const viewerItems: ViewerItem[] = useMemo(
    () =>
      filtered.map((pair) => ({
        id: pair.key,
        base: pair.baseName,
        preview: pair.jpg,
        metaPath: pair.raw.absPath,
        rawName: pair.raw.name,
        rawSize: pair.raw.size,
        jpgName: pair.jpg.name,
        jpgSize: pair.jpg.size
      })),
    [filtered]
  )

  const togglePick = useCallback(
    (id: string) => {
      if (importedKeys.has(id)) {
        shared.toast('这张已经在「入选照片」目录里，无需重复写入', 'warn')
        return
      }
      setPicked((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    },
    [importedKeys, shared]
  )

  const handleCollect = async (): Promise<void> => {
    if (picked.size === 0) return
    const root = await shared.ensureWorkspace()
    if (!root) return
    setImportOpen(true)
    setImportDone(null)
    setProgress({ phase: 'working', done: 0, total: picked.size * 2, bytesDone: 0, bytesTotal: 0, current: '准备中…', speed: 0 })
    try {
      const chosen = pairs.filter((pair) => picked.has(pair.key))
      const result = await api.importPicks({
        root,
        rawDir: report?.rawDir,
        jpgDir: report?.jpgDir,
        pairs: chosen,
        mode
      })
      await shared.refresh(root)
      setImportDone({
        count: result.transferred,
        duration: result.durationMs,
        failed: result.failed.length,
        skipped: result.skippedExisting.length
      })
      setPicked(new Set())
      if (result.failed.length > 0) {
        shared.toast(`入库完成，${result.failed.length} 个文件失败`, 'warn')
      } else if (result.skippedExisting.length > 0) {
        shared.toast(`入选完成，${result.skippedExisting.length} 组已在目录中，已跳过`, 'success')
      }
    } catch (error) {
      shared.toast(errorText(error), 'error')
      setImportOpen(false)
    }
  }

  if (!report) {
    return (
      <div className="module">
        <PageHeader
          step={DEF.step}
          total={MODULE_META.length}
          title={DEF.name}
          summary={DEF.summary}
          actions={DEF.actions}
          status={<StatusPill>等待比对结果</StatusPill>}
        />
        <section className="step">
          <EmptyState
            icon={<Images size={22} strokeWidth={1.7} />}
            title="还没有可选的图片"
            desc="需要先完成第 1 步「源文件比对」"
            actions={
              <button className="btn btn--primary" type="button" onClick={() => shared.navigate('scan')}>
                回到第 1 步：源文件比对
                <ArrowRight size={14} strokeWidth={2.2} />
              </button>
            }
          />
        </section>
      </div>
    )
  }

  const percent = progress && progress.bytesTotal > 0 ? (progress.bytesDone / progress.bytesTotal) * 100 : 0
  const eta =
    progress && progress.speed > 0 && progress.bytesTotal > 0
      ? (progress.bytesTotal - progress.bytesDone) / progress.speed
      : 0

  return (
    <div className="module">
      <PageHeader
        step={DEF.step}
        total={MODULE_META.length}
        title={DEF.name}
        summary={DEF.summary}
        actions={DEF.actions}
        status={
          <StatusPill tone={picked.size > 0 ? 'accent' : 'idle'}>
            已选定 {picked.size} 组 · 共 {pairs.length} 组
          </StatusPill>
        }
      />

      {drive?.external && (
        <div className="notice notice--warn">
          <Usb size={14} strokeWidth={2} />
          <span>
            {drive.warning}，已自动改为每页 {drive.pageSize} 张
          </span>
        </div>
      )}

      {report.issues.length > 0 && (
        <div className="notice notice--muted">
          <AlertTriangle size={13} strokeWidth={2} />
          <span>
            比对时有 {report.issues.length} 处异常，已按你的要求忽略；本页可用 {pairs.length} 组
          </span>
        </div>
      )}

      <section className="step step--tight">
        <div className="toolbar">
          <div className="search">
            <Search size={13} strokeWidth={2} className="search__icon" />
            <input
              className="input input--search"
              placeholder="搜索文件名"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          {(
            [
              ['all', '全部'],
              ['picked', '已选'],
              ['unpicked', '未选'],
              ['imported', '已入库']
            ] as Array<[Filter, string]>
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`chip${filter === value ? ' is-active' : ''}`}
              onClick={() => setFilter(value)}
            >
              {label}
              {value === 'imported' && importedKeys.size > 0 && (
                <span className="chip__num">{importedKeys.size}</span>
              )}
            </button>
          ))}
          <div className="toolbar__spacer" />
          <div className="seg" title="入库方式">
            <button
              type="button"
              className={`seg__item${mode === 'copy' ? ' is-active' : ''}`}
              onClick={() => setMode('copy')}
            >
              复制
            </button>
            <button
              type="button"
              className={`seg__item${mode === 'move' ? ' is-active' : ''}`}
              onClick={() => setMode('move')}
            >
              移动
            </button>
          </div>
          <button
            className="btn btn--sm btn--ghost"
            type="button"
            onClick={() => setPicked(new Set(filtered.filter((pair) => !importedKeys.has(pair.key)).map((pair) => pair.key)))}
            disabled={filtered.length === 0}
          >
            全选本页
          </button>
          <button
            className="btn btn--sm btn--ghost"
            type="button"
            onClick={() => setPicked(new Set())}
            disabled={picked.size === 0}
          >
            <X size={12} strokeWidth={2.2} />
            清空
          </button>
          <button
            className="btn btn--primary btn--sm"
            type="button"
            onClick={() => void handleCollect()}
            disabled={picked.size === 0}
          >
            <FolderInput size={13} strokeWidth={1.9} />
            入选照片{picked.size > 0 ? ` (${picked.size})` : ''}
          </button>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<Sparkles size={22} strokeWidth={1.7} />}
            title="没有匹配的图片"
            desc="换个关键词，或切回「全部」查看。"
          />
        ) : (
          <>
            <div className="pair-grid">
              {visible.map((pair) => {
                const absoluteIndex = filtered.indexOf(pair)
                const isPicked = picked.has(pair.key)
                const imported = importedKeys.has(pair.key)
                return (
                  <div
                    key={pair.key}
                    className={`pair-card${isPicked ? ' is-picked' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setViewerIndex(absoluteIndex)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setViewerIndex(absoluteIndex)
                      }
                    }}
                  >
                    <div className="pair-card__thumb">
                      <img src={imageSrc(pair.jpg)} alt={pair.baseName} loading="lazy" decoding="async" />
                      <button
                        type="button"
                        className={`pick-dot${isPicked ? ' is-on' : ''}`}
                        aria-label={isPicked ? '取消选定' : '选定'}
                        onClick={(event) => {
                          event.stopPropagation()
                          togglePick(pair.key)
                        }}
                      >
                        {isPicked && <Check size={12} strokeWidth={3} />}
                      </button>
                      <span className="pair-card__zoom">
                        <ZoomIn size={12} strokeWidth={2.2} />
                      </span>
                      {imported && <span className="pair-card__badge">已入库</span>}
                    </div>
                    <div className="pair-card__meta">
                      <span className="pair-card__name" title={pair.baseName}>
                        {pair.baseName}
                      </span>
                      <span className="pair-card__sub">
                        {extLabel(pair.raw.ext)} {formatBytes(pair.raw.size)} · JPG {formatBytes(pair.jpg.size)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="pager">
              <span className="pager__info">
                第 {currentPage} / {totalPages} 页 · 共 {filtered.length} 组 · 每页 {pageSize} 张
                {drive?.external ? '（外置设备）' : ''}
              </span>
              <div className="pager__controls">
                <button
                  className="btn btn--icon"
                  type="button"
                  title="上一页"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  className="btn btn--icon"
                  type="button"
                  title="下一页"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}

        <StageNext
          hint={
            <>
              <Sparkles size={13} strokeWidth={1.9} />
              本次选定 {picked.size} 组
            </>
          }
          label="进入修图"
          onClick={() => shared.navigate('retouch')}
          disabled={picked.size === 0 && (shared.workspace?.counts.choRaw ?? 0) === 0}
        >
          <span className="stage-next__meta">
            已入选 {(shared.workspace?.counts.choRaw ?? 0) + (shared.workspace?.counts.choJpg ?? 0)} 个文件
          </span>
        </StageNext>
      </section>

      {viewerIndex !== null && viewerItems[viewerIndex] && (
        <Viewer
          items={viewerItems}
          index={viewerIndex}
          picked={picked}
          onIndex={(next) => {
            setViewerIndex(next)
            const targetPage = Math.floor(next / pageSize) + 1
            if (targetPage !== currentPage) setPage(targetPage)
          }}
          onTogglePick={togglePick}
          onClose={() => setViewerIndex(null)}
          onError={(message) => shared.toast(message, 'error')}
          onToast={(message, tone) => shared.toast(message, tone)}
        />
      )}

      <Modal
        open={importOpen}
        title={importDone ? '入选完成' : '正在写入入选照片目录'}
        desc={
          importDone
            ? `共 ${importDone.count} 个文件，用时 ${formatDuration(importDone.duration)}${
                importDone.skipped > 0 ? `，跳过 ${importDone.skipped} 组重复` : ''
              }${importDone.failed > 0 ? `，${importDone.failed} 个失败` : ''}`
            : '正在复制文件…'
        }
        width={460}
        closable={Boolean(importDone)}
        onClose={() => setImportOpen(false)}
        footer={
          importDone ? (
            <button className="btn btn--primary btn--sm" type="button" onClick={() => setImportOpen(false)}>
              完成
            </button>
          ) : undefined
        }
      >
        {importDone ? (
          <div className="import-done">
            <span className="import-done__icon">
              <Check size={20} strokeWidth={2.6} />
            </span>
            <div>
              <div className="import-done__title">已写入「入选照片」目录</div>
              <div className="import-done__desc">下一步是精修：每轮最多 10 张，送进 Photoshop 或 Lightroom 调整。</div>
            </div>
          </div>
        ) : (
          <div className="import-progress">
            <div className="import-progress__row">
              <span className="import-progress__label">
                {progress && progress.total > 0 ? `${progress.done} / ${progress.total} 个文件` : '正在统计…'}
              </span>
              <b>{percent.toFixed(1)}%</b>
            </div>
            <Meter percent={percent} />
            <div className="import-progress__meta">
              <span>
                {progress ? `${formatBytes(progress.bytesDone)} / ${formatBytes(progress.bytesTotal)}` : '—'}
              </span>
              <span>{progress && progress.speed > 0 ? `${formatBytes(progress.speed)}/s` : ''}</span>
              <span>{eta > 0 ? `剩余约 ${formatDuration(eta * 1000)}` : ''}</span>
            </div>
            <div className="import-progress__current" title={progress?.current}>
              {progress?.current || '准备中…'}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
