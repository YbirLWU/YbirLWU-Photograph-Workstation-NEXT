import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolveBuildInfo } from './scripts/build-info.mjs'

const sharedAlias = { '@shared': resolve(__dirname, 'src/shared') }

/**
 * 构建编码在编译期注入三个 bundle，保证主进程、预加载与界面
 * 在任意运行状态下显示同一套版本标识（NS = 正式安装包 / OO = 开发热编译）。
 * 由 `npm run dist` 传入 NS 编码，其余场景（dev / build）默认为 OO。
 */
const buildInfo = resolveBuildInfo()
const versionDefine = {
  __YPW_VERSION__: JSON.stringify(buildInfo.version),
  __YPW_BUILD_CODE__: JSON.stringify(buildInfo.code),
  __YPW_BUILD_CHANNEL__: JSON.stringify(buildInfo.channel),
  __YPW_BUILD_DATE__: JSON.stringify(buildInfo.date),
  __YPW_BUILD_SEQ__: JSON.stringify(buildInfo.seq)
}

export default defineConfig({
  main: {
    define: versionDefine,
    plugins: [externalizeDepsPlugin({ exclude: ['exifr'] })],
    resolve: { alias: sharedAlias },
    build: {
      outDir: resolve(__dirname, 'out/main'),
      rollupOptions: { input: resolve(__dirname, 'src/main/index.ts') }
    }
  },
  preload: {
    define: versionDefine,
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: sharedAlias },
    build: {
      outDir: resolve(__dirname, 'out/preload'),
      rollupOptions: { input: resolve(__dirname, 'src/preload/index.ts') }
    }
  },
  renderer: {
    define: versionDefine,
    root: resolve(__dirname, 'src/renderer'),
    resolve: {
      alias: {
        ...sharedAlias,
        '@': resolve(__dirname, 'src/renderer/src')
      }
    },
    plugins: [react()],
    build: {
      outDir: resolve(__dirname, 'out/renderer'),
      emptyOutDir: true,
      rollupOptions: { input: resolve(__dirname, 'src/renderer/index.html') }
    }
  }
})
