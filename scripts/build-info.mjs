/**
 * 构建编码解析（供 electron.vite.config.ts 与 scripts/dist.mjs 共用）。
 *
 * 编码规则见《Versioning & Release Policy》：
 *   <Method><YYMMDD>P<Seq>
 *   NS = NSIS 正式安装包 · OO = 开发热编译版
 *
 * 可用环境变量覆盖：
 *   YPW_BUILD_CHANNEL  NS | OO
 *   YPW_BUILD_DATE     YYMMDD
 *   YPW_BUILD_SEQ      当日序号（纯数字）
 *   YPW_BUILD_CODE     完整编码（优先级最高）
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function pad2(value) {
  return String(value).padStart(2, '0')
}

function todayStamp() {
  const now = new Date()
  return `${pad2(now.getFullYear() % 100)}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`
}

export function readPackageVersion() {
  const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
  return String(pkg.version ?? '0.0.0')
}

/**
 * @param {{ channel?: string, date?: string, seq?: string|number, code?: string }} [overrides]
 * @returns {{ version: string, channel: string, date: string, seq: string, code: string, label: string, release: boolean }}
 */
export function resolveBuildInfo(overrides = {}) {
  const version = readPackageVersion()
  const channel = String(overrides.channel ?? process.env.YPW_BUILD_CHANNEL ?? 'OO').toUpperCase()
  const date = String(overrides.date ?? process.env.YPW_BUILD_DATE ?? todayStamp())
  const seq = String(overrides.seq ?? process.env.YPW_BUILD_SEQ ?? '1').replace(/^P/i, '')
  const code = String(overrides.code ?? process.env.YPW_BUILD_CODE ?? `${channel}${date}P${seq}`)
  return {
    version,
    channel,
    date,
    seq,
    code,
    label: `v${version} ${code}`,
    release: channel === 'NS'
  }
}
