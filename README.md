<p align="center">
  <img src="docs/app-icon.svg" width="86" alt="ECHO iPhone icon" />
</p>

<h1 align="center">ECHO iPhone</h1>

<p align="center">
  一个为 <a href="https://github.com/Moekotori/ECHO">ECHO NEXT</a> 打造的 iPhone 音乐播放器式伴侣应用。
</p>

<<<<<<< HEAD
<p align="center">
  <a href="README.en.md">English</a> · <strong>中文</strong> · <a href="RELEASE_NOTES.md">Release Notes</a>
</p>
=======
>>>>>>> 5dba9f355773e2c8d60c232faf2a0080f39567c6

![ECHO iPhone preview](docs/preview.svg)

> 这是一个非官方社区项目，不隶属于 ECHO NEXT 官方仓库。
>
> 如果你有版权、建议或问题反馈，可以在 [ECHO 官方 QQ 群](https://qm.qq.com/q/OdpngxJU86) 联系 @白雪ユキ。

## 项目定位

ECHO iPhone 让 iPhone 变成 ECHO NEXT 桌面端的轻量音乐播放器客户端：它可以连接电脑端 EchoLink，浏览电脑本地曲库，控制播放，查看当前播放状态，并在支持的情况下把电脑端音乐串流到手机上播放。

界面方向是灰白、简洁、音乐播放器感。播放页保留居中封面模式，也提供歌词模式：封面左上、歌曲信息右侧、歌词滚动显示、当前歌词发光、底部保留紧凑控制区。

## 当前能力

- EchoLink 配对链接连接和手动局域网连接。
- 播放页、曲库页、连接页三页 dock，并支持左右滑动切换。
- 高斯玻璃感按钮和液态玻璃 dock。
- 实时刷新当前播放状态、歌名、进度、音量和队列。
- 可拖动播放进度条。
- 音量控制支持普通滑条，以及歌词模式下的可展开短滑条。
- 上一首、播放/暂停、下一首。
- 单曲循环，客户端真实可用。
- 播放列表小窗口预览。
- 曲库浏览、搜索、点击歌曲让电脑端播放。
- 歌曲封面显示和失败兜底。
- 歌词面板：拉取 `/lyrics`、解析 LRC 时间戳、当前歌词高亮、点击歌词跳转。
- 控制/串流模式切换：可以控制电脑播放，也可以把支持的本地歌曲串流到手机。
- 曲库与播放页标签：Local、可串流、WASAPI/ASIO、格式、采样率、位深、码率等，取决于桌面端 EchoLink 能提供的信息。

## 当前限制

- 电脑端必须开启 ECHO NEXT 的 EchoLink。
- iPhone 和电脑需要在同一个局域网，Windows 防火墙需要允许 ECHO NEXT 通信。
- 手机串流依赖桌面端 stream 接口，以及 iOS 可播放的音频格式。
- 封面和真实音频 tag 取决于桌面端 EchoLink 返回的数据。
- 本仓库是 Expo / React Native 项目，不是原生 SwiftUI 项目。

## 环境要求

- Node.js 与 npm
- Expo CLI，通过 `npx expo`
- 本地 iOS 构建需要 macOS + Xcode
- Windows 用户可以通过 GitHub Actions 生成未签名 IPA
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

配对链接示例：

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

## EchoLink 协议

桌面端源码参考：

```text
src/main/connect/EchoLinkService.ts
```

移动端当前使用的接口：

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

- `Assets.car` 可以放在仓库根目录，未签名 IPA 脚本会在打包时复制进最终 `.app`。
- README 顶部图标和预览图位于 `docs/`，用于项目展示，不替代 iOS AppIcon 配置。
- 歌曲封面从 EchoLink artwork URL 加载；如果远程图片加载失败，移动端会显示 ECHO 占位。

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
docs/                           README 图标与预览图
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

本轮重点：

- 播放页歌词模式重构。
- 左右滑动切换页面。
- 高斯玻璃感按钮和 dock。
- 中文默认 README、英文切换页、预览图和应用图标展示。
