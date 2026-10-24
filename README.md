# 【JIRA】辅助功能（jira-help）

[![CI](https://github.com/heiyantutu/jira-help/actions/workflows/ci.yml/badge.svg)](https://github.com/heiyantutu/jira-help/actions/workflows/ci.yml)

一个用于公司内网 JIRA / Tempo 的 Tampermonkey 用户脚本，日常需求管理中的高频操作一键完成。
源码已模块化，使用 Rollup 构建成单文件用户脚本，便于维护、测试和发布。

> 原脚本为 900+ 行的单文件，功能基准保留在 [`legacy/jira.user.js`](legacy/jira.user.js)；
> 重构后的功能对应关系与有意调整见 [docs/refactor.md](docs/refactor.md)。

## 功能一览

| 功能 | 说明 | 使用位置 |
| --- | --- | --- |
| 复制标题 | 复制问题标题 | 问题详情页顶部按钮 |
| 复制标题&链接 | 复制「标题 + 链接 + 节日彩蛋」 | 问题详情页顶部按钮 |
| 复制源码关键字 | 复制 `--key=… --user=… 标题 链接`，便于提交代码时关联问题 | 问题详情页顶部按钮 |
| 创建子任务自动填充 | 自动填充摘要、描述（父任务链接）、成本部门、修复版本、模块；支持「创建并再创建一个」 | 创建子任务弹窗 |
| 需求/任务链接新标签页打开 | 描述里、问题筛选列表里的问题链接自动 `target=_blank` | 问题详情页 / 问题筛选列表 |
| 计算总工时 | 汇总列表页工时并提示总人天 | 问题筛选列表页「预估工时 / 实际工时」按钮 |
| 自动填写 Tempo 资源规划 | 修改问题排期保存时，自动删除并重建 Tempo 计划 | 问题编辑弹窗 |
| Tempo 排期同步 JIRA | 在 Tempo 资源规划里拖动/修改计划条后，回写任务的「预计开始 / 预计结束」 | Tempo 资源规划页 |
| 列表补充排期与工时 | 列表页补充显示计划起止时间、原始/剩余工时 | 问题列表页 |
| 节日/时段彩蛋 | 复制成功提示里附带节日或时段问候 | 复制类功能 |

## 安装

前置条件：已安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展，且能访问公司 JIRA。

**方式一：从 GitHub 安装（推荐，跟随本仓库更新）**

浏览器打开（或粘贴到 Tampermonkey「实用工具 → 从 URL 安装」）：

```
https://raw.githubusercontent.com/heiyantutu/jira-help/main/dist/jira.user.js
```

> 注意：脚本元数据里的 `@downloadURL` / `@updateURL` 目前仍指向 GreasyFork 原发布页，
> 以保持老用户的升级链路。如果你希望只跟随 GitHub 更新，修改 [`src/meta.js`](src/meta.js)
> 里的这两个地址为上面的 raw 链接后重新构建即可。

**方式二：GreasyFork**

原发布页：<https://greasyfork.org/zh-CN/scripts/452143>

**方式三：本地构建**

```bash
npm install
npm run build
```

然后把 `dist/jira.user.js` 拖进 Tampermonkey 管理面板。

## 运行环境

- JIRA：`http://192.168.0.151:8080`（内网）或 `https://jira.ihotel.cn`（正式），需登录
- 页面自带 jQuery（JIRA / AUI 自带），脚本不额外打包
- Toastify、moment 通过 UserScript 头部 `@require` 从 CDN 加载
- Tempo 相关功能依赖 JIRA Tempo 插件接口（`/rest/tempo-planning/1/*`）

## 开发

要求 Node.js 18+。

```bash
npm install        # 安装开发依赖
npm run build      # 构建 dist/jira.user.js
npm run watch      # 监听源码变化持续构建
npm test           # 单元测试 + jsdom 行为对比测试
npm run verify     # 语法检查 + 与原脚本的功能清单对比
npm run check      # build + verify + test（CI 使用）
```

修改功能后：

1. 在 `src/features/`（或对应目录）中改代码，跑 `npm run watch` 或 `npm run build`；
2. 跑 `npm run check` 确认没丢功能；
3. 发布前更新 [`src/meta.js`](src/meta.js) 里的 `@version`。

### 目录结构

```
jira-help/
├── src/
│   ├── meta.js                  # UserScript 元数据（构建时注入产物顶部）
│   ├── main.js                  # 入口：按页面路由装配各功能
│   ├── core/
│   │   ├── env.js               # 站点域名 / 当前地址
│   │   ├── dom.js               # loadCSS 等 DOM 工具
│   │   ├── clipboard.js         # 复制到剪贴板
│   │   ├── notify.js            # Toast 提示
│   │   └── time.js              # 工时 / 日期解析（纯函数）
│   ├── greetings/index.js       # 节日、时段彩蛋文案
│   └── features/
│       ├── copy-issue.js        # 复制标题 / 链接 / 源码关键字
│       ├── subtask-autofill.js  # 创建子任务自动填充
│       ├── open-in-new-tab.js   # 问题链接新标签页打开
│       ├── worktime-calc.js     # 列表页计算总工时
│       ├── plan-schedule.js     # 修改排期时同步 Tempo 计划
│       ├── plan-time-columns.js # 列表页补充排期/工时列
│       └── tempo-plan-sync.js   # Tempo 改排期后回写 JIRA
├── dist/jira.user.js            # 构建产物（提交到仓库，可直接安装）
├── legacy/jira.user.js          # 重构前的单文件原脚本（功能基准，勿改）
├── scripts/verify-parity.mjs    # 与原脚本的功能清单对比脚本
├── test/                        # 单元测试 + jsdom 行为对比测试
├── docs/refactor.md             # 重构说明：模块划分与有意调整
└── rollup.config.mjs
```

## 发布

1. 更新 `src/meta.js` 的 `@version`；
2. `npm run check`；
3. 提交源码与重新生成的 `dist/jira.user.js`；
4. 在 GitHub 打 tag / 发布 Release，并把 `dist/jira.user.js` 的内容同步到 GreasyFork 原发布页（如在用）。

CI 会校验 `dist/jira.user.js` 与源码构建结果一致，避免忘记重新构建。

## 已知限制

- 脚本强依赖老版 JIRA 的 DOM 结构、类名与自定义字段 ID
  （`customfield_10209`、`customfield_10300`、`customfield_10301`、`customfield_10700` 等），
  JIRA 升级后可能需要适配；
- `initPlan` 中的 Tempo 接口地址固定为正式环境域名 `https://jira.ihotel.cn`，沿用原脚本行为；
- Tempo 排期同步只会同步「自己」的计划（负责人为当前登录人），避免误改他人任务；
- 原脚本中的 `https://cdn.bootcdn.net/*` 匹配规则与未被调用的 `betterTimeDisplay` 一并保留，避免历史功能遗漏。

## 鸣谢

原作者：**chenqy、tzp、zyd**。本仓库仅为源码模块化重构与测试补充，功能行为保持与原脚本一致。

## License

[MIT](LICENSE)
