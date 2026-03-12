# Expo 复习 App（TypeScript + expo-router）

基于 **Expo 54 + TypeScript + expo-router** 构建的间隔重复记忆卡片应用，集成 SM-2 调度算法、SQLite 持久化、Markdown/LaTeX 富文本渲染、图片遮挡标注等功能，适用于医学/语言等学科的高效复习。

## 功能概览

| 功能 | 说明 |
|------|------|
| **SM-2 间隔重复** | 经典 Supermemo 2 算法，自动调度复习间隔与记忆系数 |
| **SQLite 持久化** | 原生端使用 expo-sqlite（WAL 模式），Web 端使用内存数据层 |
| **富文本渲染** | 支持 Markdown（markdown-it）+ LaTeX 公式（KaTeX），WebView 沙盒渲染 |
| **图片遮挡标注** | 归一化坐标保存遮挡矩形，复习时随机抽取提问 |
| **模板化建卡** | 内置解剖/生化模板，支持自定义字段，一键生成 front/back |
| **CSV 导入** | RFC 4180 兼容解析，支持自动创建 deck |
| **数据导入导出** | JSON 全量备份，支持合并/覆盖模式，Zod 校验 |
| **统计仪表盘** | 完成进度环、7 日预测柱状图、掌握度分布饼图 |
| **每日提醒** | expo-notifications 定时通知，含预计复习时长估算 |
| **批量操作** | 多选卡片批量移动/加标签/删除 |
| **搜索与筛选** | front/back/tags 多字段检索（150ms 防抖）+ due/lapse/标签筛选 |

## 技术栈

- **框架**: Expo 54 + React Native + expo-router 6
- **语言**: TypeScript 5.9
- **数据库**: expo-sqlite 16（WAL 模式，外键约束）
- **富文本**: markdown-it 14 + KaTeX 0.16（WebView 渲染）
- **图表**: react-native-chart-kit + react-native-svg
- **校验**: Zod 4
- **通知**: expo-notifications
- **测试**: Vitest 4
- **CI**: GitHub Actions

## 运行方式

```bash
npm install
npm start
```

启动后可在终端使用：

- `a` 打开 Android 模拟器
- `i` 打开 iOS 模拟器（仅 macOS）
- `w` 打开 Web

## 路由结构

```
app/
├── _layout.tsx              # 根布局（SQLite 初始化 + 主题）
├── (tabs)/
│   ├── _layout.tsx          # 底部 Tab 导航（4 个标签）
│   ├── index.tsx            # Home - 今日待复习
│   ├── decks.tsx            # Decks - 科目列表
│   ├── stats.tsx            # Stats - 统计仪表盘
│   └── settings.tsx         # Settings - 导入导出与设置
├── deck/[id].tsx            # DeckDetail - 卡片管理
└── review/[id].tsx          # Review - 复习界面
```

## 数据层

```
data/
├── sqlite.native.ts         # 原生端 SQLite（建表/seed/CRUD/SM-2/统计/导入导出）
├── sqlite.web.ts            # Web 端兼容内存数据层（同 API 接口）
├── sm2.ts                   # SM-2 调度算法实现
├── occlusion.ts             # 图片遮挡坐标系统（归一化 0~1）
├── templates.ts             # 模板化建卡（解剖/生化/自定义）
├── csv.ts                   # CSV 解析器（RFC 4180）
├── review-flow.ts           # 复习流程状态管理
└── db.ts                    # 数据库常量
```

### 数据库表结构

| 表名 | 说明 |
|------|------|
| `decks` | 科目（name, description） |
| `cards` | 卡片（front, back, tags, image_uri, occlusions, SM-2 调度字段） |
| `reviews` | 复习记录（rating, duration_seconds） |
| `app_meta` | 应用元数据（schemaVersion, 提醒设置等） |

首次启动自动写入 seed 数据（2 个 deck + 10 张卡片）。

## 核心功能详情

### SM-2 间隔重复

- 评分映射：`会=5`、`模糊=3`、`不会=1`
- quality < 3 时重置间隔为 1 天；quality >= 3 时按 ease factor 递增间隔
- ease factor 最低 1.3，防止间隔过短
- 选择"不会"计入 `lapses` 统计

### Review 复习流程

1. 展示正面（支持 Markdown/LaTeX 富文本 + 图片遮挡）
2. 点击翻面查看答案
3. 选择 `会 / 模糊 / 不会`，触发 SM-2 更新
4. 原子事务：复习记录 + 卡片状态在同一事务中更新
5. 完成后显示"今日复习全部完成！"

### 富文本渲染

- 自动检测内容是否包含 Markdown/LaTeX 语法
- 纯文本走原生 `<Text>` 快速路径，零开销
- 富文本通过 WebView 沙盒渲染，支持表格、代码块、引用等
- LaTeX 支持行内公式 `$...$` 和独立公式 `$$...$$`
- 动态高度计算 + 淡入动画

