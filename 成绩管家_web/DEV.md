# 成绩管家 - 开发文档

> 本文档面向 AI 助手和新开发者，用于快速理解项目架构、数据结构和开发约定。

## 项目概览

- **项目名称**：成绩管家
- **仓库地址**：`git@github.com:lucian-why/chengjuanjia.git`
- **在线地址**：https://lucian-why.github.io/chengjiguanjia/
- **部署方式**：GitHub Pages（推送至 `main` 分支自动部署）
- **当前分支**：`main`（直接在 main 上开发提交）
- **架构**：单文件 SPA（Single Page Application），所有 HTML/CSS/JS 在 `index.html` 一个文件中

## 技术栈

| 依赖 | 版本 | 用途 | 引入方式 |
|------|------|------|----------|
| Chart.js | 4.4.1 | 雷达图、趋势折线图 | CDN |
| SheetJS (xlsx) | 0.18.5 | Excel 导入导出 | CDN |
| html2canvas | 1.4.1 | 分享报告截图生成 | CDN |
| Google Fonts | - | Noto Serif SC / Noto Sans SC | CDN |

**没有构建工具**。直接双击 `index.html` 即可运行，无需 npm/webpack/vite。

## 文件结构

```
E:\成绩管家\
├── index.html          # 唯一的生产文件（HTML + CSS + JS 全部内联）
├── README.md           # 项目介绍
└── DEV.md              # 本文档（开发细节）
```

## 数据模型

### 档案（Profile）

```javascript
{
    id: 'profile_' + Date.now(),  // 字符串，如 "profile_1712345678901"
    name: '张三',                   // 档案名称
    createdAt: '2025-01-01T00:00:00.000Z'  // ISO 日期字符串
}
```

**存储键**：`xueji_profiles`（localStorage，JSON 数组）
**活跃档案键**：`xueji_active_profile`（localStorage，存储 profile id 字符串）

### 考试（Exam）

```javascript
{
    id: 1712345678901,              // 数字，Date.now() 生成
    profileId: 'profile_xxx',       // 所属档案 ID
    name: '第一次月考',             // 考试名称
    startDate: '2025-03-15',        // 考试日期（字符串，格式 YYYY-MM-DD）
    createdAt: '2025-03-15T...',    // 创建时间（ISO）
    excluded: false,                // 是否排除不计入统计（默认 false）
    // 排名信息（可选）
    totalClassRank: 5,              // 总分班级排名
    totalGradeRank: 42,             // 总分年级排名
    classTotal: 45,                 // 班级人数
    gradeTotal: 500,                // 年级人数
    // 科目列表
    subjects: [
        {
            name: '语文',           // 科目名称
            score: 108,             // 得分（数字）
            fullScore: 150,         // 满分（数字），用于雷达图计算得分率
            classRank: 2,           // 班级排名（可选，数字）
            gradeRank: 18,          // 年级排名（可选，数字）
            notes: ''               // 备注
        },
        // ...更多科目
    ]
}
```

**存储键**：`xueji_exams`（所有档案共用一个键，通过 `profileId` 过滤，JSON 数组）

### localStorage 键名汇总

| 键名 | 类型 | 说明 |
|------|------|------|
| `xueji_profiles` | JSON 数组 | 所有档案列表 |
| `xueji_active_profile` | 字符串 | 当前活跃档案 ID |
| `xueji_exams` | JSON 数组 | 所有考试（按 profileId 过滤） |
| `xueji_trend_mode` | 字符串 | 趋势图模式：`score`/`rank`/`radar` |

## 页面结构（SPA 路由）

应用是单页应用，通过 JS 控制 `display: none/block` 切换视图：

| 区域 | DOM ID | 说明 |
|------|--------|------|
| 侧边栏 | `sidebar` | 考试列表 + 档案切换下拉框 |
| 考试详情 | `tab-exam` | 选中考试的总览 + 各科成绩卡片 |
| 成绩分析 | `tab-analysis` | 包含三个子标签：分数趋势、排名趋势、科目对比（雷达图） |
| 设置 | `tab-settings` | 档案管理（新增/重命名/删除/切换） |

### 成绩分析子标签

通过 `trendAnalysisMode` 变量控制，存储在 `xueji_trend_mode`：
- `score`：分数趋势折线图（默认）
- `rank`：排名趋势折线图（分班级/年级两种）
- `radar`：科目对比雷达图

## 核心函数索引

### 数据操作

| 函数 | 说明 |
|------|------|
| `getProfiles()` / `saveProfiles()` | 读写档案列表 |
| `getActiveProfileId()` / `setActiveProfileId()` | 读写活跃档案 |
| `getExams(profileId, excludeHidden)` | 获取某档案考试列表；`excludeHidden=true` 过滤被排除考试 |
| `getExamsAll()` | 获取所有考试（导入/全局操作用） |
| `saveExams(exams)` | 保存所有考试数据 |
| `toggleExamExclude(examId)` | 切换考试排除状态，刷新列表+图表 |

