export interface BuildInfo {
  /** package.json 中的语义化版本，例如 1.0.0 */
  version: string
  /** 构建通道：NS = 正式安装包，OO = 开发热编译 */
  channel: string
  /** 构建日期 YYMMDD */
  date: string
  /** 当日构建序号 */
  seq: string
  /** 完整构建编码，例如 NS261113P1 */
  code: string
  /** 对外展示标识，例如 v1.0.0 NS261113P1 */
  label: string
  /** 是否为正式发布构建 */
  release: boolean
}

export const ROOT: string

export function readPackageVersion(): string

export function resolveBuildInfo(overrides?: {
  channel?: string
  date?: string
  seq?: string | number
  code?: string
}): BuildInfo
