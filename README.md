# YbirLWU Photograph Workstation (YPW)

> 面向摄影师与修图师的 Windows 桌面影像工作流工具：扫描核对 → 选片 → 精修 → 水印导出，四个阶段一站式完成。
>
> **EN** — A Windows desktop imaging workflow tool for photographers and retouchers: scan & verify → select → retouch → watermark & export, all four stages in one place.

**YbirLWU Photograph Workstation Next（YPW-N）** 是一款基于 Electron 的独立桌面应用，面向有图片筛选、第三方编辑和版权水印管理的专业摄影师开发，用于相机原片（RAW）与 JPG 预览图的完整性核对、选片入库、外部/内置精修，以及统一的版权水印批量导出。应用不强制依赖任何在线云服务，所有数据将在您的本地个人计算机或服务器存储和处理。

**EN** — **YbirLWU Photograph Workstation Next (YPW-N)** is a standalone desktop application built on Electron, developed for professional photographers who need image culling, third-party editing and copyright watermark management. It verifies the integrity of camera originals (RAW) against JPG previews, manages pick import, external/built-in retouching, and batch watermark export. The app never requires any online cloud service — all data is stored and processed on your local computer or server.

- 当前版本：`v1.0.0`（构建后缀 `--261113P1`） **该README文档仅对当前版本生效**
- 运行平台：`win32-x64`（Windows 10/11）
- 作者 / 版权：YbirLWU © 2026

**EN**

- Current version: `v1.0.0` (build code `NS261113P1`) — **this README applies to the current version only**
- Platform: `win32-x64` (Windows 10/11)
- Author / Copyright: YbirLWU © 2026

---

## 目录

