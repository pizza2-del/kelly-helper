# 凯利仓位助手

一个纯静态、零依赖的 `PWA` 小应用，用来根据凯利公式计算：

- 凯利指数 `f`
- 建议投入比例
- 建议投入金额

## 适用公式

当你提供：

- 盈利金额
- 亏损本金
- 单次盈利概率 `p`
- 亏损概率 `q`

系统先计算盈亏比：

```text
b = 盈利金额 / 亏损本金
```

再计算凯利指数：

```text
f = (b × p - q) / b = p - q / b
```

为了更稳妥，界面默认展示的是“半凯利”建议仓位，你也可以切换到“满凯利”或“四分之一凯利”。

## 本地运行

这个项目不依赖 `npm`。

在当前目录执行：

```powershell
node .\scripts\generate-icons.mjs
node .\serve.mjs
```

然后打开：

```text
http://127.0.0.1:4173
```

## 手机上安装

### 方案一：PWA 安装

最省事的方式是把这个目录部署到带 `HTTPS` 的静态托管平台，例如：

- GitHub Pages
- Netlify
- Vercel
- Cloudflare Pages

部署后：

- 安卓：用 Chrome 打开页面，选择“安装应用”或“添加到主屏幕”
- iPhone：用 Safari 打开页面，选择“添加到主屏幕”

### 方案二：打包成 APK

如果你希望后面直接生成安卓安装包 `APK`，可以再用 `Capacitor` 或 `TWA` 把这个 PWA 包装成原生壳应用。

## 项目名建议

- 凯利仓位助手
- 凯利投入计算器
- KellySizer
- Kelly Pocket
- 凯利随手算
