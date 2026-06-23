# 05_ACCEPTANCE_CRITERIA.md

文档定位：Hermills UI 重做的验收合同。  
适用对象：验收 Agent、实现 Agent、Codex、人工验收者。  
依赖文件：验收前必须完整读取 `00_UI_MAP.md`、`01_VISUAL_SYSTEM.md`、`02_COMPONENT_SPECS.md`、`03_PAGE_SPECS.md`、`04_STATE_SPECS.md`。  
本文件专门写验收清单、必须截图、必须跑的命令、拒收条件、实现 Agent 和验收 Agent 的分工。

---

# 1. 验收总原则

Hermills UI 不能由实现 Agent 自己宣布完成。实现 Agent 可以提交结果、测试记录、截图和说明，但最终是否通过必须由独立验收 Agent 或人工验收判断。

验收不是只看页面变漂亮了没有。验收要判断它是否真的像一个外贸销售每天使用的 Windows 桌面工作台。验收要判断用户是否知道自己在哪里、下一步点哪里、失败后怎么恢复、AI 为什么这样写、批量任务是否逐条可见、技术复杂度是否被隐藏。

只换颜色、只换按钮、只做默认态、只堆卡片、只做静态样式、没有错误状态、没有加载状态、没有证据和评分，都不能通过验收。

---

# 2. 实现 Agent 分工

实现 Agent 的任务是读取 00 到 04 文件，按照规格实现 UI。

实现 Agent 必须先检查项目结构、技术栈、现有组件、路由和构建命令。实现 Agent 不得假设项目一定是某个框架。实现 Agent 必须记录自己检查到的真实项目结构。

实现 Agent 可以修改前端页面、UI 组件、样式、状态展示、空状态、加载状态、错误提示、按钮文案和安全 mock 数据。实现 Agent 不得修改认证逻辑、数据库 schema、真实邮箱发送核心逻辑、API Key 保存逻辑、`.env` 文件、生产密钥和后端安全策略。

实现 Agent 每完成一个阶段，必须更新进度日志。建议文件为：

```text
/docs/ai-control/04_PROGRESS_LOG.md
/docs/ai-control/05_TEST_RESULTS.md
```

进度日志必须包含当前阶段、检查过的文件、修改过的文件、完成内容、仍待完成、遇到的问题、下一步。

---

# 3. 验收 Agent 分工

验收 Agent 不负责实现。验收 Agent 只负责检查结果是否符合规格。

验收 Agent 必须独立读取 00 到 05 文件，再检查实现结果。验收 Agent 必须检查页面、组件、状态、响应式、可访问性、构建结果、截图和拒收条件。

验收 Agent 不得只看实现 Agent 的总结。必须基于实际代码、截图、运行结果或 DOM 检查进行判断。

验收 Agent 的最终输出必须包含通过项、失败项、证据、需要修复的文件或页面、下一轮给实现 Agent 的明确修正指令。

---

# 4. 必须运行的命令

实现完成后必须运行以下命令。如果项目脚本名称不同，使用项目中等价命令，并说明差异。

```bash
npm run typecheck
npm run test
npm run build
```

如果项目有 lint，也必须运行。

```bash
npm run lint
```

如果某个命令不存在，不允许假装通过。必须在测试结果中写明“项目没有该脚本”，并说明使用了哪个替代命令，或者没有可替代命令。

测试结果必须保存到：

```text
/docs/ai-control/05_TEST_RESULTS.md
```

测试结果必须包含命令、开始时间、通过或失败、失败摘要、修复情况、剩余问题。

---

# 5. 必须截图检查的页面

验收必须截图或等价视觉检查以下页面。

登录注册默认态。登录注册验证码态。初始化每一步，至少检查第一步、中间一步、最后确认步。今日外联有数据态。今日外联空状态。客户管理列表和详情态。客户管理空状态。单封写信输入态。单封写信生成中时间线态。单封写信 AI 降级态。单封写信结果态。单封写信低分邮件态。批量写信导入态。批量写信解析预览态。批量写信进行中态。批量写信部分完成态。批量写信失败项态。邮箱配置未连接态。邮箱配置已连接态。邮箱配置测试中态。邮箱配置授权失败态。邮箱配置高级设置折叠态。签名 Logo 默认态。签名 Logo 预览态。公司资料默认态。销售资产默认态。聊天控制未连接态。聊天控制二维码态。聊天控制未配置云端地址态。聊天控制命令执行中态。系统设置默认态。诊断日志态。

