# YPW-N 版本控制与发布政策 (Versioning & Release Policy) DOC-V1.0.0

本政策适用于 `YbirLWU-Photograph-Workstation-Next` 及后续所有迭代版本。
YPW-N 遵循 语义化版本控制（Semantic Versioning 2.0.0） 规范，并结合独立软件的开源分发策略进行定制，所有参与本软件开发和调试的工作人员在涉及PR或其余面向社区开放的源代码变更和重构时均需遵循此政策。

This policy applies to `YbirLWU-Photograph-Workstation-Next` and all subsequent iterative versions.
YPW-N follows the Semantic Versioning 2.0.0 specification and is customized with open-source distribution strategies for independent software. All personnel involved in the development and debugging of this software must comply with this policy when handling PRs or any other community-facing source code changes and refactoring.

## 一、 版本号命名规范 (SemVer)
## 1. Semantic Versioning (SemVer)

YPW-N 版本号格式统一为：**`V<Major>.<Minor>.<Patch>`**
The version number format for YPW-N is unified as: **`V<Major>.<Minor>.<Patch>`**

*   **Major（主版本号）**：发生**不兼容的 API 变更**、底层架构变更、工作区目录结构及其他软件基本算法或流程发生根本性改变时递增。
    *   *示例：`V1.0.0` -> `V2.0.0`*
*   **Major**: Incremented when there are **incompatible API changes**, underlying architecture changes, workspace directory structure changes, or fundamental changes to the software's basic algorithms or workflows.
    *   *Example: `V1.0.0` -> `V2.0.0`*

*   **Minor（次版本号）**：发生**向下兼容的功能性新增**、每次 Minor 更新必须伴随详细的 Release Notes。
    *   *示例：`V1.0.0` -> `V1.1.0`*
*   **Minor**: Incremented for **backward-compatible functional additions**. Every Minor update must be accompanied by detailed Release Notes.
    *   *Example: `V1.0.0` -> `V1.1.0`*

*   **Patch（修订号）**：发生**向下兼容的 Bug 修复**、性能优化、UI 细节微调。不包含任何新功能。
    *   *示例：`V1.0.0` -> `V1.0.1`*
*   **Patch**: Incremented for **backward-compatible bug fixes**, performance optimizations, and minor UI tweaks. Contains no new features.
    *   *Example: `V1.0.0` -> `V1.0.1`*

> **注：** 正式发行版 **不允许** 以 `alpha`、`beta`、`rc` 等作为后缀标识。未准备好发布的代码将停留在 `dev` 分支，当标识为 `Tag` 并通过 CI ，即为正式版。
> **Note:** Official releases **must not** use suffixes such as `alpha`, `beta`, `rc`, etc. Code that is not ready for release should remain in the `dev` branch. Once tagged and passing CI, it is considered an official release.
>  
## 二、 构建后缀规范 (Build Suffix)
## 2. Build Suffix Policy

为了保证开发团队内部追踪与用户侧展示的绝对隔离，安装包文件名将包含内部构建后缀。
To ensure absolute isolation between internal tracking for the development team and user-facing presentation, installer filenames will include an internal build suffix.

*  **打包方法 `<Method>` (第 1-2 位)**
    *   `NS`：NSIS 安装包（正式发布产物）
    *   `OS`：其他打包方案（如 MSI、Portable 绿色版等）
    *   `OO`：DEV 热编译版（用于本地开发调试，严禁在 Release 中发布）
*  **Packaging Method `<Method>` (Characters 1-2)**
    *   `NS`: NSIS installer (Official release artifact)
    *   `OS`: Other packaging solutions (e.g., MSI, Portable version, etc.)
    *   `OO`: DEV hot-compile version (For local development and debugging, strictly prohibited in Releases)

*  **打包日期 `<Date>` (第 3-8 位)**
    *   采用 `YYMMDD` 格式（如 2026 年 11 月 12 日 即为 `261112`）
*  **Build Date `<Date>` (Characters 3-8)**
    *   Uses the `YYMMDD` format (e.g., November 12, 2026 is `261112`)

*  **编译版本 `<BuildNum>` (第 9-10 位)**
    *   格式为 `P` + 数字
    *   代表当日内基于该日期方案的构建序列号（如 `P1` 表示当天第一个编译序列版本，`P3` 表示当天第三个编译序列版本）
