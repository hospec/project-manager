# Project Manager

> 轻量级项目管理工具 — 单文件运行，浏览器即用

## 功能模块

### 📊 仪表盘
项目概览、任务完成统计、风险列表、截止日期追踪

### ✅ 任务清单
- 类 Excel 行内编辑（标题、状态、优先级、负责人、日期、进展）
- 拖拽排序、跨组移动
- 多维度筛选（状态、优先级、负责人）
- 列宽可拖拽调整

### 📅 日程表
- 按周呈现的日程视图，覆盖整个月
- 每日自由文本输入，失焦自动保存
- 进展情况、风险列与任务清单双向同步
- 已完成/进行中/待办/阻塞状态标识

### 🔖 待办/问题清单
- 行内编辑（标题、状态、优先级、负责人、截止日期）
- 状态筛选

### 📝 关键信息
- 富文本笔记编辑器
- 自动保存，切换不丢数据
- 置顶功能

### 📦 导入/导出
- JSON 格式全量导出/导入
- 项目级导出

---

## 技术栈

| 层 | 技术 |
|----|------|
| 后端 | Go + [chi](https://github.com/go-chi/chi) 路由 + SQLite |
| 前端 | React + TypeScript + Vite + Tailwind CSS v4 |
| 编辑器 | [TipTap](https://tiptap.dev/) |
| 拖拽 | [dnd-kit](https://dndkit.com/) |
| 数据库 | SQLite（嵌入式，无需安装） |

## 快速开始

### 直接运行

下载 `dist/project-manager.exe`（Windows），双击运行，浏览器自动打开 `http://localhost:8080`。

### 开发

```bash
# 后端
cd project-manager
go run .

# 前端（开发模式）
cd project-manager/frontend
npm install
npm run dev

# 构建
bash build.sh      # macOS/Linux
build.bat          # Windows
```

---

## 项目结构

```
project-manager/
├── main.go                     # 入口（HTTP 服务 + 浏览器启动）
├── embed.go                    # 前端静态文件嵌入
├── internal/
│   ├── db/                     # 数据库层
│   │   ├── db.go               # 连接管理
│   │   ├── migrate.go          # 版本化迁移
│   │   ├── models.go           # 数据模型
│   │   └── migrations/         # SQL 迁移文件
│   └── server/                 # API 处理层
│       ├── server.go           # 路由注册
│       ├── projects.go         # 项目 CRUD + 仪表盘
│       ├── tasks.go            # 任务 CRUD + 排序 + 移动
│       ├── taskgroups.go       # 任务组管理
│       ├── calendar.go         # 日程表 + 每日备注
│       ├── issues.go           # 问题清单
│       ├── notes.go            # 笔记
│       └── export.go           # 导入导出
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── dashboard/      # 仪表盘
    │   │   ├── tasks/          # 任务清单
    │   │   ├── calendar/       # 日程表
    │   │   ├── issues/         # 待办/问题
    │   │   ├── notes/          # 笔记
    │   │   ├── layout/         # 布局组件
    │   │   └── common/         # 通用组件
    │   ├── services/api.ts     # API 客户端
    │   └── types/index.ts      # TypeScript 类型
    └── dist/                   # 构建产物（被嵌入 Go 二进制）
```

## License

MIT
