import type { ComponentType } from 'react'
import { ScanModule } from './scan/ScanModule'
import { SelectModule } from './select/SelectModule'
import { RetouchModule } from './retouch/RetouchModule'
import { FrameModule } from './frame/FrameModule'
import { MODULE_META } from './meta'
import type { ModuleMeta } from './meta'
import type { SharedState } from './types'

export interface ModuleDef extends ModuleMeta {
  component: ComponentType<{ shared: SharedState }>
}

export type { ModuleMeta }

export const MODULES: ModuleDef[] = MODULE_META.map((meta, index) => ({
  ...meta,
  component: [ScanModule, SelectModule, RetouchModule, FrameModule][index]
}))