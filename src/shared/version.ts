/**
 * 版本与构建标识的唯一来源（主进程 / 预加载 / 渲染进程共用）。
 *
 * 构建编码遵循《Versioning & Release Policy》：
 *   <Method><YYMMDD>P<Seq>
 *   - Method: `NS` = NSIS 正式安装包；`OO` = 开发热编译（dev / 未打包产物）
 *   - YYMMDD: 构建当日日期
 *   - P<Seq>: 当日构建序号，默认 1
 *
 * 编译期由 electron.vite.config.ts 通过 `define` 注入 __YPW_* 常量；
 * 若在未注入的环境（如直接以 tsc / node 运行）执行，则自动回退到开发默认值。
 */

declare const __YPW_VERSION__: string
declare const __YPW_BUILD_CODE__: string
declare const __YPW_BUILD_CHANNEL__: string
declare const __YPW_BUILD_DATE__: string
declare const __YPW_BUILD_SEQ__: string

const FALLBACK_VERSION = '1.0.0'
const FALLBACK_DATE = '000000'
const FALLBACK_SEQ = '1'

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function localDateStamp(): string {
  const now = new Date()
  return `${pad2(now.getFullYear() % 100)}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`
}

/** 版本号主体，例如 1.0.0 */
export const APP_VERSION: string = typeof __YPW_VERSION__ === 'undefined' ? FALLBACK_VERSION : __YPW_VERSION__

/** 构建通道：NS = 正式安装包，OO = 开发热编译 */
export const BUILD_CHANNEL: string = typeof __YPW_BUILD_CHANNEL__ === 'undefined' ? 'OO' : __YPW_BUILD_CHANNEL__

/** 构建日期 YYMMDD */
export const BUILD_DATE: string = typeof __YPW_BUILD_DATE__ === 'undefined' ? localDateStamp() : __YPW_BUILD_DATE__

/** 当日构建序号（不含 P 前缀） */
export const BUILD_SEQ: string = typeof __YPW_BUILD_SEQ__ === 'undefined' ? FALLBACK_SEQ : __YPW_BUILD_SEQ__

/** 完整构建编码，例如 NS261116P1 */
export const BUILD_CODE: string =
  typeof __YPW_BUILD_CODE__ === 'undefined' ? `${BUILD_CHANNEL}${BUILD_DATE}P${BUILD_SEQ}` : __YPW_BUILD_CODE__

/** 对外展示的完整版本标识，例如 v1.0.0 NS261116P1 */
export const APP_VERSION_LABEL = `v${APP_VERSION} ${BUILD_CODE}`

/** 构建通道的中文释义，用于界面说明 */
export const BUILD_CHANNEL_LABEL = BUILD_CHANNEL === 'NS' ? '正式安装包' : '开发热编译版'

/** 是否为可对外分发的正式安装包构建 */
export const IS_RELEASE_BUILD = BUILD_CHANNEL === 'NS'

export const APP_NAME = 'YbirLWU Photograph Workstation'
export const APP_SHORT = 'YPW'
export const APP_VENDOR = 'YbirLWU'
export const APP_PLATFORM = 'win32-x64'

/** @deprecated 旧字段，等价于 BUILD_CODE；保留以兼容既有引用 */
export const APP_PATCH = BUILD_CODE

export { FALLBACK_VERSION, FALLBACK_DATE, FALLBACK_SEQ }