截图必须覆盖以下窗口尺寸或等价 viewport。

```text
1366x768
1440x900
1280x720
920px 宽
```

如果是桌面程序，截图应尽量模拟这些窗口尺寸。

---

# 6. App Shell 验收

左侧导航宽度应接近 232px。导航背景白色，右侧边框浅蓝灰。品牌区高度接近 72px。当前导航项必须有清楚 active 状态。底部状态区可以展示公司资料、邮箱、学习同步、系统设置等低频入口。主内容区背景必须是浅灰蓝，不是纯白铺满。页面标题区必须包含 H1、副标题和最多一个主按钮。主内容滚动时左侧导航保持稳定。

宽度缩小时，布局不能崩坏。920px 宽时，详情区应下移或折叠，按钮文字不能被截断。

---

# 7. 视觉系统验收

主背景应使用浅灰蓝。卡片应为白底、浅边框、中等圆角、轻阴影。主按钮使用蓝色。紫色不得大面积出现。红色只用于失败和危险。绿色只用于成功。黄色/橙色只用于警告和待审核。

字体层级必须清楚。页面标题、卡片标题、正文、辅助文字、Badge 不能混乱。间距必须遵守 4px 系统。圆角不能随机。阴影不能过重。图标风格必须统一为线性图标。

如果页面看起来像廉价后台模板、游戏 UI、赛博朋克、聊天机器人、开发者控制台或不同页面风格不一致，视觉验收失败。

---

# 8. 组件验收

必须存在或等价实现以下复用组件：AppShell、Sidebar、Topbar 或 PageHeader、Button、Input、Textarea、Card、Badge、Alert、Modal、Drawer 或详情面板、EmptyState、LoadingState 或 Skeleton、ErrorState、AIProgressTimeline、QualityScoreCard、EvidenceCard、CustomerListItem、EmailEditor、UploadDropzone、StickyActionBar。

主按钮必须有默认、hover、active、disabled、loading 状态。Loading 时保持宽度，不跳动，文案必须具体。输入框必须有 focus、错误、成功状态。提示条必须在文档流中，不悬浮遮挡。错误状态必须包含人话原因、下一步动作和技术详情折叠。空状态必须包含标题、说明和一个主按钮。

如果组件样式在多个页面重复手写，且没有复用结构，组件验收失败。

---

# 9. 页面验收

今日外联必须让用户一眼看到今日任务、统计和快捷入口。它不能变成 BI 大屏或系统状态页。

客户管理必须显示客户列表和详情。详情必须包括客户信息、背调摘要、证据、开发角度、邮件正文、评分和操作。不能只显示客户列表。

单封写信必须是核心工作流。输入态只能突出邮箱、官网和主按钮。生成中必须有 AI 时间线。结果态必须有客户简报、开发角度、邮件主题、正文、评分、证据、操作按钮。低分邮件不能默认发送。

批量写信必须像生产线。必须有导入、解析预览、队列状态、逐条结果、失败项不阻塞。不能只有一个大进度条。

邮箱配置必须让普通用户只填邮箱和授权码。高级设置默认折叠。失败必须人话化。

签名 Logo 必须有文字签名、Logo 上传、邮件尾部预览和保存状态。

公司资料必须按写信用途分组，不像复杂企业后台。

聊天控制必须处理未配置云端地址状态。不得出现 undefined/。未配置时不能生成坏二维码。

系统设置必须和业务页面分开。技术日志只在这里完整展示。

---

# 10. 状态验收

每个核心页面必须至少检查默认、空、加载、成功、失败状态。

单封写信必须检查输入不完整禁用状态、AI 生成中、AI 降级、生成成功、低分邮件、生成失败。批量写信必须检查导入空状态、解析预览、进行中、部分完成、单项失败、全部完成。邮箱配置必须检查未连接、测试中、成功、授权失败、连接超时、高级设置折叠。聊天控制必须检查未连接、等待扫码、已连接、二维码过期、未配置云端地址、命令执行失败。

如果页面只有默认态，没有状态设计，状态验收失败。

---

# 11. 文案验收

UI 文案必须使用用户语言，不使用工程语言。按钮写动作结果，不写“提交”。错误写恢复方法，不写纯错误码。空状态写下一步。成功状态写下一步。

坏文案包括：提交、确认、开始、AI Result、SMTP auth failed、undefined relay URL、Hermes failed、403、500、token invalid。

