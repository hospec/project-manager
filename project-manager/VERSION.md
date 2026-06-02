# Version History

## v0.2.2 — 2026-06-02

### 修复 (6 issues)

1. **删除项目阶段错误提示** — API 错误响应 JSON 现在正确解析，toast 显示干净的错误信息而非原始 JSON
2. **负责人下拉选择** — 任务清单和待办清单的行内编辑负责人字段，现在支持从已配置人员中下拉选择
3. **Excel 导入状态/优先级转换** — 中文标签（待办/进行中等）自动转换为英文值（todo/in_progress），不再全部显示为"阻塞"
4. **Excel 导入日期格式** — 支持多种日期格式（2026/6/1、06-01-26、Excel 序列号等）自动规范化为 YYYY-MM-DD，日程表正确显示
5. **日程表日期偏移一天** — toDateStr 改用本地时间代替 UTC，消除 UTC+8 时区导致的一天偏移
6. **导入后列表不刷新** — await invalidateQueries 确保数据刷新完成后再结束

### 优化 (2 issues)

1. **日程表刷新加速** — staleTime 设为 0，任务增删改时同步 invalidate 日历缓存
2. **日期选择一键弹出** — 点击日期单元格直接调用 showPicker()，无需二次点击

### 涉及文件
- `frontend/src/services/api.ts` — 错误响应 JSON 解析
- `frontend/src/components/tasks/TaskTableRow.tsx` — 负责人下拉 + 日历缓存 + showPicker
- `frontend/src/components/tasks/TaskTablePage.tsx` — 导入 await + 日历缓存
- `frontend/src/components/issues/IssueListPage.tsx` — 负责人下拉 + showPicker
- `frontend/src/components/calendar/CalendarPage.tsx` — 时区修复 + staleTime
- `internal/server/excel.go` — 状态/优先级转换 + 日期规范化

## v0.1.2 — 2026-05-30

**Commit:** 766d3e0

### 修复 (2 issues)

1. **进展输入框自适应大小** — textarea 现在随输入内容自动扩高（监听 onChange + 初始化时 resize），不再限制固定行数
2. **拖拽排序修复（第二轮）** — 根本原因分析：
   - 任务拖拽手柄和组拖拽手柄都调用了 `e.stopPropagation()`，阻止 dnd-kit PointerSensor 接收事件
   - 添加 `setActivatorNodeRef` 到拖拽手柄（`@dnd-kit/sortable` v10 最佳实践）
   - 碰撞检测从 `closestCenter` 改为 `rectIntersection`（更适合嵌套 SortableContext 的布局）
   - 为 `reorderTasksMu` 添加 `onSuccess` 回调确保排序持久化

### 涉及文件
- `frontend/src/components/tasks/TaskTableRow.tsx` — auto-resize textarea + setActivatorNodeRef + remove stopPropagation
- `frontend/src/components/tasks/TaskGroupHeader.tsx` — setActivatorNodeRef + remove stopPropagation on grip
- `frontend/src/components/tasks/TaskTablePage.tsx` — closestCenter→rectIntersection + onSuccess for reorderTasksMu

## v0.1.1 — 2026-05-30

**Commit:** 766d3e0

### 修复 (4 issues)

1. **拖拽排序修复** — 移除拖拽手柄 `onPointerDown` 中的 `e.stopPropagation()`，之前它阻止了 dnd-kit PointerSensor 接收事件，导致任务完全无法拖拽
2. **列宽调整修复** — 移除所有列的 `flex: 1 1 auto`，全部改为 `flex: none` 固定宽度，彻底解决表头和表体列不对齐的问题；`#` 列现在也可调整宽度；表格容器添加 `overflow-x: auto` 支持横向滚动
3. **进展输入框提示文字移除** — 删除 textarea 下方 "Shift+Enter 保存" 提示，避免遮挡输入
4. **列宽持久化** — localStorage 读写机制已存在且正确，修复列宽调整后持久化自然生效

### 涉及文件
- `frontend/src/components/tasks/TaskTableRow.tsx` — 移除 stopPropagation + 移除 flex-grow + 移除提示文字
- `frontend/src/components/tasks/TaskTableHeader.tsx` — `#` 列可调整 + 所有列 flex:none
- `frontend/src/components/tasks/TaskTablePage.tsx` — DEFAULT_COL_WIDTHS title 200→300 + Add Task 行 flex:none
- `frontend/src/index.css` — .task-table 添加 overflow-x: auto
