import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCheck,
  Crosshair,
  FolderOpen,
  HardDrive,
  Loader2,
  RefreshCw,
  ScanSearch,
  TriangleAlert,
  Usb
} from 'lucide-react'
import type { IssueKind } from '@shared/types'
import { api, errorText } from '@/lib/bridge'
import { formatBytes, formatClock, formatDuration } from '@/lib/format'
import { joinPath } from '@/lib/path'
import { EmptyState, ExtBadge, Stat, StatusPill } from '@/components/ui'
import { PageHeader } from '@/components/PageHeader'
import { StageNext } from '@/components/StageNext'
import { MODULE_META } from '../meta'
import type { SharedState } from '../types'

const DEF = MODULE_META[0]

const ISSUE_LABEL: Record<IssueKind, string> = {
  rawOnly: '缺 JPG',
  jpgOnly: '缺底片',
  badExtRaw: 'RAW 目录异常',
  badExtJpg: 'JPG 目录异常',
  duplicate: '同名重复'
}

const ISSUE_ORDER: IssueKind[] = ['rawOnly', 'jpgOnly', 'badExtRaw', 'badExtJpg', 'duplicate']
const MAX_ROWS = 300

export function ScanModule({ shared }: { shared: SharedState }) {
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | IssueKind>('all')
  const [started, setStarted] = useState(false)

  const report = shared.scan
  const workspace = shared.workspace
  const drive = workspace?.drive

  const runScan = useCallback(async (): Promise<void> => {
    const root = await shared.ensureWorkspace()
    if (!root) return
    setScanning(true)
    setScanError(null)
    setStarted(true)
    try {
      const result = await api.scan({
        root,
        rawDir: joinPath(root, 'RAW'),
        jpgDir: joinPath(root, 'JPG')
      })
      shared.setScan(result)
      setFilter('all')
      shared.toast(
        result.passed
          ? `校验通过 · ${result.stats.matched} 组一一对应（${formatDuration(result.durationMs)}）`
          : `发现 ${result.issues.length} 处问题，可继续选图（异常文件不入库）`,
        result.passed ? 'success' : 'warn'
      )
      await shared.refresh(root)
    } catch (error) {
      setScanError(errorText(error))
    } finally {
      setScanning(false)
    }
  }, [shared.ensureWorkspace, shared.refresh, shared.setScan, shared.toast])

  useEffect(() => {
    if (!workspace || started || scanning || report) return
    if (workspace.counts.raw === 0 || workspace.counts.jpg === 0) return
    void runScan()
  }, [workspace?.root, workspace?.counts.raw, workspace?.counts.jpg])

  const kindCounts = useMemo(() => {
    const counts = new Map<IssueKind, number>()
    report?.issues.forEach((issue) => counts.set(issue.kind, (counts.get(issue.kind) ?? 0) + 1))
    return counts
  }, [report])

  const visibleIssues = useMemo(() => {
    if (!report) return []
    return filter === 'all' ? report.issues : report.issues.filter((issue) => issue.kind === filter)
  }, [report, filter])

  const reveal = (target: string): void => {
    api.reveal(target).catch((error) => shared.toast(errorText(error), 'error'))
  }

  const statusPill = scanning ? (
    <StatusPill tone="busy">正在比对</StatusPill>
  ) : report?.passed ? (
    <StatusPill tone="ok">{report.stats.matched} 组一一对应</StatusPill>
  ) : report ? (
    <StatusPill tone="warn">{report.issues.length} 处问题 · 可继续</StatusPill>
  ) : (
    <StatusPill>待比对</StatusPill>
  )

  return (
    <div className="module">
      <PageHeader
        step={DEF.step}
        total={MODULE_META.length}
        title={DEF.name}
        summary={DEF.summary}
        actions={DEF.actions}
        status={statusPill}
      />

      {!workspace ? (
        <section className="step">
          <EmptyState
            icon={<ScanSearch size={22} strokeWidth={1.7} />}
            title="先打开一个工作区"
            desc="程序会在其中建立 RAW、JPG 与处理区三个目录"
            actions={
              <button className="btn btn--primary" type="button" onClick={() => void shared.ensureWorkspace()}>
                选择工作区
              </button>
            }
          />
        </section>
      ) : (
        <>
          <section className="step step--tight">
            <div className="source-bar">
              <div className="source-bar__item">
                {drive?.external ? <Usb size={14} strokeWidth={2} /> : <HardDrive size={14} strokeWidth={2} />}
                <div className="source-bar__text">
                  <span className="source-bar__label">工作区</span>
                  <b className="source-bar__path" title={workspace.root}>
                    {workspace.root}
                  </b>
                </div>
              </div>
              <div className="source-bar__stat">
                <b>{workspace.counts.raw}</b>
                <span>RAW</span>
              </div>
              <div className="source-bar__stat">
                <b>{workspace.counts.jpg}</b>
                <span>JPG</span>
              </div>
              <div className="source-bar__stat">
                <b>{workspace.counts.choRaw}</b>
                <span>已入选</span>
              </div>
              <div className="source-bar__spacer" />
              <button
                className="btn btn--sm btn--ghost"
                type="button"
                onClick={() => api.openFolder(workspace.root).catch((e) => shared.toast(errorText(e), 'error'))}
              >
                <FolderOpen size={12} strokeWidth={2} />
                打开目录
              </button>
              <button className="btn btn--sm btn--ghost" type="button" onClick={() => void shared.switchWorkspace()}>
                更换
              </button>
              <button
                className="btn btn--sm btn--primary"
                type="button"
                onClick={() => void runScan()}
                disabled={scanning}
              >
                {scanning ? <Loader2 size={13} className="spin" /> : <ScanSearch size={13} strokeWidth={2} />}
                {scanning ? '正在比对…' : report ? '重新比对' : '开始比对'}
              </button>
            </div>

            {drive?.warning && (
              <div className="notice notice--warn" style={{ marginTop: 10 }}>
                <Usb size={14} strokeWidth={2} />
                <span>
                  {drive.warning} —— 当前为 <b>{drive.model || '外置设备'}</b>，缩略图每页 {drive.pageSize} 张。
                </span>
              </div>
            )}
          </section>

          <section className="step">
            <div className="step__head">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="step__title">比对结果</div>
              </div>
              {report && (
                <span className="step__asidemeta">
                  {formatClock(report.scannedAt)} · {formatDuration(report.durationMs)}
                </span>
              )}
            </div>

            {scanError && !report ? (
              <div className="verdict verdict--fail">
                <div className="verdict__icon">
                  <TriangleAlert size={18} strokeWidth={2} />
                </div>
                <div className="verdict__body">
                  <div className="verdict__title">比对失败</div>
                  <div className="verdict__desc">{scanError}</div>
                </div>
              </div>
            ) : !report ? (
              <EmptyState
                icon={<ScanSearch size={22} strokeWidth={1.7} />}
                title={scanning ? '正在扫描目录…' : '还没有比对结果'}
                desc="RAW 与 JPG 目录均有文件时，比对会自动开始。"
              />
            ) : (
              <div className="step__body">
                <div className={`verdict verdict--${report.passed ? 'pass' : 'warn'}`}>
                  <div className="verdict__icon">
                    {report.passed ? (
                      <CheckCheck size={18} strokeWidth={2.2} />
                    ) : (
                      <TriangleAlert size={18} strokeWidth={2} />
                    )}
                  </div>
                  <div className="verdict__body">
                    <div className="verdict__title">
                      {report.passed
                        ? '校验通过：RAW 与 JPG 完全一一对应'
                        : `校验未通过：${report.issues.length} 处问题，可继续选图`}
                    </div>
                    <div className="verdict__desc">
                      {report.passed
                        ? `${report.stats.matched} 组配对，共 ${report.stats.matched * 2} 个文件，没有多余内容。`
                        : [
                            report.stats.rawOnly > 0 ? `${report.stats.rawOnly} 张底片缺少 JPG` : null,
                            report.stats.jpgOnly > 0 ? `${report.stats.jpgOnly} 个 JPG 缺少同名底片` : null,
                            report.stats.badExtRaw + report.stats.badExtJpg > 0
                              ? `${report.stats.badExtRaw + report.stats.badExtJpg} 个文件后缀或位置异常`
                              : null,
                            report.issues.some((issue) => issue.kind === 'duplicate') ? '存在同名重复文件' : null
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                    </div>
                  </div>
                </div>

                <div className="stats">
                  <Stat value={report.stats.matched} label="一一对应的组数" tone="accent" />
                  <Stat
                    value={report.stats.rawValid}
                    label={`${report.stats.mixedRaw ? '混合底片' : (report.stats.formats[0]?.label ?? 'RAW')} · 共 ${report.stats.rawFiles} 个文件`}
                  />
                  <Stat value={report.stats.jpgValid} label={`JPG · 共 ${report.stats.jpgFiles} 个文件`} />
                  <Stat
                    value={report.issues.length}
                    label="异常 / 多余"
                    tone={report.issues.length > 0 ? 'warn' : 'ok'}
                  />
                </div>

                {report.stats.formats.length > 0 && (
                  <div className="formats">
                    <span className="formats__label">底片格式</span>
                    {report.stats.formats.map((item) => (
                      <span key={item.ext} className="formats__item">
                        {item.label}
                        <b>{item.count}</b>
                      </span>
                    ))}
                    {report.stats.mixedRaw && <span className="formats__note">混装 · 按文件名配对</span>}
                  </div>
                )}

                {report.issues.length > 0 && (
                  <div className="issues">
                    <div className="issues__head">
                      <span className="issues__title">异常清单</span>
                      <button
                        type="button"
                        className={`chip${filter === 'all' ? ' is-active' : ''}`}
                        onClick={() => setFilter('all')}
                      >
                        全部<span className="chip__num">{report.issues.length}</span>
                      </button>
                      {ISSUE_ORDER.filter((kind) => (kindCounts.get(kind) ?? 0) > 0).map((kind) => (
                        <button
                          key={kind}
                          type="button"
                          className={`chip${filter === kind ? ' is-active' : ''}`}
                          onClick={() => setFilter(kind)}
                        >
                          {ISSUE_LABEL[kind]}
                          <span className="chip__num">{kindCounts.get(kind)}</span>
                        </button>
                      ))}
                      <div className="toolbar__spacer" />
                      <span className="muted" style={{ fontSize: 11 }}>
                        共 {formatBytes(report.issues.reduce((sum, issue) => sum + issue.size, 0))}
                      </span>
                    </div>
                    <div className="issue-list">
                      {visibleIssues.slice(0, MAX_ROWS).map((issue) => (
                        <div
                          className={`issue-row${issue.kind === 'duplicate' ? ' issue-row--duplicate' : ''}`}
                          key={`${issue.kind}:${issue.absPath}`}
                        >
                          <ExtBadge ext={issue.ext} />
                          <div style={{ minWidth: 0 }}>
                            <div className="issue-row__name" title={issue.name}>
                              {issue.name}
                            </div>
                            <div className="issue-row__path" title={issue.relPath}>
                              {issue.relPath}
                            </div>
                          </div>
                          <div className="issue-row__note" title={issue.note}>
                            {issue.note}
                          </div>
                          <button
                            className="btn btn--icon"
                            type="button"
                            title="在资源管理器中定位"
                            onClick={() => reveal(issue.absPath)}
                          >
                            <Crosshair size={13} strokeWidth={1.9} />
                          </button>
                        </div>
                      ))}
                    </div>
                    {visibleIssues.length > MAX_ROWS && (
                      <div className="issues__more">
                        仅显示前 {MAX_ROWS} 条，共 {visibleIssues.length} 条
                      </div>
                    )}
                  </div>
                )}

                <StageNext
                  hint={
                    <>
                      <RefreshCw size={12} strokeWidth={2} />
                      {report.pairs.length} 组可进入选图 · 选图后可随时回到这里重新比对
                    </>
                  }
                  label="进入选图"
                  onClick={() => shared.navigate('select')}
                  disabled={report.pairs.length === 0}
                >
                  <button className="btn btn--sm btn--ghost" type="button" onClick={() => void shared.switchWorkspace()}>
                    更换工作区
                  </button>
                </StageNext>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