### 图片遮挡标注

- 点击图片添加遮挡矩形，可为每个遮挡填写结构名
- 坐标归一化保存（0~1），适配不同屏幕尺寸
- 复习时随机抽取一个遮挡作为提问，翻面显示答案与结构名

### 统计仪表盘

- **今日进度**：进度环展示完成百分比
- **7 日预测**：柱状图预估未来复习量
- **掌握度分布**：饼图显示待学习/短期记忆/长期记忆分布
- 连续天数统计 + 按 Deck 掌握度（近 7 日正确率）

### 卡片管理（DeckDetail）

- 新增/编辑/删除卡片
- 搜索：front/back/tags 多字段检索（150ms 防抖）
- 筛选：仅 due、仅 lapse>=1、按标签
- 批量操作：多选后批量移动/加标签/删除（含二次确认）
- FlatList 虚拟化渲染，支持 1000+ 卡片

### 模板化建卡

- **解剖模板**：结构名 / 位置 / 支配 / 血供 / 临床要点
- **生化模板**：通路步骤 / 限速酶 / 调控 / 抑制剂 / 相关疾病
- 支持自定义模板字段（逗号分隔）
- 一键生成 front/back 预览，保存后直接进入复习

### CSV 导入

- 字段格式：`deck,front,back,tags`
- 示例文件：`samples/cards-import.csv`
- 自动创建不存在的 deck，事务性导入

### 导入导出（Settings）

- **导出**：全量 JSON（decks/cards/reviews + schemaVersion + exportedAt），可分享
- **合并导入**：仅添加新数据，不覆盖
- **覆盖导入**：完全替换（黄色警示标签）
- **清空数据**：危险操作，含确认对话框
- 导入前 Zod schema 校验，失败提示具体字段路径

### 每日提醒

- Settings 页设置开关与提醒时间（默认 21:30）
- 通知文案：`今日待复习 X 张，预计 Y 分钟`（基于近 7 日平均耗时估算）
- 若当天已完成可配置为不提醒或提醒"已完成"

## 组件

```
components/
├── RichTextRenderer.tsx      # 富文本渲染（Markdown + LaTeX，双轨渲染）
├── haptic-tab.tsx            # 触觉反馈 Tab
├── parallax-scroll-view.tsx  # 视差滚动
├── themed-text.tsx           # 主题文本
├── themed-view.tsx           # 主题视图
├── external-link.tsx         # 外部链接
└── ui/
    ├── icon-symbol.tsx       # 跨平台图标
    └── collapsible.tsx       # 折叠面板
```

## 设计系统

应用使用统一的设计令牌（`constants/design-tokens.ts`）：

- **主色**：`#2563EB`（蓝）
- **危险色**：`#EF4444`（红）
- **成功色**：`#10B981`（绿）
- **圆角**：card 16px / button 12px / badge 20px
- **间距**：page 20 / gap 16 / cardPad 16
- 支持 iOS/Android 平台阴影适配

## 测试与 CI

```bash
npm run test         # Vitest 运行全部测试
npm run typecheck    # TypeScript 类型检查
npm run lint         # ESLint 检查
npm run verify       # typecheck + lint + test 一键验证
```

测试文件：

| 文件 | 覆盖内容 |
|------|----------|
| `data/sm2.test.ts` | SM-2 算法核心逻辑 |
| `data/sm2.boundary.test.ts` | SM-2 边界条件 |
| `data/templates.test.ts` | 模板生成 |
| `data/occlusion.test.ts` | 遮挡坐标解析 |
| `data/review-flow.integration.test.ts` | 复习流程集成 |
| `data/sqlite.web.test.ts` | Web 数据层 |
| `services/rich-text-html.test.ts` | 富文本 HTML 生成 |

CI 配置：`.github/workflows/ci.yml`，在 push/PR 时自动运行 `npm ci && npm run test`。

## 内测打包（EAS Build）

项目已配置 `eas.json`，包含 development / preview / production 三个 profile。

### 首次准备

```bash
npm install
npx eas login
npx eas build:configure
```

### 构建 Android 内测包（推荐）

```bash
npx eas build -p android --profile preview
```

产出可安装 APK，适合内测分发。首次构建时 EAS 会提示 keystore 处理，选择自动管理即可。

### 构建 Android 正式包

```bash
npx eas build -p android --profile production
```

### 构建 iOS 内测包

```bash
npx eas build -p ios --profile preview
```

iOS 首次构建需要 Apple Developer 账号及证书配置。

## 项目配置

- **App 名称**：my-project
- **包名**：com.lhw686.myproject
- **JS 引擎**：Hermes
- **新架构**：已启用
- **React Compiler**：已启用
- **TypedRoutes**：已启用

> Web 端为兼容运行与预览使用内存数据层，API 与原生端一致。
