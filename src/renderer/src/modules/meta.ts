import type { LucideIcon } from 'lucide-react'
import { ScanSearch, Images, Wand2, Layers } from 'lucide-react'

export interface ModuleMeta {
  id: string
  step: number
  name: string
  tagline: string
  summary: string
  actions: string[]
  icon: LucideIcon
  wide?: boolean
}
export const TOTAL_STEPS = 4
export const MODULE_META: ModuleMeta[] = [
  {
    id: 'scan',
    step: 1,
    name: '源文件比对',
    tagline: '核对相机原片与 JPG 预览是否完整',
    summary:
      '应用程式将检查相机原片（RAW）与 JPG 预览：文件名是否同名对应及数量一致性，生成多余、缺失、后缀异常的文件列表以供核对，提供高效的项目完整性检查模板',
    actions: ['打开包含 RAW 与 JPG 的工作区', '点击开始比对', '核对异常文件', '确认后进入下一步'],
    icon: ScanSearch
  },
  {
    id: 'select',
    step: 2,
    name: '筛选照片',
    tagline: '放大查看，并从中筛选需保留的照片',
    summary:
      '比对通过的每组照片以平铺视图展示，支持点击放大查看细节及拍摄参数；选中的照片将成对写入「入选照片」目录，供后续精修使用',
    actions: ['点击缩略图放大查看', '按 P 键或点圆点标记选定', '选择复制或移动的方式', '点入选按钮写入目录'],
    icon: Images
  },
  {
    id: 'retouch',
    step: 3,
    name: '精修照片',
    tagline: '通过 Photoshop 或 Lightroom 调整',
    summary:
      '每轮最多可勾选 10 张入选照片，并一次性在 Photoshop（Camera Raw）或 Lightroom 中打开；调整完成的成品放回「精修成片」目录后，点击「检验导出」确认数量无遗漏',
    actions: ['勾选本轮要调整的照片', '挂起打开外部编辑器', '导出的 JPG 或 PNG 移入成片目录', '检验导出核对数量'],
    icon: Wand2
  },
  {
    id: 'frame',
    step: 4,
    name: '水印与导出',
    tagline: '统一添加色块与版权文字',
    summary:
      '在成片上下扩展色块并添加版权文字，位置与样式可一次性设定并整批套用；导出文件按「原文件名 + END」命名，统一归入「最终成品」目录',
    actions: ['勾选要处理的成片', '设置上下留白与色块颜色', '填写版权文字并调整位置', '批量导出到最终成品目录'],
    icon: Layers,
    wide: true
  }
]