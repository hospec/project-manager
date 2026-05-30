# Version History

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
