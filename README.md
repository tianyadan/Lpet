# Codex Pet Clone

独立桌面宠物运行时，使用 Electron + React + TypeScript + Vite 实现。当前版本复刻 Codex 宠物的基础动画机制，并使用已经生成好的 Neko Star spritesheet。

## 功能

- 透明无边框桌宠窗口
- 始终置顶
- 支持拖拽移动窗口
- 支持 Codex 同款 8x9 spritesheet 动画图集
- 支持 `idle`、`running`、`waiting`、`failed`、`review`、`jumping`、`waving` 等状态
- 右键菜单切换动作
- 支持收起到托盘

## 运行

```bash
npm install
npm run dev
```

## 开发约束

后续让 AI 或开发者修改本项目时，先阅读：

- `AGENTS.md`
- `docs/DEVELOPMENT_GUIDE.md`

## 玩法扩展位置

后续投喂、摸头、换装、情侣互动等玩法，都应该通过 `PetActionRegistry` 注册，不直接写死在渲染组件里。

关键文件：

- `src/pet/PetActionRegistry.ts`
- `src/App.tsx`
- `src/pet/PetRenderer.tsx`
- `electron/main.ts`

## 设计说明

当前只复刻本地桌宠基础能力，远程情侣互动先不接入。后续接服务端时，建议新增：

- `PetProfileStore`：本地状态持久化
- `FeedingService`：投喂业务
- `CoupleSyncService`：WebSocket 跨端同步
- `InteractionEventQueue`：离线事件队列