*  **Build Number `<BuildNum>` (Characters 9-10)**
    *   Format is `P` + number
    *   Represents the build sequence number for that date (e.g., `P1` for the first build of the day, `P3` for the third build of the day)


> **注：** 软件README文档以及其他不针对特定构建版本的描述可能采用“--”对打包方法部分进行占位描述，例如“--261112P1”。
> **Note:** The software README documentation and other descriptions not specific to a particular build version may use "--" as a placeholder in the packaging method section, for example, "--261112P1".

## 三、 发布通道与生命周期 (Release Channels)
## 3. Release Channels & Lifecycle

YPW-N 将维护两条明确的发布通道：
YPW-N maintains two distinct release channels:

### 1. Latest 通道（最新特性版）
### 1. Latest Channel (Newest Features)
*   指代当前最新的正式发布版本（如 `V1.0.1`）
*   **受众**：开发者用户、愿意体验新功能的摄影师、开源贡献者
*   **承诺**：包含最新的软件特性，但不保证完全没有边缘 Bug
*   Refers to the current latest official release (e.g., `V1.0.1`)
*   **Audience**: Developer users, photographers willing to experience new features, open-source contributors
*   **Commitment**: Contains the latest software features, but does not guarantee the complete absence of edge-case bugs

### 2. LTS 通道（长期支持版）
### 2. LTS Channel (Long-Term Support)
*   指代经过长期考验的稳定版本（如 `V1.0.0 LTS`）
*   **受众**：商业工作室、DIT 团队、求稳的生产力用户
*   **承诺**：稳定，LTS 版本只接收致命 Bug 的安全修复（Patch 更新），不添加任何新功能
*   Refers to long-term tested stable versions (e.g., `V1.0.0 LTS`)
*   **Audience**: Commercial studios, DIT teams, productivity users seeking stability
*   **Commitment**: Stable. LTS versions only receive security fixes for critical bugs (Patch updates) and do not add any new features

当Latest版本经过市场广泛测验论证确认稳定性后，YPW-N 团队将对原有的LTS版本进行替换以保证新特性的及时启用。
When a Latest version is thoroughly market-tested and proven stable, the YPW-N team will replace the existing LTS version to ensure the timely adoption of new features.

## 四、 发布标准与产物要求 (Release Artifacts)
## 4. Release Standards & Artifact Requirements

每一个正式版本的发布（在 GitHub 创建 Release 时），必须严格包含以下内容：
Every official version release (when creating a Release on GitHub) must strictly include the following:

*  **唯一的安装包**：只提供 `NSIS` 格式的 `.exe` 安装包。
*  **校验文件**：必须提供 `.exe` 对应的 `blockmap` 以及 `.sha256` 校验码，确保安装包未被篡改。
*  **代码快照**：GitHub 必须自动提供 `Source code (zip)` 和 `Source code (tar.gz)`。确保该源码包下载后可以直接通过 `npm run dist` 成功构建。
*  **Release Notes（更新说明）**：包含中英双语，明确列出 `Added`（新增）、`Changed`（修改）、`Fixed`（修复）以及 `Known Limitations`（已知限制）。
*  **Unique Installer**: Only provide the `NSIS` format `.exe` installer.
*  **Verification Files**: Must provide the corresponding `blockmap` and `.sha256` checksum for the `.exe` to ensure the installer has not been tampered with.
*  **Code Snapshots**: GitHub must automatically provide `Source code (zip)` and `Source code (tar.gz)`. Ensure that this source code package can be successfully built directly via `npm run dist` after download.
*  **Release Notes**: Bilingual in Chinese and English, explicitly listing `Added`, `Changed`, `Fixed`, and `Known Limitations`.

## 五、 废弃与安全策略 (Deprecation)
## 5. Deprecation & Security Policy

*   当发布新的 Major 版本时，旧的 Major 版本将进入维护期。
*   旧版本的维护期最长为 **6 个月**，在此期间仅提供安全修补。6 个月后，将在仓库中标记为 `Deprecated`，并建议用户升级。
*   When a new Major version is released, the old Major version enters its maintenance period.
*   The maintenance period for old versions is a maximum of **6 months**, during which only security patches are provided. After 6 months, it will be marked as `Deprecated` in the repository, and users will be advised to upgrade.

## 六、 修订与留痕
## 6. Revision & Record

YbirLWU 修定于 2026年11月12日
Revised by YbirLWU on November 12, 2026