### 渲染

| 函数 | 说明 |
|------|------|
| `renderExamList()` | 渲染侧边栏考试列表 |
| `renderExamDetail()` | 渲染考试详情页 |
| `renderProfileSwitcher()` | 渲染侧边栏档案切换下拉框 |
| `renderProfileList()` | 渲染设置页档案管理面板 |
| `renderRadarCompareChips()` | 渲染雷达图对比考试选择器 chip |
| `updateRadarChart()` | 更新雷达图数据 |
| `updateChartTabs()` | 更新趋势图标签状态 |
| `updateTrendChart()` | 更新趋势图数据（自动排除被排除考试） |

### 交互

| 函数 | 说明 |
|------|------|
| `selectExam(examId)` | 选中考试（再次点击收起），examId 是数字 |
| `switchToProfile(index)` | 切换档案，index 是数组下标 |
| `toggleRadarCompare(examId)` | 切换雷达图对比考试选择（最多2场），examId 是数字 |
| `openChartZoom(type)` | 打开图表放大弹窗，type: `'trend'`/`'radar'` |
| `closeChartZoom()` | 关闭图表放大弹窗，销毁图表实例 |
| `showConfirmDialog({title, message, iconType, onConfirm})` | 自定义确认弹窗 |
| `showToast({icon, iconType, title, message, onClose})` | 自定义提示弹窗（必须传对象，不可传字符串） |

### 分享报告

| 函数 | 说明 |
|------|------|
| `openShareExamReport()` | 生成当前考试的分享报告（紫色主题卡片） |
| `openShareProfileReport(index)` | 生成某档案的分享报告（绿色主题，含趋势柱状图+环形科目概况） |
| `generateAndShowReport()` | 调用 html2canvas 截图并预览 |
| `downloadReport()` | 下载 PNG 图片 |
| `closeShareReport()` | 关闭预览弹窗并清理 |
| `buildExamReportHTML(exam)` | 构建单场考试报告 HTML |
| `buildProfileReportHTML(data)` | 构建档案报告 HTML（含 Chart.js 图表渲染） |

## UI 组件约定

### 弹窗系统

- **不要使用原生 `alert()` / `confirm()` / `prompt()`**（WorkBuddy 内置浏览器会拦截）
- 确认操作使用 `showConfirmDialog()`，支持 `iconType: 'danger'/'success'/'info'`
- 提示信息使用 `showToast()`，**必须传对象参数** `{icon, iconType, title, message}`，不可传纯字符串
- 模态框类名添加 `.active` 显示，移除隐藏

### 色彩系统（CSS 变量）

```css
--bg-primary: #faf8f5;      /* 页面背景 */
--bg-card: #ffffff;          /* 卡片背景 */
--text-primary: #2d2a26;     /* 主文字 */
--text-secondary: #6b6560;   /* 次要文字 */
--accent-warm: #e8a87c;      /* 暖橙强调色 */
--accent-green: #7cb98b;     /* 绿色 */
--accent-blue: #7ca9c9;      /* 蓝色 */
--accent-purple: #9b8dc4;    /* 紫色 */
--border-color: #e8e4de;     /* 边框 */
```

### 排名标签规则

- 班级排名用 **"班X"** 紧凑格式（如 班3）
- 年级排名用 **"校X"** 紧凑格式（如 校28）
- 排名标签显示在总分下方，使用 `.overview-rank-tags` 容器，`justify-content: center` 居中对齐

### 响应式断点

- `768px` 以下为移动端布局
- 移动端侧边栏变为抽屉式，通过汉堡按钮打开

## 排除考试功能

### 概述

用户可在考试列表中点击 🚫/📊 按钮切换某场考试是否计入统计。

### 实现机制

- 考试数据新增 `excluded` 字段（布尔值，默认 `false`）
- `getExams(profileId, excludeHidden)` 第二个参数为 `true` 时过滤掉 `excluded` 的考试
- `toggleExamExclude(examId)` 切换状态并刷新列表和图表
- 所有分析相关调用（`updateTrendChart`、`updateChartTabs`、`renderRadarCompareChips`）使用 `getExams(profileId, true)` 排除
- 被排除考试在列表中显示为半透明+删除线样式（`.is-excluded` class）

### 注意

非分析场景（如考试列表渲染、分享报告）应使用 `getExams(profileId)` 不过滤，确保用户仍能看到所有考试。

## 雷达图（科目对比）

### 概述

雷达图位于「成绩分析」标签下的「科目对比」子标签中。显示各科得分率（score/fullScore×100%）。

### 数据要求

- 至少 3 科有满分数据（fullScore > 0）才能生成
- 没有满分的科目会被过滤掉
- 对比考试中缺少的科目对应的数据点为 null，不绘制

### 多选对比机制

