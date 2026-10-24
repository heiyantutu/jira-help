# 重构说明（单体脚本 → 模块化源码）

重构原则：**只拆结构，不改行为**。功能基准是重构前的单文件脚本 [`legacy/jira.user.js`](../legacy/jira.user.js)，
构建产物是 [`dist/jira.user.js`](../dist/jira.user.js)。

## 1. 原脚本代码 → 新模块 对应关系

| 原脚本（legacy/jira.user.js） | 新位置 | 说明 |
| --- | --- | --- |
| UserScript 元数据头 | `src/meta.js` | 构建时作为 banner 注入 |
| `loadCSS` | `src/core/dom.js` | 原样迁移 |
| `getSpecialContent` / `getSpecialText` | `src/greetings/index.js` | 节日/时段彩蛋文案 |
| `copySourceCodeKey` / `createCopyTitleAndLink` / `createCopyTitle` | `src/features/copy-issue.js` | 复制类按钮 |
| `collectParentIssueData` / `syncMultiSelectUi` / `fillSubTaskForm` / `autoCopySubTask` / `autoCopySubTaskAfterCreateAnother` | `src/features/subtask-autofill.js` | 创建子任务自动填充 |
| `parseTime` | `src/core/time.js` | 纯函数，已补单元测试 |
| `calcWorkTime` | `src/features/worktime-calc.js` | 列表页工时统计 |
| `checkForLinks` + `MutationObserver` | `src/features/open-in-new-tab.js` | 问题链接新标签页打开 |
| `initPlan` | `src/features/plan-schedule.js` | 修改排期时同步 Tempo 计划 |
| `parseTimeString` / `getUrlParameter` / `convertChineseDateToEnglish` | `src/core/time.js` | 从 `initPlan` 中提取的纯函数，已补单元测试 |
| `betterTimeDisplay` | `src/core/time.js` | 原脚本从未调用，按要求保留 |
| `initPlanTime` | `src/features/plan-time-columns.js` | 列表页补充排期/工时列 |
| `initTempoPlanSync` / `ensureTempoPlanSync` | `src/features/tempo-plan-sync.js` | Tempo 改排期后回写 JIRA |
| `locationhref` / `currentDomain` | `src/core/env.js` | 站点判断 |
| 末尾按 URL 分发的初始化代码 | `src/main.js` | 初始化顺序与原脚本一致 |

## 2. 初始化顺序（与 legacy 保持一致）

1. `bindSubTaskAutoFill()`：注册子任务相关 document 级事件（所有页面）；
2. `initOpenIssueLinksInNewTab()`：启动 MutationObserver；
3. `bindTempoPlanSyncRoute()`：`ensureTempoPlanSync()` + `hashchange` 监听；
4. 问题详情/项目问题页：加载 Toastify CSS → 复制按钮 → `initPlan()` → `initPlanTime()`；
5. 问题筛选列表页：工时计算按钮。

## 3. 有意调整（均不改变功能）

1. **提取复用函数**：复制类按钮统一走 `core/clipboard.js`；Toast 统一走 `core/notify.js`；
   `initPlan` 内的三个纯函数移到 `core/time.js`。命令、参数、Toast 文案与样式保持不变。
2. **清理无效代码**：`getUrlParameter` 里原有一行损坏的正则转义（空字符类 `[]`，永远不生效）已删除，等价实现；
   `getSpecialText` 中调试用的 `console.log(randNum)` 已删除；`getSpecialContent` 中未使用的变量已删除。
3. **元数据补充**：新增 `@run-at document-idle`（Tampermonkey 默认值，行为不变）、
   `@homepageURL`、`@supportURL`；`@version`、`@downloadURL`、`@updateURL` 等其余字段保持不变。
4. **保留历史兼容**：`@match https://cdn.bootcdn.net/*`、未被调用的 `betterTimeDisplay` 均保留；
   `initPlan` 中写死的 `https://jira.ihotel.cn` Tempo 接口地址保持原样。
5. **构建策略**：`rollup.config.mjs` 关闭 tree-shaking，确保源码中已定义功能不会被构建移除。

## 4. 如何验证「功能都保留」

三层校验，均可本地或 CI 执行：

```bash
npm run verify   # 静态对比：元数据 / 函数 / 功能字符串是否全部存在于构建产物
npm test         # 单元测试 + jsdom 下 legacy 与 dist 的行为对比
npm run check    # 构建 + 以上全部
```

`scripts/verify-parity.mjs` 的校验口径：

- 元数据：legacy 的每个 `@key value`（`@version` 除外，允许升级）都出现在产物中；
- 函数：legacy 中 36 个函数（含嵌套函数）在产物中均有定义；
- 字符串：legacy 中 226 个字符串字面量（按钮 id、选择器、接口地址、提示文案等）在产物中均能找到
  （3 处有意删除的除外，见上文「清理无效代码」）。

如果后续在 `legacy/` 之外新增功能，可正常添加；若删改原功能，校验脚本会报错提醒。

### 行为对比测试覆盖（`test/dom-parity.test.mjs`）

用 jsdom 构造页面，把 legacy 与 dist 分别跑一遍，对比 DOM / Toast / 剪贴板 / fetch 请求与 payload：

| 场景 | 校验内容 |
| --- | --- |
| 1 / 1b | 复制按钮顺序、文案、class/style；三条剪贴板文本；Toast；`execCommand`；「非计划内」彩蛋 |
| 2 / 2b | 子任务自动填充（表单延迟渲染 + 200ms 重试）；「创建并再创建一个」表单重置后才填充 |
| 3 / 3b | 新标签链接：browse 页按 `data-issue-key`、filter 页所有本域链接；动态链接（MutationObserver） |
| 4 | 工时计算按钮与 Toast（`3.38人天` / `5.50人天`） |
| 5 / 5b | 创建计划：DELETE 旧计划 + POST 新计划全字段；结束早于开始只报错不发请求 |
| 6 | 列表页插入排期列 / 工时列（位置、class、未排占位文案） |
| 7 / 7b / 7c / 7d / 7e | Tempo 排期同步：fetch 与 XHR 两条保存路径、非 ISSUE 跳过、非本人跳过、hashchange 幂等 |
| 8 | 非 JIRA 页面不初始化任何功能 |
| 9 / 9b | 内网域名判定、`projects/.../issues` 路由 |

另有 `test/pure.test.mjs` 覆盖 `parseTime`、`parseTimeString`、`convertChineseDateToEnglish`、
`getUrlParameter`、`betterTimeDisplay` 以及节日/时段彩蛋文案。
