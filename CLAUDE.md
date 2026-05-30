# CLAUDE.md

## 工作原则

### 举一反三 — 全局排查同类问题

当用户指出一个 bug 或问题时，**不能只修复用户指出的那一处**。必须在整个代码库中搜索同类模式，一次性全部修复。

**Why:** 用户不希望反复报告同样的问题。一处有问题，说明其他地方大概率也有。

**How to apply:**
1. 定位根因后，立即用 Grep 在整个项目中搜索相同模式
2. 列出所有受影响的位置，批量修复
3. 修复完成后向用户报告修复了哪些文件、多少处

### Tailwind CSS v4 颜色继承问题

本项目使用 Tailwind CSS v4（`@import "tailwindcss"`），其 Preflight 重置会将所有元素的 `color` 设为 `inherit`，`border-color` 也依赖 `currentColor`。因此所有 UI 元素都必须显式设置颜色：

- 文字元素（label, span, p, h1-h3, td）→ 必须有 `text-gray-*` 或等效颜色类
- 表单控件（input, textarea, select）→ 必须有 `text-gray-900` + `placeholder:text-gray-400`
- 边框 → 必须有 `border-gray-300`（不能只用 `border` 类）
- 聚焦状态 → `focus:border-blue-500 focus:ring-2 focus:ring-blue-500`

**Why:** Tailwind v4 不像 v3 那样提供默认颜色。没有显式颜色 = 不可见或几乎不可见的 UI 元素。

### Go 后端 nil slice → JSON null

Go 的 nil slice 序列化为 JSON `null`，不是 `[]`。前端 React 组件访问 `.length` 会崩溃。所有返回列表的 Go handler 必须初始化空 slice：`result := make([]T, 0)` 或 `[]T{}`。

### 前端表单数据发送

后端全部使用 `json.NewDecoder(r.Body).Decode()` 解析请求体。前端必须发送 JSON：
- `body: JSON.stringify(data)`，不能使用 FormData
- `Content-Type: application/json`

### SQLite 单连接限制 — 禁止嵌套查询

`db.go` 设置了 `SetMaxOpenConns(1)`，SQLite 只有一个连接。**绝对不能在 rows.Next() 循环内发起新的 db.Query()**，否则内层查询会因等待连接而超时（5秒 busy_timeout 后才报错）。

修复方式：先读完所有 rows 到 slice → `rows.Close()` → 再遍历 slice 做内层查询。

### 修复后必须自验证

修复问题后，构建并启动应用，直接调用受影响的 API 验证修复是否生效。不能只改代码就报告"修好了"。