好文案包括：分析客户官网并生成开发信、保存并测试邮箱、选择文件并生成开发信、重写到 80 分以上、查看证据来源、邮箱授权失败，请确认你填写的是邮箱授权码，不是登录密码、需要先配置云端绑定地址，才能生成手机可扫码二维码。

如果业务页面暴露 Supabase、token、Scrapling、Hermes Agent、SMTP host、stack trace 等技术词，除非处于系统设置或诊断页，否则文案验收失败。

---

# 12. 可访问性验收

所有按钮必须有可读文字或 aria-label。图标按钮必须有 tooltip 或 aria-label。表单 label 必须和 input 绑定。错误提示要和字段关联。颜色不能作为唯一状态表达，必须配合文字或图标。焦点态必须明显。键盘 Tab 顺序必须符合页面视觉顺序。禁用按钮不应灰到不可读。点击目标不能太小，图标按钮至少 32px x 32px。

---

# 13. 拒收条件

出现以下情况，直接拒收。

项目无法 build。主导航 broken。核心页面缺失。单封写信没有 AI 时间线。单封写信结果没有证据和评分。批量写信只有一个大进度条。错误状态只显示技术错误码。空状态为空白。loading 只有转圈。邮箱配置默认暴露 SMTP 高级参数。聊天控制出现 undefined/ 或未配置云端时生成坏二维码。页面同时出现多个抢注意力的主按钮。实现改动了认证、数据库 schema、真实密钥、`.env` 或后端安全逻辑。实现 Agent 没有提供测试结果。实现 Agent 没有提供改动文件清单。实现 Agent 自己宣布完成但没有验收证据。

---

# 14. 最终报告格式

实现 Agent 最终必须输出：

```text
1. Changed files
2. Implemented pages
3. Implemented reusable components
4. State coverage summary
5. Commands run and results
6. Screenshots or screenshot paths
7. Known limitations
8. Acceptance checklist mapping
9. Items needing reviewer decision
```

验收 Agent 最终必须输出：

```text
1. Pass / Fail
2. Passed items
3. Failed items
4. Evidence
5. Required fixes
6. Suggested next Codex prompt
```

---

# 15. 推荐给 Codex 的执行 Prompt

```text
You are the implementation agent for Hermills UI.

Read these files first:
- docs/ui-harness/00_UI_MAP.md
- docs/ui-harness/01_VISUAL_SYSTEM.md
- docs/ui-harness/02_COMPONENT_SPECS.md
- docs/ui-harness/03_PAGE_SPECS.md
- docs/ui-harness/04_STATE_SPECS.md
- docs/ui-harness/05_ACCEPTANCE_CRITERIA.md

Do not start coding before reading them.

Your job is to implement the UI as a professional AI outreach workbench for export sales users.

Rules:
- Do not modify auth logic.
- Do not modify database schema.
- Do not touch .env files or production secrets.
- Do not modify SMTP sending core logic unless explicitly requested.
- Do not create disconnected demo pages.
- Improve existing pages and components where possible.
- Build reusable components instead of duplicating UI.
- Every core page must include default, empty, loading, success, and failure states.
- Single outreach must include AI progress timeline, evidence, quality score, and editable email body.
- Batch outreach must show queue progress and per-customer results.
- Email setup must hide advanced SMTP settings by default.
- Chat control must not generate a QR code when the cloud relay URL is missing.
- Update progress and test result logs after each phase.

Execution phases:
1. Inspect project structure, routes, existing components, styling system, and commands.
2. Implement or normalize the global App Shell.
3. Implement design tokens and base components.
4. Implement Today Outreach, Customers, Single Outreach, Batch Outreach, Email Setup.
5. Implement Sales Assets, Signature Logo, Company Profile, Chat Control, System Settings.
6. Add all required states.
7. Run typecheck, test, build, and lint if available.
8. Produce final implementation report with evidence.
```

---

# 16. 最终判断标准

Hermills UI 重做成功，不是因为它更漂亮，而是因为用户能做到：一眼知道今天要干什么，第一次使用不会卡在初始化，配邮箱时不需要懂 SMTP，写单封开发信只需要输入邮箱和官网，批量任务不用等全部完成才看到结果，每封邮件都有证据、评分和可编辑正文，错误出现时知道怎么恢复，软件看起来稳定、专业、值得把客户资料交给它。

这 6 份文件是后续实现的设计合同。任何 UI 改动如果违反这些规格，就算视觉上更花，也不能合并。
