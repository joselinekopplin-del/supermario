# 苔光远行 · Mosslight

一款原创 2D 横版平台冒险网页游戏。戴着叶芽兜帽的探险家穿过阳光草原、地下洞穴和天空城堡，点亮苔光灯，把光带回云海。使用 Phaser 3、TypeScript、Vite 和 Web Audio API；像素角色、场景、特效与复古配乐均由代码原创绘制或合成，无商业素材、外部字体或音频下载依赖。

本轮体验升级保留三关与原有存档，优化转向、短按跳跃、镜头前瞻和重试流程。完整问题、量化对比、实际测试与限制见 [游戏体验优化报告](游戏体验优化报告.md)。

报告引用的完整基线、日志和测试截图保留在本地 `artifacts/`，可按报告中的命令重新生成；公开仓库仅附菜单和终点展示图。

在线试玩：[苔光远行 · Mosslight](https://joselinekopplin-del.github.io/supermario/)。源码仓库：[joselinekopplin-del/supermario](https://github.com/joselinekopplin-del/supermario)。

## 本地运行

安装 Node.js 22.12+（或 24 LTS），在 Windows PowerShell、终端或其他系统的 shell 中执行：

```sh
npm ci
npm run dev
```

打开终端显示的本地网址。开发时修改源文件会自动刷新。生产构建和预览：

```sh
npm run build
npm run preview
```

`dist/` 是完整的静态站点，不需要后端。请通过 HTTP 服务器访问，而不是双击 `index.html`。

## 操作与玩法

| 操作 | 桌面键盘 |
| --- | --- |
| 向左 / 向右 | A / D 或 ← / → |
| 跳跃 | 空格、W 或 ↑ |
| 加速奔跑 | 按住 Shift |
| 暂停 / 继续 | Esc |
| 重开当前关卡 | R |

手机和平板提供方向、跳跃及奔跑触摸按钮；横屏游玩视野更好。短按跳跃低跳，长按跳跃高跳；平台边缘有短暂的宽容时间，落地前按跳跃也能接上下一跳。金币轨迹提示起跳位置。从上方踩踏敌人可以反弹，侧面碰撞会受伤。金色方块藏有奖励，砖块可以破坏，发光叶片提供强化。沿途苔光灯是检查点；跌入深坑后从已点亮的灯附近继续。每关有一条清晰主路和高处的可选探索奖励。

三关分别引入基础操作、移动石台与晶刺、连续浮岛和复杂敌人组合。主线跳跃间隙为 100–140 像素，所有必经上升台阶不高于 40 像素。高处秘密路线由 60 像素台阶组成，无须强制收集即可通关。敌人包括地面巡逻甲虫、弹跳生物和飞行生物。

音乐与音效音量可分别调整；浏览器要求玩家首次点击后才启动声音。菜单提供关卡选择、操作说明、设置和最佳成绩。存档保存在当前浏览器、当前站点的 `localStorage` 中，包括解锁进度、每关记录和声音设置；无登录、无上传。清除浏览器站点数据会清除该设备存档。

设置中新增「屏幕震动」「减少动态效果」「粒子与环境细节」；精简模式隐藏部分环境装饰并减少粒子，减少动态同时弱化闪烁、关闭形变与震动。设置即时生效并自动保存，旧 `mosslight-save-v1` 进度会自动补充新设置。暂停时音乐和动画停止，恢复时继续音乐节拍；失败界面说明原因和实际复活位置，可直接按 Enter 重试。

HUD 增加检查点、旅程进度、护盾剩余秒数及短暂无敌提示。关卡卡片显示已完成状态和最快时间。手机横屏采用两侧触控区，竖屏保留独立操作空间，支持多指同时移动、疾跑和跳跃。

## 工程结构

```text
src/
  main.ts                    启动、场景与 UI 协调
  game/
    config.ts                集中调整游戏参数
    art/                     原创纹理与多层视差背景
    audio/                   Web Audio 音乐和音效
    effects/                 有上限的粒子与角色动作反馈
    entities/                玩家及敌人行为
    levels/                  关卡类型及三关手工布局
    physics/                 移动、跳跃和碰撞参数
    scenes/                  游戏世界生命周期
    systems/                 输入边沿、镜头跟随、本地存档
  ui/                        DOM 菜单、HUD、移动触控及样式
tests/                       实际自动化验证
.github/workflows/deploy.yml GitHub Pages 构建部署
```

修改关卡请从 `src/game/levels/index.ts` 开始。平台矩形使用左上角坐标；玩家、敌人、金币、方块使用中心坐标；终点和检查点使用底部中心坐标。带 `move` 的平台按指定轴、距离与毫秒周期往返。美术生成不参与物理碰撞，场景重启时清理对象与事件。

## 测试

```sh
npm run test:physics
npx playwright install chromium
npm test
npm run test:production
npm run measure:physics
npm run measure:experience
node scripts/soak-experience.mjs
```

Playwright 首次需要安装 Chromium。若测试配置使用已安装的系统浏览器，以配置为准。实际执行结果以交付说明、终端结果和生成的测试报告为准；不要把测试脚本存在等同于所有场景已验证。`npm run build` 同时进行 TypeScript 类型检查和生产打包。桌面 Chrome / Edge 与触屏浏览器均为目标环境；WebGL 不可用时使用 Phaser Canvas 渲染。

使用已安装的 Edge 可在 PowerShell 中执行 `$env:PW_CHANNEL='msedge'; npm test`。`test:production` 在 `/sample-game/` 子路径提供构建产物，验证资源请求、键盘拾币与生产环境移除测试接口。`tests/journey.spec.ts` 通过固定步长输入连续完成三关，保留真实敌人与伤害，不使用传送或无敌；`game.spec.ts` 中的单项机制测试会设置初始位置，以隔离验证碰撞和奖励。截图与性能采样写入 `artifacts/`，HTML 测试报告写入 `playwright-report/`。

物理采用 120 Hz 固定步长，渲染跟随屏幕刷新率，以 60 FPS 流畅体验为目标；背景层缓存为纹理，特效数量有限。场景重开显式销毁显示对象，释放文字和地形的动态纹理，并清理补间、计时事件。测试接口仅在开发模式加 `?test` 时启用，生产构建中不提供。

新增 `tests/native-journey.spec.ts` 使用真实键盘和持续运行的游戏循环完成三关，读取状态但不调用物理模拟、不修改位置或生命。`experience.spec.ts` 覆盖极短按键、实际场景步长、旧计时器、即时设置与粒子上限；`ui-upgrade.spec.ts` 覆盖旧档迁移、键盘焦点、原生 Web Audio 与高 DPI 触屏布局。物理测试现包括镜头和动作反馈的纯逻辑回归。

`measure:experience` 在独占的本地端口采集 60 秒实际渲染帧、CDP 指标及三关/手机截图；`soak-experience.mjs` 采集 120 秒换关与粒子压力场景。请单独运行这些采样，避免多个浏览器并行影响结果。输出在 `artifacts/upgrade/after/`；它们是桌面及触屏模拟数据，不代表真机性能。

音频回收专项可执行 `node scripts/audio-lifecycle-probe.mjs`，观察停止播放、等待与 GC 后的节点数量；结果写入 `audio-lifecycle.json`。原生音频节点异步销毁，单点计数上升不应直接当作泄漏结论。

### 体验升级验收（2026-11-10）

| 检查 | 最新结果 |
| --- | --- |
| 类型检查 / 生产构建 | 通过 |
| 物理、三关路线、镜头、动画及驾驶器回归 | 32 / 32 通过 |
| Chromium / Edge 完整浏览器测试 | 分别 28 / 28 通过 |
| 真实键盘三关流程 | 两浏览器通过；Chromium 实际从天空关检查点重试一次后通关 |
| 两浏览器生产子路径 | `/sample-game/` 通过，开发测试接口已移除 |
| 60 秒实际渲染帧 | 中位数 16.7 ms、P95 17.9 ms，约 60 FPS |
| 120 秒换关 / 粒子压力 | 中位数 16.7 ms、P95 17.8 ms；同关对象/纹理/按键监听数量保持有界 |

四种尺寸的触屏模拟和 DPR 2/3 布局检查通过，未进行手机真机测试。完整前后对比、真实失败记录和测量条件见 [优化报告](游戏体验优化报告.md)，原始证据位于 `artifacts/upgrade/`。

### 基础版本验收记录（升级前，2026-11-10）

以下是上一版记录；本次升级重新运行的数量与性能数据以 [游戏体验优化报告](游戏体验优化报告.md) 为准。

| 验证 | 执行结果 |
| --- | --- |
| 全新目录 `npm ci` | 安装成功，锁文件不含本地路径依赖 |
| TypeScript + Vite 生产构建 | 通过，产物位于 `dist/` |
| 物理与三关地形路线 | 11 / 11 通过 |
| Chromium 浏览器测试 | 16 / 16 通过，51.4 秒 |
| 系统 Microsoft Edge 浏览器测试 | 16 / 16 通过，41.5 秒 |
| 两个浏览器的生产子路径检查 | `/sample-game/` 正常加载、移动拾币，无资源和运行时错误 |
| Chromium 120 个实际渲染帧采样 | 中位数 16.7 ms，P95 17.9 ms，本次约 60 FPS |
| 连续重开 12 次 | 显示对象 162、纹理 67、重开按键监听 1，前后不增长 |

整关测试保留真实敌人和伤害，仅用移动、奔跑、跳跃输入完成三关，并通过实际下一章按钮解锁；全部检查点触发，刷新后记录保留。另有踩踏反弹、撞块、护盾、死亡复活、菜单键盘操作、敌人无法穿透平台的专项测试。触屏验证覆盖 320×568、390×844、844×390，并注入真实多触点事件检查移动、疾跑与跳跃同时操作及释放。

性能数值是此 Windows 环境的样本，不代表所有设备；手机和平板使用浏览器触屏模拟，未进行 iOS / Android 真机验证。可审阅 `artifacts/verification.json`、`artifacts/performance-chromium.json`、`artifacts/performance-edge.json` 和截图。源码中保留了所有可复跑测试。

## GitHub Pages 部署

1. 将工程推送到自己的 GitHub 仓库，确保包含 `package-lock.json`。默认工作流监听 `main`；使用其他主分支时修改工作流的 `branches`。
2. 打开仓库 **Settings → Pages → Build and deployment → Source**，选择 **GitHub Actions**。
3. 推送到 `main` 或在 Actions 页面手动运行 **Deploy Mosslight to GitHub Pages**。
4. 工作流安装锁定依赖、构建 `dist/` 并部署。成功后的网址显示在工作流 `github-pages` environment 和仓库 Pages 设置中。

Vite 使用 `base: './'`，生成相对脚本路径，可用于仓库子路径和根域名部署。资源由本地模块生成，无需调整外部图片、音频 CDN 路径。本项目发布到 `joselinekopplin-del/supermario`，Pages 使用 GitHub Actions；推送 `main` 会自动测试、构建并更新网站。构建记录见 [Actions](https://github.com/joselinekopplin-del/supermario/actions)。部署设置参考 [Vite 官方静态部署文档](https://vite.dev/guide/static-deploy.html)。

## 可以继续扩展

- 增加计时挑战、无伤徽章和可选收集品图鉴。
- 加入手柄映射、按键重设和更多辅助模式。
- 为新的关卡主题加入独立敌人、机关与音乐段落。
- 增加回放系统及玩家自己的关卡编辑器。

角色、地名、地图、音符组合及像素设计均为本项目原创。只借鉴横版平台跳跃的通用游戏机制，不使用任天堂角色、地图、标志、图像或音轨。Phaser、Vite 等开源依赖按各自许可证使用。
