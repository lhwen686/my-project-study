# Expo 复习 App（TypeScript + expo-router）

已创建一个 Expo + TypeScript 项目，并使用 **expo-router** 完成导航，包含以下页面：

- Home（今日复习）
- Decks（科目列表）
- DeckDetail（卡片列表）
- Review（复习界面）
- Stats（统计）

## SQLite 持久化 + SM-2 调度

应用集成 `expo-sqlite`（原生端），首次启动会自动创建并初始化以下表：

- `decks`
- `cards`
- `reviews`

并自动写入 seed 数据（2 个 deck，10 张 cards），Decks 页会直接展示 seed 的科目列表。

卡片调度实现了 SM-2 核心字段更新：

- `interval_days`
- `ease_factor`
- `due_date`
- `repetition`

Stats 页会显示“今日待复习卡片数（due cards）”。

> 说明：Web 端为了兼容运行与预览，使用了内存数据层（API 与原生端一致）；原生端使用 SQLite 持久化。

## 运行方式

```bash
npm install
npm start
```

启动后可在终端使用：

- `a` 打开 Android 模拟器
- `i` 打开 iOS 模拟器（仅 macOS）
- `w` 打开 Web

## 内测打包（EAS Build，Android 优先）

本项目已加入 `eas.json`，包含 `development / preview / production` 三个 profile；内测建议先用 `preview` 产出 Android APK。

### 0) 首次准备（你需要手动操作）

```bash
npm install
npx eas login
npx eas build:configure
```

说明：

- `npx eas login` 需要你在终端交互登录 Expo 账号。
- `npx eas build:configure` 可能会提示你选择平台、绑定/创建 EAS Project，这一步需要你手动确认选项。

### 1) 构建 Android 内测包（推荐）

```bash
npx eas build -p android --profile preview
```

- 该命令会走云端构建，产出可安装的 APK（适合内测分发）。
- 若是首次 Android 构建，EAS 会提示证书/keystore 处理：可选择让 EAS 自动管理（推荐），需要你在交互提示里确认。

### 2) 可选：构建 Android 正式包（AAB）

```bash
npx eas build -p android --profile production
```

### 3) 可选：构建 iOS 内测包

```bash
npx eas build -p ios --profile preview
```

- iOS 首次构建通常需要 Apple Developer 账号登录、证书与 Provisioning Profile 配置，均为交互式步骤，需要你手动完成。

## 路由结构

- `app/(tabs)/index.tsx` -> Home
- `app/(tabs)/decks.tsx` -> Decks
- `app/deck/[id].tsx` -> DeckDetail
- `app/review/[id].tsx` -> Review
- `app/(tabs)/stats.tsx` -> Stats

## 数据层

- `data/sqlite.native.ts`：原生端 SQLite 数据层（建表/seed/CRUD/SM-2）
- `data/sqlite.web.ts`：Web 端兼容数据层（同 API）
- `data/sm2.ts`：SM-2 调度函数与规则
- `data/sm2.test.ts`：6 个测试用例


## Review 流程

- 展示正面 → 点击翻面 → 选择 `会/模糊/不会`。
- 评分映射：`会=5`、`模糊=3`、`不会=1`，会调用 SM-2 更新 `interval/easeFactor/dueDate`。
- 今日 due 卡片复习完成后，会显示完成提示。
- 选择“不会”会计入 `lapses` 统计（Stats 页展示）。


## 卡片管理与 CSV 导入

- DeckDetail 页面支持卡片 **新增 / 编辑 / 删除**。
- 支持 CSV 导入字段：`deck,front,back,tags`。
- 示例 CSV 文件：`samples/cards-import.csv`。
- 导入后会立即写入数据层并可在 UI 中看到新增卡片。


## Stats 聚合

- 今日完成数（来自 reviews 当天记录）。
- 连续天数（按 reviews 日期连续计算）。
- 按 Deck 掌握度：最近 7 日正确率近似（rating >= 3 视为正确）。


## Settings（导入导出与迁移）

- 导出全量 JSON：`decks/cards/reviews + schemaVersion + exportedAt`，保存到本地并可分享。
- 导入 JSON：支持 **合并** / **覆盖** 两种模式；导入前使用 `zod` 校验，失败会提示具体字段路径。
- 提供数据库清空按钮用于验收（导出 -> 清空 -> 导入）。
- 引入 `schemaVersion` 与 `app_meta`，为后续表结构升级提供迁移框架。


## 测试与 CI

- 本地一键复现：`npm run test`。
- CI：`.github/workflows/ci.yml` 在 GitHub Actions 上执行 `npm ci && npm run test`。


## 每日提醒（expo-notifications）

- Settings 支持提醒开关与每日提醒时间设置（默认 21:30，可修改）。
- 提醒文案：`今日待复习 X 张，预计 Y 分钟`，其中 Y 基于近 7 日平均每张耗时估计。
- 若当天已完成：可配置为不提醒或提醒“已完成✅”。


## DeckDetail 高级卡片管理

- 搜索：支持 front/back/tags 多字段检索（含 150ms debounce）。
- 筛选：仅 due、仅 lapse≥1、按标签筛选。
- 批量操作：批量移动 deck、批量加标签、批量删除（含二次确认）。
- 性能：列表改为 `FlatList`，支持 1000+ 卡片虚拟化渲染。


## 图片卡与遮挡标注

- 卡片支持附加一张图片（本地路径 / asset URI）。
- DeckDetail 内置遮挡标注编辑器：点击图片可连续添加遮挡矩形，并可为每个遮挡填写结构名。
- 复习时会从该卡片的遮挡块中随机抽取一个作为提问，翻面后显示答案并可显示结构名。
- 遮挡坐标采用归一化保存（0~1），不同屏幕尺寸会按比例缩放显示。


## 模板化建卡

- 新建卡片可选择模板：
  - 解剖模板：结构名 / 位置 / 支配 / 血供 / 临床要点
  - 生化模板：通路步骤 / 限速酶 / 调控 / 抑制剂 / 相关疾病
- 支持自定义模板字段（逗号分隔），字段填写后会自动生成 front/back 预览。
- 点击“一键生成 front/back”可直接回填卡片内容，再按原流程保存并进入复习。