- 用户可点击考试 chip 最多选择 **2 场**考试与当前考试同时对比
- `selectedCompareIds` 数组存储已选对比考试 ID（数字类型）
- 选满 2 场后其余 chip 自动置灰（disabled class）
- 切换考试/档案时自动清理无效的已选 ID

### 配色与样式

当前考试固定红色，对比考试使用 `RADAR_COMPARE_STYLES` 数组（2 种样式）：

| 索引 | 颜色 | 用途 | 填充 | 点样式 | 线宽 |
|------|------|------|------|--------|------|
| 当前 | 红 #E8643C | 当前考试 | ✅ 半透明 | 圆形 | 3px |
| 0 | 蓝 #3278D2 | 对比1 | ✅ 半透明 | 方形 | 3px |
| 1 | 橙 #F0A032 | 对比2 | ✅ 半透明 | 三角形 | 3px |

> **为什么不用红绿配色？** 红绿色盲人群（约占男性 8%）无法区分红色和绿色，蓝/橙是更安全的选择。

### 动画

雷达图初始化和更新时有 800ms `easeOutQuart` 展开动画，图表从中心向外渐次展开。

### Tooltip 规则

- **当前考试**：显示详细分数 + 排名（如 `第一次月考: 108/150  班2  校18`）
- **对比考试**：只显示百分比（如 `第二次月考: 72%`），避免手机端误触信息过载

### 关键变量

- `radarChart`：普通雷达图 Chart.js 实例
- `zoomRadarChart`：放大弹窗雷达图 Chart.js 实例
- `selectedCompareIds`：已选对比考试 ID 数组（数字类型）
- `RADAR_COMPARE_STYLES`：2 种对比样式配置

## 图表放大弹窗

### 概述

趋势图和雷达图卡片右上角有 ⛶ 放大按钮，点击后弹出 92vw × 80vh 的全屏弹窗查看大图。

### 实现

- 弹窗 DOM：`#chartZoomOverlay` > `.chart-zoom-container`
- 趋势放大：复制当前 tab 状态和科目 tabs，支持 tab 切换和排名类型切换
- 雷达放大：复制当前对比选择状态，使用更大字号
- 变量：`zoomTrendChart`、`zoomRadarChart`（独立 Chart.js 实例）
- `closeChartZoom()` 销毁图表实例并隐藏弹窗
- 放大雷达图容器用 `!important` 覆盖继承的 `max-width/max-height` 限制

## 分享报告功能

### 概述

支持生成两种分享报告图片（PNG）：

1. **考试报告**：紫色主题卡片，显示单场考试的总分、各科成绩和排名
2. **档案报告**：绿色主题卡片，显示某档案所有考试的总分趋势柱状图 + 各科平均得分率环形概况

### 实现技术

- 使用 html2canvas 对隐藏渲染区域 `#report-render-wrapper` 截图
- 截图参数：`scale: 2`（高清）、`useCORS: true`
- 预览弹窗 `#reportModalOverlay` 显示截图，支持 PNG 下载
- 档案报告中的图表通过 Chart.js 动态渲染到隐藏 canvas 后再截图

### 关键变量

- `_reportType`：`'exam'` 或 `'profile'`
- `_reportData`：当前报告的数据对象

## Excel 导入导出

### 导出格式

SheetJS 导出为 `.xlsx`，每场考试一个 sheet，sheet 名为考试名称。表头：`科目 | 分数 | 满分 | 班级排名 | 年级排名 | 备注`。总分排名信息在最后一行。

### 导入格式

Excel 第一行为考试信息行：`考试名称, 开始日期, 班级排名, 年级排名, 班级人数, 年级人数`。后续每行为科目数据：`科目名, 分数, 满分, 班级排名, 年级排名, 备注`。

## 常见陷阱

1. **exam.id 是数字类型**，onclick 传参时不要加引号，否则 `indexOf` 严格比较会失败
2. **档案切换下拉框**传的是数组 index 而不是 profile.id
3. **趋势图模式**切换时需要手动调用对应的 update 函数
4. **所有考试共用一个 localStorage 键** `xueji_exams`，通过 `profileId` 过滤（不是按档案分键存储）
5. **科目 fullScore 可能为 0 或不存在**，雷达图需要过滤这类科目
6. **showToast 必须传对象** `{icon, iconType, title, message}`，传纯字符串会导致弹窗一闪消失且无报错
7. **修改 UI 结构后要验证关联功能**：例如档案列表改用整行 onclick 后，`renameProfile()` 中 `querySelector('[onclick*="..."]')` 会找不到元素，需改用 `item.getAttribute('onclick')?.includes(...)`
8. **CSS 继承陷阱**：放大弹窗内的容器可能继承小容器的 `max-width/max-height`，需要 `!important` 覆盖
9. **getExams 的 excludeHidden 参数**：分析场景传 `true`，非分析场景（列表/分享）不传，避免误过滤
10. **图表放大弹窗必须销毁实例**：`closeChartZoom()` 中要 destroy 旧实例，否则重复打开会内存泄漏
