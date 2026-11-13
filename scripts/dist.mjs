/**
 * 发布打包入口：`npm run dist`
 *
 * 1. 计算本次构建编码（默认 NS + 当日日期 + P1，可用 YPW_BUILD_* 覆盖）
 * 2. 以该编码执行 electron-vite build（编译期注入版本常量）
 * 3. 以同一编码执行 electron-builder（用于安装包文件名）
 *
 * 使用 node 脚本而非 shell 串接，保证 cmd / PowerShell / bash 下行为一致，
 * 且版本编码在编译与打包两个阶段完全一致。
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { ROOT, resolveBuildInfo } from './build-info.mjs'

const info = resolveBuildInfo({ channel: process.env.YPW_BUILD_CHANNEL ?? 'NS' })

const env = {
  ...process.env,
  YPW_BUILD_CHANNEL: info.channel,
  YPW_BUILD_DATE: info.date,
  YPW_BUILD_SEQ: info.seq,
  YPW_BUILD_CODE: info.code
}

function binOf(pkg) {
  const manifest = JSON.parse(readFileSync(path.join(ROOT, 'node_modules', pkg, 'package.json'), 'utf8'))
  const bin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.[pkg]
  if (!bin) throw new Error(`找不到 ${pkg} 的可执行入口`)
  return path.join(ROOT, 'node_modules', pkg, bin)
}

function run(label, pkg, args) {
  process.stdout.write(`\n[ypw] ${label} · ${info.label}\n`)
  const result = spawnSync(process.execPath, [binOf(pkg), ...args], { cwd: ROOT, env, stdio: 'inherit' })
  if (result.error) {
    console.error(`[ypw] ${label} 启动失败：${result.error.message}`)
    process.exit(1)
  }
  if (result.status !== 0) {
    console.error(`[ypw] ${label} 失败（退出码 ${result.status}）`)
    process.exit(result.status ?? 1)
  }
}

run('编译', 'electron-vite', ['build'])
run('打包', 'electron-builder', ['--win', '--x64'])

process.stdout.write(`\n[ypw] 完成 · ${info.label} → release/\n`)
