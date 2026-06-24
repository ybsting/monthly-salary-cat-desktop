# 动画与语录数据模块实现文档

## 模块范围

| 文件 | 职责 |
| --- | --- |
| `src/animation/catAnimation.ts` | 定义动画名称、GIF 资源结构、资源自动导入、动画选择和 GIF 选择函数 |
| `src/data/quotes.ts` | 定义点击宠物时展示的打工语录 |
| `src/assets/pet-gifs/*.gif` | 定义月薪喵的 GIF 动画素材 |

## 实现清单

| 名称 | 类型 | 文件 | 行号 | 说明 |
| --- | --- | --- | --- | --- |
| `CatAnimationName` | 类型别名 | `src/animation/catAnimation.ts` | 1 | 约束动画名称为 `idle`、`blink`、`typing` |
| `CatGifAsset` | 接口 | `src/animation/catAnimation.ts` | 3 | 描述一个 GIF 动画资源，包含分组、URL 和建议展示时长 |
| `CatGifAsset.name` | 字段 | `src/animation/catAnimation.ts` | 5 | GIF 所属动画分组 |
| `CatGifAsset.url` | 字段 | `src/animation/catAnimation.ts` | 7 | Vite 打包后的资源地址 |
| `CatGifAsset.duration` | 字段 | `src/animation/catAnimation.ts` | 9 | 当前 GIF 建议展示时长，单位毫秒 |
| `gifModules` | 常量 | `src/animation/catAnimation.ts` | 12 | 使用 Vite `import.meta.glob` 自动导入 `src/assets/pet-gifs/*.gif` |
| `gifNumber(path)` | 函数 | `src/animation/catAnimation.ts` | 19 | 从 GIF 文件路径中解析数字编号 |
| `allGifs` | 常量 | `src/animation/catAnimation.ts` | 24 | 按文件编号排序后的 GIF URL 列表 |
| `byRange(name, start, end, duration)` | 函数 | `src/animation/catAnimation.ts` | 29 | 按编号范围生成指定动画分组的 GIF 资源列表 |
| `catGifAnimations` | 常量 | `src/animation/catAnimation.ts` | 35 | 按编号把 GIF 分到待机、表情和工作动画 |
| `pickNextAnimation()` | 函数 | `src/animation/catAnimation.ts` | 42 | 使用随机数选择下一段动画分组 |
| `pickGif(name, currentUrl)` | 函数 | `src/animation/catAnimation.ts` | 52 | 从指定动画分组中随机选择 GIF，并尽量避免连续重复 |
| `allAvailableGifs()` | 函数 | `src/animation/catAnimation.ts` | 61 | 当指定分组为空时提供兜底 GIF 列表 |
| `workQuotes` | 常量 | `src/data/quotes.ts` | 1 | 点击宠物时可随机展示的语录数组 |
| `WorkQuote` | 类型别名 | `src/data/quotes.ts` | 14 | 从 `workQuotes` 推导出的语录字面量联合类型 |

## 当前 GIF 分组

| 动画 | GIF 编号 | 建议展示时长 |
| --- | --- | --- |
| `idle` | `1.gif` - `8.gif` | 16000ms |
| `blink` | `9.gif` - `14.gif` | 16000ms |
| `typing` | `15.gif` - `20.gif` | 16000ms |

当前素材目录中存在 `15.gif` - `19.gif` 时，`typing` 分组会自动使用这些已有文件；缺失编号不会导致构建失败。

## 当前动画选择概率

`pickNextAnimation()` 当前逻辑：

- `roll < 0.22`：选择 `blink`，约 22%。
- `0.22 <= roll < 0.5`：选择 `typing`，约 28%。
- `roll >= 0.5`：选择 `idle`，约 50%。

## 修改时必须同步的文档

- 新增或删除动画名称、GIF 资源结构字段、语录常量或导出类型：更新本文档。
- 修改动画选择概率、GIF 分组范围、展示时长或资源格式：同步更新 [原理文档](./principle.md)。
- 修改资源文件位置或模块职责：同步更新 [项目总览](../../overview.md)。
