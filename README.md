# MARD 拼豆图纸设计软件

专为 MARD 221 色拼豆设计的桌面图纸编辑工具，基于 Electron + React + TypeScript 构建。

![Platform](https://img.shields.io/badge/platform-macOS-lightgrey)
![Version](https://img.shields.io/badge/version-0.1.0-blue)

---

## 功能特性

### 绘图工具
- **画笔** — 单格或多格（1×1 / 3×3 / 5×5）涂色
- **橡皮** — 清除格子颜色
- **油漆桶** — 区域填充，一键涂满同色区域
- **吸管** — 点击画布取色，快速切换当前颜色
- **魔棒** — 智能选择相邻同色区域
- **框选** — 矩形区域选取

### 图片导入
- 支持拖拽图片直接导入
- 自动将图片颜色量化映射到 MARD 221 色
- 可调整图片缩放和位置
- 自动识别并去除纯色背景

### 导出图纸
- 导出高清 PNG 图纸
- 可调节每格像素大小（10px ~ 80px）
- 支持显示色号文字标注
- 支持黑白涂色版（只保留网格线和色号，方便手工对照）

### 其他
- 完整的撤销 / 重做历史
- 右侧色板显示全部 221 种 MARD 颜色
- 实时统计各颜色用量，方便备料

---

## 画布规格

| 项目 | 参数 |
|------|------|
| 画布大小 | 52 × 52 格 |
| 颜色库 | MARD 221 色 |

---

## 开发环境运行

```bash
# 安装依赖
npm install

# 启动开发模式（浏览器）
npm run dev

# 启动 Electron 开发模式
npm run electron:dev
```

## 打包为 macOS 应用

```bash
npm run dist
```

打包完成后在 `release/` 目录下生成 `.dmg` 安装包。

---

## 技术栈

- [Electron](https://www.electronjs.org/) — 桌面应用框架
- [React 18](https://react.dev/) — UI 框架
- [TypeScript](https://www.typescriptlang.org/) — 类型安全
- [Vite](https://vitejs.dev/) — 构建工具
- [Zustand](https://zustand-demo.pmnd.rs/) — 状态管理

---

## 作者

huojianbin
