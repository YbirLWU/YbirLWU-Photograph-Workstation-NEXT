# 中国大陆地区构建与安装排障指南（Build Notes for Chinese Mainland）

> 适用版本：v1.0.0 NS261113P1 · Windows 10/11 x64 · Node.js ≥ 20
> 本文档汇总中国大陆地区网络环境下编译、二次开发时的高频共性问题与经开发团队核验的修复方案。
>
> Applies to v1.0.0 NS261113P1. This document lists common build issues observed under network conditions in the Chinese mainland, together with verified fixes.

---

## 问题一：依赖与二进制包下载缓慢、丢包，导致 `npm run dev` / `npm run dist` 失败

### 现象 / Symptoms

- `npm install` 阶段进度缓慢，长时间停留在 `fetch` / `extract`，或中途报 `ECONNRESET`、`ETIMEDOUT`、`socket hang up`。
- `npm run dev` / `npm run dist` 阶段下载 **Electron 运行时**与 **electron-builder 的 NSIS / winCodeSign 等二进制包**时同样缓慢，易出现丢包并直接失败（`RequestError`、`Download limit exceeded`、ZIP 校验失败等）。
- 失败具有一定的随机性：重试有时能过，有时卡在同一位置。

### 原因

Electron 与 electron-builder 的二进制包默认托管在 GitHub Releases 与国外 CDN 上。这些静态资源体积大（Electron 运行时约 100MB+），跨境链路易丢包，npm 官方源本身在国内访问也不稳定。

### 修复：切换到国内镜像（淘宝 / npmmirror）

在**项目根目录**新建（或编辑）`.npmrc` 文件，写入以下内容：

```ini
registry=https://registry.npmmirror.com
electron_mirror=https://npmmirror.com/mirrors/electron/
electron_builder_binaries_mirror=https://npmmirror.com/mirrors/electron-builder-binaries/
```

三行分别作用：

| 配置项 | 作用 |
| --- | --- |
| `registry` | npm 包本体（含 electron-vite、vite、react 等）改走 npmmirror |
| `electron_mirror` | `electron` 包的 postinstall 阶段下载 Electron 运行时 ZIP 改走国内镜像 |
| `electron_builder_binaries_mirror` | `electron-builder` 打包阶段下载 NSIS、winCodeSign 等工具改走国内镜像 |

然后重新安装依赖：

```bash
# 若此前安装失败，先清理半成品再装
rm -rf node_modules
npm install
```

> 也可以只对单次命令生效：`npm install --registry=https://registry.npmmirror.com`；
> 或对当前终端会话生效：`set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`（cmd）
> / `$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"`（PowerShell）。

> 该方案已由开发团队在实际中国大陆网络环境下核验。镜像地址随上游同步存在分钟级延迟，如确需最新构建可临时取消镜像。

---

## 问题二：Electron 安装到 `node_modules` 后读取异常

### 现象 / Symptoms

- `npm install` 表面成功，但 `npm run dev` 启动时报类似
  `Electron failed to install correctly, please delete node_modules/electron and try installing again`；
- 或 `npm run dist` 阶段报找不到 Electron 发行包、`path.txt` / `dist.txt` 缺失、`EBADPLATFORM` 之外的异常错误；
- `node_modules/electron/dist/` 目录缺失或为空，但 `node_modules/electron/` 下其余文件齐全。

### 原因与性质说明

`electron` 包安装时的 postinstall 脚本负责下载并解压 Electron 运行时。该步骤与问题一同源：下载被中断（丢包 / 超时 / 代理干扰）后，安装脚本没有把 `path.txt` 与 `dist/` 写完整，后续任何阶段读取 Electron 都会失败。**目前无法确认是否为中国大陆地区独有错误，从现有证据看大概率由网络引起**；只要补齐被中断的安装步骤即可恢复。

### 修复：手动执行 install.js

```bash
# 1. 确认 .npmrc 已按「问题一」配置好镜像（否则手动安装同样会卡在下载）
# 2. 手动补跑 Electron 的安装脚本
node node_modules/electron/install.js

# 3. 验证：以下命令应输出 electron 可执行文件的路径而不是报错
node -e "console.log(require('electron'))"
# 预期输出形如：
#   D:\...\YbirLWU-WorkStation-MainWorkspace\node_modules\electron\dist\electron.exe

# 4. 确认 node_modules/electron/dist/electron.exe 存在后，重试构建
npm run dev    # 热编译调试
npm run dist   # NSIS 打包
```

> 若 `install.js` 仍卡在下载，删除 `node_modules/electron` 后回到问题一检查镜像配置，再 `npm install` 重装。

### 仍未解决时

1. 携带完整报错日志重试：`npm run dist -- --config.electronDownload.timeout=600000`；
2. 检查代理 / 安全软件是否拦截了对 `npmmirror.com` 的请求；
3. 在 GitHub Issue 中反馈，并附上 `npm --version`、`node -v`、`.npmrc` 内容（隐去个人信息）与完整报错栈。

---

## 快速自检清单（Checklist）

| 步骤 | 命令 / 检查点 | 预期结果 |
| --- | --- | --- |
| 1 | 根目录存在 `.npmrc` 且含三行镜像配置 | 内容与本页一致 |
| 2 | `npm install` | 无 ECONNRESET / ETIMEDOUT |
| 3 | `node node_modules/electron/install.js` | 正常退出，无报错 |
| 4 | `node -e "console.log(require('electron'))"` | 输出 `...\node_modules\electron\dist\electron.exe` |
| 5 | `npm run dev` | 应用启动，标题栏显示 `v1.0.0 OO<日期>P<序号>` |
| 6 | `npm run dist` | `release/` 生成 `Setup <version>-<构建编码>.exe` |
