<p align="center">
  <img src="docs/app-icon.png" width="96" alt="ECHO iPhone app icon" />
</p>

<h1 align="center">ECHO iPhone</h1>

<p align="center">
  一款为 <a href="https://github.com/Moekotori/ECHO">ECHO NEXT</a> 打造的非官方 iPhone 控制器。
</p>

<p align="center">
  <strong>中文</strong> · <a href="README.en.md">English</a> · <a href="RELEASE_NOTES.md">Release Notes</a>
</p>

> 这是一个非官方社区项目，不隶属于 ECHO NEXT 官方仓库。

> 如果你有版权、建议或问题反馈，可以在 [ECHO 官方 QQ 群](https://qm.qq.com/q/OdpngxJU86) 联系 @白雪ユキ。

> 这个项目是我的第一个作品 可能做的很烂 可能烂尾 本项目主要是为了证明windows可以全流程制作ios端软件(除了签名和发布) 感谢理解<3

## 这是什么

ECHO iPhone 把 iPhone 变成 ECHO NEXT 桌面端的音乐控制器/播放器。它通过 EchoLink 连接电脑端，读取当前播放状态，浏览电脑本地曲库，控制播放、进度、音量、队列，并在支持的音频格式下把歌曲串流到手机播放。

这版重点重做了 UI：播放页，封面、歌词、控制区和 dock 都重新整理成统一的玻璃质感界面。歌词界面使用更大的字号、自动滚动和当前行高亮，适合把手机直接当成正在播放的歌词屏。

## 功能亮点

- EchoLink 配对链接连接：支持 `echo://pair?...` 一键填入。
- 手动局域网连接：Host、Port、Token 可独立保存。
- 播放、曲库、连接三页，支持底部 dock 和左右滑动切换。
- 播放页满版重构：封面、歌曲信息、进度、播放控制、音量和输出切换更紧凑。
- 高斯玻璃 UI：播放面板、按钮、dock 和弹层使用 `expo-blur` 统一风格。
- 歌词模式：拉取 `/lyrics`、解析 LRC、自动滚动、当前歌词大字号高亮。
- 歌词点击跳转：有时间戳的歌词行可以直接 seek。
- 稳定封面加载：新封面加载成功前保留上一张封面，减少默认封面闪动。
- 滑条断触修复：进度条和音量条拖动时锁住页面手势，避免界面上滑抢触摸。
- 播放控制：上一首、播放/暂停、下一首、单曲循环、播放列表预览。
- 曲库搜索：浏览 PC 本地曲库，并从手机点歌到电脑端播放。
- 输出切换：可控制电脑播放，也可在支持时串流到 iPhone。
- 音频信息标签：Local、可串流、WASAPI/ASIO、格式、采样率、位深、码率等。

## 当前限制

- 电脑端必须开启 ECHO NEXT 的 EchoLink。
- iPhone 和电脑需要在同一个局域网。
- Windows 防火墙需要允许 ECHO NEXT 通信。
- 手机串流依赖桌面端 stream 接口，以及 iOS 可播放的音频格式。
- 封面、歌词和音频 tag 取决于桌面端 EchoLink 返回的数据。
- 本仓库是 Expo / React Native 项目，不是原生 SwiftUI 项目。

## 环境要求

- Node.js 与 npm
- Expo，通过 `npx expo`
- 本地 iOS 构建需要 macOS + Xcode
- Windows 用户可以通过 GitHub Actions 触发 macOS runner 生成未签名 IPA
- 真机安装需要 Sideloadly、AltStore、Xcode 或其他签名安装方式

## 本地运行

```powershell
npm install
npm run start
```

类型检查：

```powershell
npm run typecheck
```

iOS Expo 导出检查：

```powershell
npx expo export --platform ios --output-dir build\export-check
```

## 连接 ECHO NEXT

可以使用配对链接，也可以手动输入局域网地址。

```text
echo://pair?host=192.168.1.12&port=26789&token=...
```

手动连接字段：

- Host：电脑局域网 IP，例如 `192.168.2.27`
- Port：通常是 `26789`
- Token：从桌面端 EchoLink 配对界面复制

如果连接失败，优先检查：

- iPhone 和电脑是否在同一个 Wi-Fi / LAN。
- ECHO NEXT 是否正在运行，EchoLink 是否开启。
- Windows 防火墙是否允许 ECHO NEXT 在专用网络通信。
- Host 是否填写电脑局域网 IP，而不是 `localhost`、虚拟网卡 IP 或公网 IP。
- iOS 是否允许本地网络权限。

## EchoLink 接口

移动端当前使用：

```text
GET  /echo-link/v1/status
GET  /echo-link/v1/library/tracks?page=1&pageSize=40&q=...
GET  /echo-link/v1/library/albums?page=1&pageSize=40&q=...
GET  /echo-link/v1/library/albums/:albumId/tracks
POST /echo-link/v1/playback/command
POST /echo-link/v1/library/tracks/:trackId/stream
GET  /echo-link/v1/library/tracks/:trackId/lyrics
```

请求头：

```text
Authorization: Bearer <token>
x-echo-link-version: 1
```

## 构建未签名 IPA

iOS 构建仍然依赖 macOS 和 Xcode。Windows 不能直接生成可用 IPA，但可以触发 GitHub Actions。

### GitHub Actions

1. 推送本仓库到 GitHub。
2. 打开 GitHub Actions。
3. 运行 `Build iOS unsigned IPA`。
4. 下载 `ECHO-iPhone-unsigned-ipa` artifact。
5. 使用 Sideloadly、AltStore 或其他方式签名安装。

### 本地 Mac 构建

```bash
bash scripts/build-unsigned-ipa-for-sideloadly.sh
```

输出：

```text
build/ios-unsigned/ECHO-iPhone-unsigned.ipa
```

### Xcode 免费 Apple ID

```bash
bash scripts/build-free-apple-id-with-xcode.sh
```

脚本会打开生成的 Xcode workspace。选择自己的 Apple ID Team，连接 iPhone，然后 Run。

## 资源说明

- `docs/app-icon.png` 是 README 和 Expo 当前共用的应用图标。
- `docs/app-icon.svg` 是同风格的轻量展示版图标。
- `docs/preview.svg` 是 README 顶部 ACG 风格功能预览图。
- `Assets.car` 可以放在仓库根目录，未签名 IPA 脚本会在打包时复制进最终 `.app`。
- 歌曲封面从 EchoLink artwork URL 加载；如果远程图片加载失败，移动端会保留稳定封面或显示 ECHO 占位。

## 项目结构

```text
App.tsx                         主界面、播放控制、歌词和串流逻辑
app.json                        Expo iOS 配置
src/echoLink/client.ts          EchoLink HTTP 客户端
src/echoLink/types.ts           移动端 EchoLink 类型
src/echoLink/pairing.ts         配对 URI 解析
src/storage/connectionStore.ts  本地连接信息保存
scripts/                        iOS 构建辅助脚本
.github/workflows/              未签名 IPA 工作流
docs/                           图标、预览图和 README 资产
```

## 上传清单

建议上传：

- `.github/workflows/build-ios-unsigned.yml`
- `.gitattributes`
- `.gitignore`
- `app.json`
- `App.tsx`
- `Assets.car`
- `package.json`
- `package-lock.json`
- `README.md`
- `README.en.md`
- `RELEASE_NOTES.md`
- `tsconfig.json`
- `docs/`
- `scripts/`
- `src/`

不要上传：

- `node_modules/`
- `build/`
- 生成的 `.ipa` 文件

## Release 更新日志

最新更新请看 [RELEASE_NOTES.md](RELEASE_NOTES.md)。
