import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Check,
  CheckCheck,
  FolderOpen,
  Images,
  Layers,
  Loader2,
  MonitorPlay,
  RefreshCw,
  Settings2,
  SlidersHorizontal,
  Undo2,
  Wand2
} from 'lucide-react'
import type { RoundItem, StageFile } from '@shared/types'
import { api, errorText, imageSrc } from '@/lib/bridge'
import { formatBytes, formatDate } from '@/lib/format'
import { matchKeyOf } from '@/lib/pair'
import { joinPath } from '@/lib/path'
import { EmptyState, Modal, Segmented, StatusPill } from '@/components/ui'
import { BuiltInEditor } from '@/components/BuiltInEditor'
import { CopyButton } from '@/components/CopyButton'
import { PageHeader } from '@/components/PageHeader'
import { StageNext } from '@/components/StageNext'
import { MODULE_META } from '../meta'
import type { SharedState } from '../types'

const MAX_ROUND = 10
const DEF = MODULE_META[2]

interface Row {
  raw: StageFile
  jpg?: StageFile
  edp?: StageFile
  inRound?: number
}

export function RetouchModule({ shared }: { shared: SharedState }) {
  const workspace = shared.workspace
  const [choRaw, setChoRaw] = useState<StageFile[]>([])
  const [choJpg, setChoJpg] = useState<StageFile[]>([])
  const [edp, setEdp] = useState<StageFile[]>([])
  const [end, setEnd] = useState<StageFile[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState<'launch' | 'verify' | 'cancel' | null>(null)
  const [loading, setLoading] = useState(false)
  const [editor, setEditor] = useState<'ps' | 'lr'>(workspace?.session.editor ?? 'ps')
  const [developing, setDeveloping] = useState<string | null>(null)
  const [guide, setGuide] = useState(false)
  const [checking, setChecking] = useState(false)

  const root = workspace?.root ?? ''

  const load = useCallback(async (): Promise<void> => {
    if (!root) {
      setChoRaw([])
      setChoJpg([])
      setEdp([])
      setEnd([])
      return
    }
    setLoading(true)
    try {
      const [rawList, jpgList, edpList, endList] = await Promise.all([
        api.workspace.listStage(root, 'choRaw'),
        api.workspace.listStage(root, 'choJpg'),
        api.workspace.listStage(root, 'edp'),
        api.workspace.listStage(root, 'end')
      ])
      setChoRaw(rawList)
      setChoJpg(jpgList)
      setEdp(edpList)
      setEnd(endList)
      setSelected((prev) => prev.filter((name) => rawList.some((file) => file.name === name)))
    } catch (error) {
      shared.toast(errorText(error), 'error')
    } finally {
      setLoading(false)
    }
  }, [root, shared])

  useEffect(() => {
    void load()
  }, [load, workspace?.session.updatedAt])

  useEffect(() => {
    if (workspace?.session.editor) setEditor(workspace.session.editor)
  }, [workspace?.session.editor])

  useEffect(() => {
    if (shared.demo !== 'develop' || developing || choJpg.length === 0) return
    setDeveloping(choJpg[0].name)
  }, [shared.demo, choJpg, developing])

  const rows = useMemo<Row[]>(() => {
    const jpgMap = new Map(choJpg.map((file) => [matchKeyOf(file.name), file]))
    const edpMap = new Map(edp.map((file) => [matchKeyOf(file.name), file]))
    const roundMap = new Map<string, number>()
    workspace?.session.rounds.forEach((round) => {
      round.items.forEach((item) => roundMap.set(matchKeyOf(item.base), round.no))
    })
    return choRaw.map((raw) => {
      const key = matchKeyOf(raw.name)
      return { raw, jpg: jpgMap.get(key), edp: edpMap.get(key), inRound: roundMap.get(key) }
    })
  }, [choRaw, choJpg, edp, workspace])

  const rounds = workspace?.session.rounds ?? []
  const pendingRound = useMemo(
    () => [...rounds].reverse().find((round) => round.status === 'pending'),
    [rounds]
  )
  const selectedSet = useMemo(() => new Set(selected), [selected])
  const verifiedCount = rounds.filter((round) => round.status === 'verified').length
  const exportedOfRound = pendingRound
    ? pendingRound.items.filter((item) => edp.some((file) => matchKeyOf(file.name) === matchKeyOf(item.base))).length
    : 0

  const toggle = (name: string): void => {
    setSelected((prev) => {
      if (prev.includes(name)) return prev.filter((item) => item !== name)
      if (prev.length >= MAX_ROUND) {
        shared.toast(`每轮最多 ${MAX_ROUND} 张，请先取消一些`, 'warn')
        return prev
      }
      return [...prev, name]
    })
  }

  const detect = async (thenLaunch = false): Promise<void> => {
    try {
      setChecking(true)
      const found = await api.editor.detect()
      await shared.refresh(root)
      const target = editor === 'ps' ? found.photoshop : found.lightroom
      shared.toast(
        target ? `已找到 ${editor === 'ps' ? 'Photoshop' : 'Lightroom'}：${target}` : '未检测到，可手动指定程序',
        target ? 'success' : 'warn'
      )
      if (target && thenLaunch) {
        setGuide(false)
        await runLaunch()
      }
    } catch (error) {
      shared.toast(errorText(error), 'error')
    } finally {
      setChecking(false)
    }
  }

  const chooseEditor = async (thenLaunch = false): Promise<void> => {
    try {
      setChecking(true)
      const chosen = await api.editor.choose(editor, root || undefined)
      if (!chosen) return
      await shared.refresh(root)
      shared.toast(`${editor === 'ps' ? 'Photoshop' : 'Lightroom'} 已绑定：${chosen}`, 'success')
      if (thenLaunch) {
        setGuide(false)
        await runLaunch()
      }
    } catch (error) {
      shared.toast(errorText(error), 'error')
    } finally {
      setChecking(false)
    }
  }

  const runLaunch = async (): Promise<void> => {
    if (selected.length === 0 || !root) return
    const chosen = rows.filter((row) => selectedSet.has(row.raw.name))
    const items: RoundItem[] = chosen.map((row) => ({
      base: row.raw.base,
      rawName: row.raw.name,
      jpgName: row.jpg?.name ?? ''
    }))
    setBusy('launch')
    try {
      await api.round.create({ root, items, editor })
      await shared.refresh(root)
      const result = await api.editor.launch({
        files: chosen.map((row) => row.raw.absPath),
        editor,
        root
      })
      setSelected([])
      shared.toast(
        result.fallback
          ? `${chosen.length} 张已用系统默认程序打开（未绑定 ${editor === 'ps' ? 'Photoshop' : 'Lightroom'}）`
          : `已把 ${chosen.length} 张挂起进 ${editor === 'ps' ? 'Photoshop' : 'Lightroom'}`,
        result.fallback ? 'warn' : 'success'
      )
      await load()
    } catch (error) {
      shared.toast(errorText(error), 'error')
    } finally {
      setBusy(null)
    }
  }

  const handleLaunch = async (): Promise<void> => {
    if (selected.length === 0 || !root) return
    if (!editorPath) {
      setGuide(true)
      return
    }
    await runLaunch()
  }

  const handleVerify = async (): Promise<void> => {
    if (!pendingRound || !root) return
    setBusy('verify')
    try {
      const result = await api.round.verify({ root, roundId: pendingRound.id })
      await shared.refresh(root)
      await load()
      if (result.verification.missing.length > 0) {
        shared.toast(`还有 ${result.verification.missing.length} 张未导出到 EDP`, 'warn')
      } else {
        shared.toast('本轮全部导出，验收通过', 'success')
      }
    } catch (error) {
      shared.toast(errorText(error), 'error')
    } finally {
      setBusy(null)
    }
  }

  const handleCancelRound = async (): Promise<void> => {
    if (!pendingRound || !root) return
    setBusy('cancel')
    try {
      await api.round.cancel(root, pendingRound.id)
      await shared.refresh(root)
      await load()
      shared.toast(`已撤销第 ${pendingRound.no} 轮，可以重新选择这一批照片`, 'success')
    } catch (error) {
      shared.toast(errorText(error), 'error')
    } finally {
      setBusy(null)
    }
  }

  const handleRemovePick = async (row: Row): Promise<void> => {
    if (!root) return
    try {
      await api.workspace.removePick(root, row.raw.stem)
      await shared.refresh(root)
      await load()
      shared.toast(`已把 ${row.raw.name} 移出入选照片，可回到第 2 步重新挑`, 'success')
    } catch (error) {
      shared.toast(errorText(error), 'error')
    }
  }

  if (!workspace) {
    return (
      <div className="module">
        <PageHeader
          step={DEF.step}
          total={MODULE_META.length}
          title={DEF.name}
          summary={DEF.summary}
          actions={DEF.actions}
          status={<StatusPill>等待工作区</StatusPill>}
        />
        <section className="step">
          <EmptyState
            icon={<Wand2 size={22} strokeWidth={1.7} />}
            title="先打开工作区"
            desc="入选照片从这里读取，调整好的成品放回「精修成片」目录"
            actions={
              <button className="btn btn--primary" type="button" onClick={() => void shared.ensureWorkspace()}>
                选择工作区
              </button>
            }
          />
        </section>
      </div>
    )
  }

  const editorPath = editor === 'ps' ? workspace.photoshopPath : workspace.lightroomPath
  const developTarget = rows.find((row) => row.jpg && row.edp)?.jpg ?? rows.find((row) => row.jpg)?.jpg

  return (
    <div className="module">
      <PageHeader
        step={DEF.step}
        total={MODULE_META.length}
        title={DEF.name}
        summary={DEF.summary}
        actions={DEF.actions}
        status={
          <StatusPill tone={pendingRound ? 'busy' : 'idle'}>
            {pendingRound
              ? `第 ${pendingRound.no} 轮待检验 · 已收回 ${exportedOfRound} / ${pendingRound.items.length} 张`
              : '当前没有待检验的批次'}
          </StatusPill>
        }
      />

      <div className="retouch-layout">
        <section className="step">
          <div className="toolbar" style={{ marginBottom: 12 }}>
            <span className="step__title" style={{ fontSize: 12.5 }}>
              待精修照片
            </span>
            <span className="muted" style={{ fontSize: 11.5 }}>
              入选 {choRaw.length} 张 · 已收回 {edp.length} 张 · 成品 {end.length} 张
            </span>
            <div className="toolbar__spacer" />
            {loading && <Loader2 size={13} className="spin muted" />}
            <button
              className="btn btn--sm btn--ghost"
              type="button"
              onClick={() =>
                setSelected(
                  rows
                    .filter((row) => !row.edp)
                    .slice(0, MAX_ROUND)
                    .map((row) => row.raw.name)
                )
              }
            >
              选前 {MAX_ROUND} 张未导出
            </button>
            <button className="btn btn--sm btn--ghost" type="button" onClick={() => setSelected([])} disabled={!selected.length}>
              清空
            </button>
            <button className="btn btn--sm" type="button" onClick={() => void load()} disabled={loading}>
              <RefreshCw size={12} className={loading ? 'spin' : undefined} />
              刷新
            </button>
          </div>

          {rows.length === 0 ? (
            <EmptyState
              icon={<Images size={22} strokeWidth={1.7} />}
              title="还没有入选的照片"
              desc="入选照片来自第 2 步「筛选照片」；完成筛选后，照片会成对出现在这里。"
              actions={
                <button className="btn btn--sm" type="button" onClick={() => shared.navigate('select')}>
                  回到第 2 步：筛选照片
                </button>
              }
            />
          ) : (
            <div className="rlist-scroll">
              <div className="rlist">
              <div className="rlist__head">
                <span />
                <span>照片</span>
                <span>进度</span>
                <span />
              </div>
              {rows.map((row) => {
                const active = selectedSet.has(row.raw.name)
                const preview = row.jpg
                return (
                  <div
                    key={row.raw.name}
                    className={`rrow${active ? ' is-selected' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggle(row.raw.name)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        toggle(row.raw.name)
                      }
                    }}
                  >
                    <span className={`rrow__box${active ? ' is-on' : ''}`}>
                      {active && <Check size={11} strokeWidth={3} />}
                    </span>
                    <span className="rrow__main">
                      <span className="rrow__thumb">
                        {preview ? (
                          <img src={imageSrc(preview)} alt={row.raw.base} loading="lazy" />
                        ) : (
                          <span className="rrow__thumb-empty" />
                        )}
                      </span>
                      <span className="rrow__text">
                        <span className="rrow__name">{row.raw.name}</span>
                        <span className="rrow__sub">
                          {formatBytes(row.raw.size)}
                          {row.edp
                            ? ` · 已收回 ${row.edp.name}${row.edp.edited ? ' · 含调整参数' : ''}`
                            : row.inRound
                              ? ` · 已挂起在第 ${row.inRound} 轮`
                              : ''}
                        </span>
                      </span>
                    </span>
                    <span className="rrow__state">
                      {row.edp ? (
                        <span className="tag tag--ok">已导出</span>
                      ) : row.inRound ? (
                        <span className="tag tag--warn">已挂起</span>
                      ) : (
                        <span className="tag">待处理</span>
                      )}
                    </span>
                    <span className="rrow__actions">
                      <button
                        className="icon-btn"
                        type="button"
                        title={row.jpg ? '用内置编辑器调整' : '缺少同名 JPG，无法内置调整'}
                        disabled={!row.jpg}
                        onClick={(event) => {
                          event.stopPropagation()
                          if (row.jpg) setDeveloping(row.jpg.name)
                        }}
                      >
                        <SlidersHorizontal size={13} strokeWidth={2} />
                      </button>
                      <button
                        className="icon-btn"
                        type="button"
                        title="移出 CHO（退回选图）"
                        onClick={(event) => {
                          event.stopPropagation()
                          void handleRemovePick(row)
                        }}
                      >
                        <Undo2 size={13} strokeWidth={2} />
                      </button>
                    </span>
                  </div>
                )
              })}
              </div>
            </div>
          )}

          <div className="retouch-verify">
            <div className="side-block">
              <div className="side-block__title">
                本轮检验 {pendingRound ? `第 ${pendingRound.no} 轮` : ''}
              </div>
              {pendingRound ? (
                <>
                  <div className="kv">
                    <span>挂起时间</span>
                    <b>{formatDate(pendingRound.createdAt)}</b>
                  </div>
                  <div className="kv">
                    <span>张数</span>
                    <b>
                      {exportedOfRound} / {pendingRound.items.length} 已导出
                    </b>
                  </div>
                  <div className="row" style={{ marginTop: 8 }}>
                    <button
                      className="btn btn--primary"
                      type="button"
                      onClick={() => void handleVerify()}
                      disabled={busy !== null}
                    >
                      {busy === 'verify' ? (
                        <Loader2 size={14} className="spin" />
                      ) : (
                        <CheckCheck size={14} strokeWidth={2} />
                      )}
                      检验导出结果
                    </button>
                    <button
                      className="btn btn--sm btn--ghost"
                      type="button"
                      onClick={() => void handleCancelRound()}
                      disabled={busy !== null}
                    >
                      {busy === 'cancel' ? <Loader2 size={12} className="spin" /> : <Undo2 size={12} strokeWidth={2} />}
                      撤销本轮
                    </button>
                  </div>

                  {pendingRound.verification && (
                    <div className="verify">
                      {pendingRound.verification.missing.length === 0 ? (
                        <div className="verify__ok">
                          <Check size={13} strokeWidth={2.6} />
                          全部 {pendingRound.items.length} 张已导出
                        </div>
                      ) : (
                        <div className="verify__warn">
                          <AlertTriangle size={13} strokeWidth={2} />
                          还差 {pendingRound.verification.missing.length} 张
                        </div>
                      )}
                      <div className="verify__list">
                        {pendingRound.items.map((item) => {
                          const fileName = pendingRound.verification?.found[item.base]
                          return (
                            <div key={item.base} className={`verify__row${fileName ? ' is-ok' : ' is-missing'}`}>
                              <span>{item.base}</span>
                              <b>{fileName ?? '未找到'}</b>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="field__hint">勾选照片后点「挂起」开始新一轮；成片放回精修成片目录后，回到此处检验导出结果。</p>
                  {rounds.length > 0 && (
                    <div className="history">
                      {[...rounds]
                        .reverse()
                        .slice(0, 4)
                        .map((round) => (
                          <div key={round.id} className="history__row">
                            <span>
                              第 {round.no} 轮 · {round.items.length} 张
                            </span>
                            <span className={`tag${round.status === 'verified' ? ' tag--ok' : ''}`}>
                              {round.status === 'verified' ? '已完成' : '待检验'}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                  <div className="kv" style={{ marginTop: 8 }}>
                    <span>已完成轮次</span>
                    <b>{verifiedCount}</b>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="step__foot">
            <span className="step__hint">
              <AlertTriangle size={13} strokeWidth={1.9} />
              每轮最多 {MAX_ROUND} 张；导出文件保持原文件名即可自动对应
            </span>
            <button
              className="btn btn--primary"
              type="button"
              onClick={() => void handleLaunch()}
              disabled={selected.length === 0 || busy !== null}
            >
              {busy === 'launch' ? (
                <Loader2 size={14} className="spin" />
              ) : (
                <MonitorPlay size={14} strokeWidth={1.9} />
              )}
              挂起 {editor === 'ps' ? 'Photoshop' : 'Lightroom'}
              {selected.length > 0 ? ` (${selected.length})` : ''}
            </button>
          </div>
        </section>

        <aside className="side">
          <div className="side-block">
            <div className="side-block__title">内置调整（测试版）</div>
            <p className="field__hint" style={{ margin: 0 }}>
              内置调整目前为测试版本，功能有限且仍在完善，不推荐用于正式成片；
              正式修图建议使用 Photoshop 或 Lightroom 等第三方编辑器。
              曝光、对比、高光、阴影、色温、饱和度、清晰度、锐化、暗角。
              保存后成品写入「精修成片」目录，并生成同名参数记录，用于再次调整。
            </p>
            <div className="kv">
              <span>可调预览图</span>
              <b>{choJpg.length} 张</b>
            </div>
            <button
              className="btn btn--sm"
              type="button"
              style={{ width: '100%' }}
              disabled={!developTarget}
              onClick={() => developTarget && setDeveloping(developTarget.name)}
            >
              <SlidersHorizontal size={12} strokeWidth={2} />
              打开内置调整（测试版）
            </button>
          </div>

          <div className="side-block">
            <div className="side-block__title">外部编辑器</div>
            <Segmented
              value={editor}
              onChange={(value) => setEditor(value)}
              options={[
                { value: 'ps', label: 'Photoshop', title: '以 Camera Raw 打开底片（NEF / ARW / CR2 / CR3 / DNG…）' },
                { value: 'lr', label: 'Lightroom', title: '在 LR 中导入并调整' }
              ]}
            />
            <div className={`pathbox${editorPath ? ' pathbox--ok' : ' pathbox--warn'}`} title={editorPath ?? ''}>
              {editorPath ?? '未检测到编辑器'}
            </div>
            <div className="row">
              <button className="btn btn--sm" type="button" onClick={() => void detect()}>
                <RefreshCw size={12} strokeWidth={1.9} />
                检测
              </button>
              <button className="btn btn--sm" type="button" onClick={() => void chooseEditor()}>
                <Settings2 size={12} strokeWidth={1.9} />
                手动指定
              </button>
            </div>
          </div>

          <div className="side-block">
            <div className="side-block__title">精修成片目录</div>
            <div className="pathbox" title={joinPath(root, 'IMGT', 'EDP')}>
              {joinPath(root, 'IMGT', 'EDP')}
            </div>
            <div className="row">
              <CopyButton
                text={joinPath(root, 'IMGT', 'EDP')}
                label="复制路径"
                className="btn btn--sm"
                onCopied={() => shared.toast('精修成片目录路径已复制', 'success')}
                onError={(message) => shared.toast(message, 'error')}
              />
              <button
                className="btn btn--sm"
                type="button"
                onClick={() =>
                  api.openFolder(joinPath(root, 'IMGT', 'EDP')).catch((error) => shared.toast(errorText(error), 'error'))
                }
              >
                <FolderOpen size={12} strokeWidth={1.9} />
                打开
              </button>
            </div>
            <p className="field__hint">
              在 Photoshop 的「导出为 / 存储为」或 Lightroom 的「导出」中粘贴此路径，
              格式选 JPG 或 PNG，文件名与原片保持一致，回来后就能自动对应。
            </p>
            {edp.length > 0 && (
              <div className="mini-grid">
                {edp.slice(0, 6).map((file) => (
                  <img key={file.absPath} src={imageSrc(file)} alt={file.name} loading="lazy" />
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      <StageNext
        hint={
          <>
            <Layers size={13} strokeWidth={1.9} />
            已收回 {edp.length} 张成片，可以进入下一步批量添加水印
            {pendingRound ? ` · 第 ${pendingRound.no} 轮还未检验` : ''}
          </>
        }
        label="进入第 4 步：水印与导出"
        onClick={() => shared.navigate('frame')}
        disabled={edp.length === 0}
      >
        <button className="btn btn--sm btn--ghost" type="button" onClick={() => shared.navigate('select')}>
          返回第 2 步：筛选照片
        </button>
      </StageNext>

      {developing && (
        <BuiltInEditor
          root={root}
          files={choJpg}
          startName={developing}
          onClose={() => setDeveloping(null)}
          onSaved={async (name) => {
            await shared.refresh(root)
            await load()
            shared.toast(`已保存 ${name} 到精修成片目录，调整参数同步记录`, 'success')
          }}
          onError={(message) => shared.toast(message, 'error')}
        />
      )}

      <Modal
        open={guide}
        title={editor === 'ps' ? '未检测到 Photoshop' : '未检测到 Lightroom'}
        desc="挂起需要调用外部编辑器的可执行文件。绑定一次后写入当前工作区，后续直接使用。"
        width={520}
        onClose={() => setGuide(false)}
        footer={
          <>
            <button className="btn btn--sm" type="button" onClick={() => setGuide(false)} disabled={checking}>
              取消
            </button>
            <button className="btn btn--sm" type="button" onClick={() => void detect(true)} disabled={checking}>
              {checking ? <Loader2 size={12} className="spin" /> : <RefreshCw size={12} strokeWidth={2} />}
              重新检测
            </button>
            <button className="btn btn--sm btn--primary" type="button" onClick={() => void chooseEditor(true)} disabled={checking}>
              {checking ? <Loader2 size={12} className="spin" /> : <Settings2 size={12} strokeWidth={2} />}
              选择程序并挂起
            </button>
          </>
        }
      >
        <div className="notice notice--warn dialog-note">
          <AlertTriangle size={15} strokeWidth={2} />
          <div>
            <b>
              常见安装路径中没有找到 {editor === 'ps' ? 'Photoshop.exe' : 'Lightroom.exe'}
            </b>
            <span>如果装在其它磁盘或自定义目录，请手动指定程序文件。</span>
          </div>
        </div>
        <div className="kv">
          <span>本轮照片</span>
          <b>{selected.length} 张待打开</b>
        </div>
        <div className="kv">
          <span>绑定方式</span>
          <b>{editor === 'ps' ? 'Photoshop.exe' : 'Lightroom.exe'} 完整路径</b>
        </div>
        <p className="field__hint">
          绑定记录保存在工作区设置中；更换工作区后可重新指定。未绑定时不会自动改用系统默认程序，以免照片被无关软件接管。
        </p>
      </Modal>
    </div>
  )
}