- [YbirLWU Photograph Workstation (YPW)](#ybirlwu-photograph-workstation-ypw)
  - [目录](#目录)
    - [Table of Contents (English)](#table-of-contents-english)
  - [功能总览](#功能总览)
    - [1. 源文件比对（Scan）](#1-源文件比对scan)
    - [2. 筛选照片（Select）](#2-筛选照片select)
    - [3. 精修照片（Retouch）](#3-精修照片retouch)
    - [4. 水印与导出（Frame）](#4-水印与导出frame)
    - [通用能力（该部分仅在较大版本更新时发生变更，限于篇幅无法展示全部通用能力，请您谅解）](#通用能力该部分仅在较大版本更新时发生变更限于篇幅无法展示全部通用能力请您谅解)
  - [工作区目录结构](#工作区目录结构)
  - [支持的文件格式](#支持的文件格式)
  - [技术架构](#技术架构)
    - [进程模型](#进程模型)
    - [自定义协议](#自定义协议)
  - [快速开始](#快速开始)
    - [环境要求](#环境要求)
    - [本地开发](#本地开发)
  - [打包与发布](#打包与发布)
  - [项目结构](#项目结构)
  - [应用设置与数据存储](#应用设置与数据存储)
  - [插件系统](#插件系统)
  - [版本与发布政策](#版本与发布政策)
  - [常见问题](#常见问题)

### Table of Contents (English)

Links point to the same sections as above (each section contains both the Chinese original and its English translation).

- [Features Overview](#功能总览) — [Scan](#1-源文件比对scan) · [Select](#2-筛选照片select) · [Retouch](#3-精修照片retouch) · [Frame](#4-水印与导出frame) · [General capabilities](#通用能力该部分仅在较大版本更新时发生变更限于篇幅无法展示全部通用能力请您谅解)
- [Workspace Layout](#工作区目录结构) · [Supported Formats](#支持的文件格式) · [Technical Architecture](#技术架构)
- [Getting Started](#快速开始) · [Packaging & Release](#打包与发布) · [Project Layout](#项目结构)
- [Settings & Data Storage](#应用设置与数据存储) · [Plugin System](#插件系统) · [Versioning & Release Policy](#版本与发布政策) · [FAQ](#常见问题)

---

## 功能总览

应用基于下列流程组织运行，对应侧边栏的四个工作模块：

**EN — Features Overview.** The app is organised around the following pipeline, corresponding to the four working modules in the sidebar:

### 1. 源文件比对（Scan）

- 检查相机原片（RAW）与 JPG 预览：文件名同名配对、数量一致性校验
- 自动生成「多余 / 缺失 / 后缀异常 / 重复」文件清单，并统计各格式占比
- 比对通过后方可进入下一阶段，保证您的项目完整性

**EN — Scan.**

- Checks camera originals (RAW) against JPG previews: filename pairing and count consistency verification.
- Automatically produces an issue list of *surplus / missing / bad-extension / duplicate* files, with per-format statistics.
- The next stage unlocks only after the comparison passes, keeping your project integrity intact.

### 2. 筛选照片（Select）

- 配对通过的照片以平铺缩略图视图展示，点击放大查看细节与 EXIF 拍摄参数（机身、镜头、ISO、快门、光圈、焦距等）
- 选定照片成对写入「入选照片」目录（CHO），目前支持复制或移动两种入库方式，完成成片迁移

**EN — Select.**

- Paired photos are shown in a tiled thumbnail grid; click to zoom in and inspect details plus EXIF capture parameters (body, lens, ISO, shutter, aperture, focal length, etc.).
- Picked photos are written as RAW+JPG pairs into the CHO ("picked") directory, via copy or move, completing the ingest transfer.

### 3. 精修照片（Retouch）

- 每轮最多挂起 10 张入选照片，一键在 Photoshop（Camera Raw）或 Lightroom 中打开（自动检测安装路径，也可手动指定）
- 调整完成的成品放回「精修成片」目录（EDP），「检验导出」自动核对数量无遗漏
- 另有**内置显影编辑器**：无需外部软件即可完成曝光 / 对比度 / 高光 / 阴影 / 色温 / 饱和度 / 清晰度 / 锐化 / 暗角等调整与旋转翻转，调整参数以 XML 形式随成片保存在 EDP 目录，可随时回溯继续调整

**EN — Retouch.**

- Suspend up to 10 picked photos per round and open them in one click in Photoshop (Camera Raw) or Lightroom (install paths are auto-detected, or can be set manually).
- Finished results go back into the EDP ("edited") directory; "Verify Export" automatically confirms that nothing is missing.
- A **built-in develop editor** is also included: exposure / contrast / highlights / shadows / temperature / saturation / clarity / sharpening / vignette adjustments plus rotation & flipping — no external software required. Adjustments are stored as XML next to the result in EDP and can be revisited at any time.

### 4. 水印与导出（Frame）

- 在成片上下扩展色块并添加版权文字，留白高度、色块颜色、字体（读取系统字体）、字号、对齐、透明度、位置均可自由设定
- 样式一次性设定后可整批套用，画布实时预览
- 导出文件按「原文件名 + END」规则命名并自动去重，统一归入「最终成品」目录（END）

**EN — Frame.**

- Extends finished images with colour bars on top/bottom and adds copyright text; padding height, bar colour, font (system fonts), size, alignment, opacity and position are all freely configurable.
- Once the style is set it can be applied to the whole batch, with live canvas preview.
- Exports follow the "original name + END" rule with automatic de-duplication, and are filed into the END ("final") directory.

### 通用能力（该部分仅在较大版本更新时发生变更，限于篇幅无法展示全部通用能力，请您谅解）

- **主题系统**：6 套主题（专业深色 / 石墨灰 / 明亮浅色 / 冷调蓝灰 / 炉火暖棕 / 紫罗兰夜），支持自定义背景图（按窗口比例裁切，透明度 / 模糊可调）
- **分页与布局**：网格视图分页数量可调（0 为不分页），侧边栏可切换紧凑密度
- **驱动器监测**：识别固定磁盘 / 可移动磁盘 / 网络盘，外接盘工作时给出拔盘提醒
- **缓存管理**：缩略图与预览图派生缓存自动清理（超过 2 万张时按最旧优先淘汰一半），可在设置中查看占用并手动清空

**EN — General capabilities** *(this section only changes on major updates; not every capability is listed for brevity)*

- **Themes**: 6 themes (Professional Dark / Graphite / Light / Nord / Ember / Violet), with a custom background image (cropped to the window ratio; opacity & blur adjustable).
- **Pagination & layout**: adjustable grid page size (0 = no pagination); the sidebar supports a compact density.
- **Drive monitoring**: distinguishes fixed / removable / network drives and warns before an external drive is unplugged mid-work.
- **Cache management**: derived thumbnail & preview caches are pruned automatically (oldest half evicted beyond 20,000 files); usage can be reviewed and cleared in Settings.

---

## 工作区目录结构

在应用内打开（或新建）一个工作区文件夹后，应用会自动建立如下结构：

**EN — Workspace layout.** After opening (or creating) a workspace folder in the app, the following structure is created automatically:

```
<工作区>/
├── RAW/                  # 相机原片（比对来源）
├── JPG/                  # JPG 预览图（比对来源）
├── IMGT/                 # 影像处理主目录
│   ├── CHO/
│   │   ├── RAW/          # 入选照片 · 原片
│   │   └── JPG/          # 入选照片 · 预览
│   ├── EDP/              # 精修成片（含同名 .xml 调整参数）
│   └── END/              # 最终成品（文件名 + END 后缀）
└── .ybirlwu/
    └── session.json      # 工作区会话（入库记录 / 轮次 / 导出历史 / 编辑器路径）
```

```
<workspace>/
├── RAW/                  # Camera originals (comparison source)
├── JPG/                  # JPG previews (comparison source)
├── IMGT/                 # Main imaging directory
│   ├── CHO/
│   │   ├── RAW/          # Picked photos · originals
│   │   └── JPG/          # Picked photos · previews
│   ├── EDP/              # Retouched results (with same-name .xml adjustment params)
│   └── END/              # Final exports (name + END suffix)
└── .ybirlwu/
    └── session.json      # Workspace session (imports / rounds / export history / editor paths)
```

打开已有 `IMGT` 目录时，应用会询问「保留 / 重置」其中的处理数据，避免意料之外的错误变更。

**EN** — When an existing `IMGT` directory is detected, the app asks whether to *keep* or *reset* its processing data, preventing unintended changes.

---

## 支持的文件格式

**EN — Supported file formats**

| 类别 / Category | 格式 / Formats |
| --- | --- |
| RAW 原片 / RAW originals | Nikon NEF/NRW、Canon CR2/CR3/CRW、Sony ARW/SRF/SR2、DNG、Fujifilm RAF、Olympus ORF、Panasonic RW2/RAW、Pentax PEF、Samsung SRW、Leica RWL、Hasselblad 3FR/FFF、Phase One IIQ、Sigma X3F、Leaf MOS、Minolta MRW、Kodak KDC/DCR、Epson ERF、Mamiya MEF |
| 预览 / 成品 / Previews & results | JPG / JPEG / JPE / JFIF、PNG、WEBP、TIFF、BMP |
| 导出格式 / Export | JPEG、PNG |

---

## 技术架构

**EN — Technical architecture**

| 层 / Layer | 技术 / Technology |
| --- | --- |
| 桌面运行时 / Desktop runtime | Electron 45（Chromium + Node.js） |
| 构建 / Build | electron-vite 6 + Vite 7 + Rollup |
| UI | React 19 + TypeScript 5（strict）+ lucide-react |
| 打包 / Packaging | electron-builder 26 |
| 元数据 / Metadata | exifr |

### 进程模型

- **主进程**（`src/main`）：工作区结构管理、文件扫描与配对、入库传输（带进度回调）、轮次与导出会话持久化、系统字体 / 驱动器 / 编辑器检测、派生图缓存等
- **预加载脚本**（`src/preload`）：通过 `contextBridge` 暴露类型安全的 `window.workstation` API，全程 `contextIsolation: true`、`nodeIntegration: false`
- **渲染进程**（`src/renderer`）：React 界面

**EN — Process model**

- **Main process** (`src/main`): workspace structure management, file scanning & pairing, ingest transfer (with progress callbacks), round & export session persistence, system font / drive / editor detection, derived-image cache, etc.
- **Preload script** (`src/preload`): exposes a fully typed `window.workstation` API via `contextBridge`, with `contextIsolation: true` and `nodeIntegration: false` throughout.
- **Renderer** (`src/renderer`): the React UI.

### 自定义协议

图片通过三个注册的特权协议按需读取：

**EN — Custom protocols.** Images are read on demand through three registered privileged protocols:

- `media://` —— 原图（`webSecurity` 保持开启，带 MIME 白名单） / *original images (`webSecurity` kept on, MIME whitelist enforced)*
- `preview://` —— 长边 3072px 的 JPEG 预览（用于放大查看） / *3072px long-edge JPEG preview (for zoomed inspection)*
- `thumb://` —— 长边 640px 的 JPEG 缩略图（网格视图） / *640px long-edge JPEG thumbnail (grid view)*

---

## 快速开始

**EN — Getting started**

### 环境要求

- Windows 10 / 11（x64）
- Node.js ≥ 20（建议 LTS）
- npm（随 Node 安装）
- 可选：Adobe Photoshop 和 / 或 Lightroom（精修阶段的外部编辑器）

**EN — Requirements**

- Windows 10 / 11 (x64)
- Node.js ≥ 20 (LTS recommended)
- npm (ships with Node)
- Optional: Adobe Photoshop and/or Lightroom (external editors for the retouch stage)

### 本地开发

```bash
# 安装依赖
npm install

# 以开发模式启动（主进程热重载 + 渲染进程 HMR）
npm run dev

# 类型检查
npm run typecheck

# 仅编译（不打包安装器）
npm run build

# 以预览模式运行已编译产物
npm run start
```

```
# Install dependencies
npm install

# Start in development mode (main-process hot reload + renderer HMR)
npm run dev

# Type checking
npm run typecheck

# Compile only (no installer)
npm run build

# Run the compiled output in preview mode
npm run start
```

> 演示模式：渲染进程内置 Mock API，无需照片即可在浏览器中预览界面。
> 以 `?demo=scan` / `demo=select` / `demo=retouch` / `demo=frame` / `demo=settings` 查询参数访问渲染页即可。

> **EN — Demo mode**: the renderer ships with a mock API so the UI can be previewed in a browser without any photos. Open the renderer page with query params `?demo=scan` / `demo=select` / `demo=retouch` / `demo=frame` / `demo=settings`.

> 面向中国大陆地区开发者
> 考虑到中国大陆地区较差的网络环境，在编译和二次开发过程中可能产生共性问题，我们为您提供经过开发团队核验的补丁和修复方案，详情请查看 [《Build Notes for Chinese Mainland》](./Build%20Notes%20for%20Chinese%20Mainland.md) 文档

> **EN — For developers in the Chinese mainland**: given the network conditions there, compilation and secondary development may hit recurring issues. Verified patches and fixes are provided in the [Build Notes for Chinese Mainland](./Build%20Notes%20for%20Chinese%20Mainland.md) document.

---

## 打包与发布

**EN — Packaging & release**

```bash
# 编译 + 生成 Windows x64 NSIS 安装包 / Compile + build the Windows x64 NSIS installer
npm run dist
```

- 产物输出至项目根目录 `release/`，形如
  `YbirLWU Photograph Workstation Setup <version>-<构建后缀>.exe`（附 `.exe.blockmap` 增量校验文件）。
- 安装包外观资源（图标、安装页位图、中文许可协议、安装向导文案）位于 `build/` 目录：
  - `build/icon.ico` —— 应用与安装包图标
  - `build/installerHeader.bmp` / `installerSidebar.bmp` / `uninstallerSidebar.bmp` —— 安装/卸载向导位图
  - `build/license_zh_CN.rtf` —— 中文许可协议
  - `build/installer.nsh` —— NSIS 自定义页面文案（欢迎页 / 完成页 / 卸载页）
  - `build/tools/` —— 资源再生成脚本（`make-installer-assets.ps1`、`make-license-rtf.cjs`）
- 版本号、构建后缀、发布通道（Latest / LTS）与 Release 产物要求遵循仓库根目录的
  **《Versioning & Release Policy DOC-V1.0.0》**，提交 PR 或发布 Release 前请先阅读该文档。

**EN**

- Artifacts are written to `release/` at the project root, named
  `YbirLWU Photograph Workstation Setup <version>-<build code>.exe` (plus a `.exe.blockmap` delta-verification file).
- Installer appearance assets (icon, wizard bitmaps, Chinese license, wizard copy) live in `build/`:
  - `build/icon.ico` — application & installer icon
  - `build/installerHeader.bmp` / `installerSidebar.bmp` / `uninstallerSidebar.bmp` — install/uninstall wizard bitmaps
  - `build/license_zh_CN.rtf` — Chinese license agreement
  - `build/installer.nsh` — NSIS custom page copy (welcome / finish / uninstall pages)
  - `build/tools/` — asset regeneration scripts (`make-installer-assets.ps1`, `make-license-rtf.cjs`)
- Versioning, build codes, release channels (Latest / LTS) and release artifact requirements follow **《Versioning & Release Policy DOC-V1.0.0》** at the repository root — please read it before submitting PRs or publishing releases.
- The build code is resolved automatically: `npm run dist` produces an `NS` (NSIS release) code, while `npm run dev` / `npm run build` produce an `OO` (dev hot-compile) code, so every running state displays the appropriate build code. `YPW_BUILD_CHANNEL` / `YPW_BUILD_DATE` / `YPW_BUILD_SEQ` / `YPW_BUILD_CODE` environment variables can override it.

> 提示：若 `npm run dist` 在 NSIS 阶段报 `cannot find specified resource "build/icon.ico"` 或
> `warning 6030: LicenseLangString "MUILicense" set multiple times`，请检查 `build/` 目录是否完整、
> 是否同时存在多份 license 文件（如 `.rtf` 与 `.txt` 并存）——package.json 中已显式指定唯一的
> `nsis.license`，新增许可文件时请保持单一来源，在面向社会发放的程序版本中，我们将采用`.rtf`封装。

> **EN — Tip**: if `npm run dist` fails at the NSIS stage with `cannot find specified resource "build/icon.ico"` or `warning 6030: LicenseLangString "MUILicense" set multiple times`, check that the `build/` directory is complete and that no duplicate license files exist (e.g. a `.rtf` alongside a `.txt`). `package.json` pins a single `nsis.license`; keep a single source of truth when adding license files. Public releases are packaged with the `.rtf` license.

---

## 项目结构

**EN — Project layout**

```
.
├── build/                     # 打包资源（图标 / 位图 / 许可 / NSIS 扩展 / 资源脚本）
├── release/                   # electron-builder 输出（gitignore）
├── resources/                 # 随包分发的静态资源
├── src/
│   ├── main/                  # Electron 主进程
│   │   ├── index.ts           # 窗口、IPC、协议注册、应用生命周期
│   │   └── lib/               # 业务库（扫描 / 工作区 / 入库 / 会话 / 命名 / 编辑 /
│   │                          #   EXIF / 尺寸 / 字体 / 驱动器 / 编辑器检测 / 设置 /
│   │                          #   缓存与协议 / 文件系统工具 / 插件加载）
│   ├── preload/
│   │   └── index.ts           # contextBridge API 暴露
│   ├── renderer/
│   │   ├── index.html
│   │   └── src/
│   │       ├── App.tsx        # 应用骨架（路由 / 全局状态 / Toast）
│   │       ├── components/    # 通用组件（标题栏 / 侧边栏 / 查看器 / 直方图 /
│   │       │                  #   内置编辑器 / 设置面板 / 起始页 …）
│   │       ├── modules/       # 四大工作模块（scan / select / retouch / frame）
│   │       ├── lib/           # 桥接 / 主题 / 格式化 / 配对 / 水印布局 / 显影参数
│   │       └── styles/app.css # 主题变量与全局样式
│   └── shared/                # 主 / 渲染共享：API 契约、类型、媒体格式表、显影参数
├── electron.vite.config.ts
├── tsconfig.json
├── package.json
└── Versioning & Release Policy DOC-V1.0.0.md
```

```
.
├── build/                     # Packaging assets (icon / bitmaps / license / NSIS extension / scripts)
├── release/                   # electron-builder output (gitignored)
├── resources/                 # Static resources shipped with the app
├── src/
│   ├── main/                  # Electron main process
│   │   ├── index.ts           # Windows, IPC, protocol registration, app lifecycle
│   │   └── lib/               # Domain libraries (scan / workspace / ingest / session /
│   │                          #   naming / edits / EXIF / dims / fonts / drives /
│   │                          #   editor detection / settings / cache & protocols / fs utils / plugins)
│   ├── preload/
│   │   └── index.ts           # contextBridge API exposure
│   ├── renderer/
│   │   ├── index.html
│   │   └── src/
│   │       ├── App.tsx        # App shell (routing / global state / toasts)
│   │       ├── components/    # Shared components (title bar / sidebar / viewer /
│   │       │                  #   histogram / built-in editor / settings panel / start page …)
│   │       ├── modules/       # The four working modules (scan / select / retouch / frame)
│   │       ├── lib/           # Bridge / theme / formatting / pairing / watermark layout / develop params
│   │       └── styles/app.css # Theme variables & global styles
│   └── shared/                # Shared by main & renderer: API contract, types, media formats, develop params
├── electron.vite.config.ts
├── tsconfig.json
├── package.json
└── Versioning & Release Policy DOC-V1.0.0.md
```

路径别名：`@shared/*` → `src/shared/*`，`@/*` → `src/renderer/src/*`。

**EN** — Path aliases: `@shared/*` → `src/shared/*`, `@/*` → `src/renderer/src/*`.

---

## 应用设置与数据存储

应用数据均位于系统用户数据目录（`%APPDATA%/ybirlwu-workstation/`，插件文件夹可在「设置 → 插件」中一键打开）：

**EN — Settings & data storage.** Application data lives under the system user-data directory (`%APPDATA%/ybirlwu-workstation/`; the plugins folder can be opened in one click from *Settings → 插件*):

| 路径 / Path | 内容 / Contents |
| --- | --- |
| `settings.json` | 主题 / 背景 / 分页 / 开发者模式等全局设置 / theme, background, paging, developer mode and other global settings |
| `theme/background.jpg` | 自定义背景图 / custom background image |
| `image-cache/` | 缩略图与预览图派生缓存（自动清理，可手动清空） / derived thumbnail & preview cache (auto-pruned, manually clearable) |
| `plugins/` | 用户插件（每个插件一个文件夹，含 `plugin.json`） / user plugins (one folder per plugin, containing `plugin.json`) |

工作区内的业务数据（入选、精修、成品、会话记录）只存在于工作区文件夹中，卸载应用不会删除。

**EN** — Business data inside a workspace (picks, retouch results, exports, session records) exists only in the workspace folder and survives uninstalling the app.

---

## 插件系统

> 插件功能目前处于内部测试阶段，行为可能随版本调整，请谨慎使用。插件异常会被单独捕获，不影响应用本体。

**EN — Plugin system.** *Plugins are currently in internal beta; behaviour may change between versions — use with care. Plugin exceptions are caught in isolation and never take down the app.*

在 `<用户数据目录>/plugins/<插件 id>/` 放入 `plugin.json` 与入口脚本即可加载：

**EN** — Drop a `plugin.json` plus an entry script into `<user data dir>/plugins/<plugin id>/` to load a plugin:

```json
{
  "id": "my-plugin",
  "name": "示例插件 / Example plugin",
  "version": "1.0.0",
  "main": "index.js",
  "hooks": ["export:after"]
}
```

入口脚本导出 `activate(context)`，通过 `context.on(hook, handler)` 订阅钩子，`context.log()` 输出日志。

**EN** — The entry script exports `activate(context)`; subscribe to hooks via `context.on(hook, handler)` and write logs via `context.log()`.

可用钩子 / Available hooks:

| 钩子 / Hook | 触发时机 / Trigger |
| --- | --- |
| `workspace:opened` | 工作区打开完成 / workspace opened |
| `import:after` | 选片入库完成 / pick import finished |
| `round:verified` | 精修轮次校验完成 / retouch round verified |
| `export:after` | 水印导出完成 / watermark export finished |
| `edit:saved` | 内置编辑器保存成片 / built-in editor saved a result |

---

## 版本与发布政策

本项目遵循语义化版本（SemVer 2.0.0）与独立的构建后缀规范：

- 版本号 `V<Major>.<Minor>.<Patch>`：Major 对应不兼容的架构 / 工作区结构变更，Minor 对应向下兼容的新功能（必须附 Release Notes），Patch 对应缺陷修复与细节优化。
- 安装包文件名携带内部构建后缀（打包方法 + `YYMMDD` 日期 + 当日构建序号），用于内部追踪，与用户侧展示的版本号隔离。
- 正式发布仅提供 NSIS 安装包 + `blockmap` + `.sha256` 校验 + 双语 Release Notes；未就绪的代码停留在 `dev` 分支，不打 `alpha/beta/rc` 后缀。

详见 [《Versioning & Release Policy DOC-V1.0.0》](./Versioning%20&%20Release%20Policy%20DOC-V1.0.0.md)。

**EN — Versioning & release policy.** This project follows Semantic Versioning (SemVer 2.0.0) plus a dedicated build-suffix scheme:

- Version `V<Major>.<Minor>.<Patch>`: Major for incompatible architecture / workspace-structure changes; Minor for backward-compatible new features (Release Notes required); Patch for bug fixes and refinements.
- Installer filenames carry an internal build code (packaging method + `YYMMDD` date + same-day build sequence) for internal tracking, kept separate from the user-facing version number. In the app UI the code is injected at compile time — `NS…` for NSIS release builds (`npm run dist`) and `OO…` for dev hot-compile builds — so every running state displays the appropriate build code.
- Official releases ship only an NSIS installer + `blockmap` + `.sha256` checksum + bilingual Release Notes; code that is not ready stays on the `dev` branch without `alpha/beta/rc` suffixes.

See [《Versioning & Release Policy DOC-V1.0.0》](./Versioning%20&%20Release%20Policy%20DOC-V1.0.0.md) for details.

---

## 常见问题

**EN — FAQ**

**Q：必须安装 Photoshop / Lightroom 吗？**
不需要。精修阶段会自动检测已安装的 PS / LR 并挂起打开；未安装时可使用内置显影编辑器完成基础调整与导出。

**Q — Is Photoshop / Lightroom required?**
No. The retouch stage auto-detects an installed PS / LR and opens the suspended round there; without them, the built-in develop editor covers basic adjustments and export.

**Q：应用会联网吗？**
不会。所有扫描、入库、精修、导出均在本地完成，应用不包含任何网络上传能力。

**Q — Does the app go online?**
No. Scanning, ingest, retouching and exporting are all local; the app contains no network upload capability.

**Q：误开了旧工作区，IMGT 里的数据会被覆盖吗？**
不会静默覆盖。检测到 IMGT 中已有处理数据时，应用会先询问「保留」还是「重置」，重置仅清空 CHO / EDP / END 及会话记录，RAW 与 JPG 原始目录不动。

**Q — If I open an old workspace by mistake, will data inside IMGT be overwritten?**
Never silently. When existing processing data is detected in IMGT, the app asks whether to *keep* or *reset*. Resetting only clears CHO / EDP / END and the session record; the RAW and JPG source directories are untouched.

**Q：RAW 缩略图显示异常或方向不对？**
应用按 EXIF Orientation 处理竖拍方向；若个别机型仍异常，可尝试「设置 → 清空缓存」后重新生成。

**Q — RAW thumbnails look wrong or mis-rotated?**
Orientation follows EXIF Orientation. If a specific body still misbehaves, clear the cache in *Settings → 清空缓存* and let it regenerate.

**Q：安装包报毒 / SmartScreen 拦截？**
项目当前未做代码签名，首次运行可能被 SmartScreen 提示，选择「仍要运行」即可；请务必从官方 Release 页下载并核对 `.sha256` 校验码。

**Q — Antivirus flags the installer / SmartScreen blocks it?**
The project is not code-signed yet, so SmartScreen may warn on first run — choose "Run anyway". Always download from the official Release page and verify the `.sha256` checksum.

---

**EN** — Q: `npm run dev` / `npm run dist` fails with download or Electron installation errors under mainland-China networks?
A: See [Build Notes for Chinese Mainland](./Build%20Notes%20for%20Chinese%20Mainland.md) — switch to the npmmirror (Taobao) mirrors via `.npmrc`, and re-run `node node_modules/electron/install.js` if Electron was left half-installed in `node_modules`.

---

Copyright © 2026 YbirLWU. 保留所有权利。 / All rights reserved.
