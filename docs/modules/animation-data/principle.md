# 动画与语录数据模块原理文档

## 核心思路

动画与语录数据模块把“数据定义”和“组件播放逻辑”分离。组件只关心当前应该展示哪个 GIF URL，动画模块负责自动导入 GIF、按编号分组、给出下一段动画选择策略，语录模块负责提供随机文案池。

## 动画数据原理

每个动画由一组 `CatGifAsset` 组成。`url` 对应 Vite 打包后的 GIF 资源地址，`duration` 表示该 GIF 建议展示多久。GIF 自身负责逐帧播放，前端组件只负责在不同 GIF 之间切换。

这种结构的好处是：

- 新增动画只需要扩展 `CatAnimationName` 和 `catGifAnimations`。
- 调整节奏只需要修改 `duration`。
- 替换素材时，只要把 GIF 放进 `src/assets/pet-gifs` 并保持编号约定，组件逻辑可以不变。
- 如果未来改为 PNG sprite 或 canvas，可在本模块保留分组策略，再同步调整渲染组件。

## 下一段动画选择原理

`pickNextAnimation()`（`src/animation/catAnimation.ts`）使用 `Math.random()` 得到 0 到 1 之间的随机数，并通过阈值区间选择动画。当前策略让待机动画占比最高，眨眼和敲键盘作为穿插动作，从而避免桌面宠物一直高频运动。

## 语录数据原理

`workQuotes` 使用 `as const` 固定为只读字面量数组，`WorkQuote` 从数组反推类型。这样语录内容和类型来源保持一致，后续如果其他函数需要接收“合法语录”，可以直接使用 `WorkQuote`。

## 资源命名约定

GIF 文件使用数字命名，当前编号分组如下：

- `1.gif` - `8.gif`：待机。
- `9.gif` - `14.gif`：眨眼/表情。
- `15.gif` - `20.gif`：敲键盘/工作。

新增或替换素材时需要同时检查：

- GIF 是否位于 `src/assets/pet-gifs`。
- 文件编号是否落在预期分组。
- `catAnimation.ts` 的编号范围和展示时长是否需要调整。
- 本模块实现文档中的分组说明是否已更新。
