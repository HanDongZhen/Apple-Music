# GitHub → Cloudflare Pages → Private R2

这是部署操作说明，不代表当前环境已经部署。工程不需要任何云凭据即可本地运行；生产部署需要你自己的 Cloudflare 账号、域名和 Access 配置。

## 1. 代码与 Pages

将此目录作为独立 Git 仓库推送到自己的 GitHub。不要添加 `private-library/`、音频、`.env`、`.dev.vars` 或凭据。仓库中已有忽略规则和 CI。

Cloudflare Pages 连接该 GitHub 仓库：

| 项目               | 值                    |
| ------------------ | --------------------- |
| Framework          | React / Vite          |
| Build command      | `npm run build`       |
| Output directory   | `dist`                |
| Node               | 22.12+ 或 24          |
| `VITE_LIBRARY_URL` | `/media/library.json` |

添加自定义域名，例如 `music.example.com`。`public/_redirects` 让专辑和歌手深链接回退至 SPA；`_headers` 配置 CSP、禁止嵌入与资源缓存。`VITE_` 变量是公开构建值，**不能放密钥**。

也可登录 Wrangler 后执行：

```bash
npm run build
npx wrangler pages deploy dist --project-name mr-han-music
```

Pages 默认域名和 preview deployment 也应配置访问保护；不要只保护自定义域名却留下可访问的 `pages.dev` 别名。

## 2. 私有 R2

创建名为 `mr-han-music-private` 的 R2 Bucket，保持 Public Access / `r2.dev` 关闭。Worker 的 R2 binding 直接读取 Bucket，不需要把 R2 密钥放进应用。

准备文件：

```bash
npm run scan-library -- /absolute/path/to/your/music \
  --out private-library --base-url /media
```

检查 `private-library/library.json` 与 `upload-manifest.json`。清单中 `source` 是本机路径，`key` 是 R2 object key；请只使用自己生成的可信清单。索引中使用 `/media/music/...`、`/media/artwork/...`、`/media/lyrics/...`。

显式上传（此命令会真正写入 R2）：

```bash
node scripts/upload-library.mjs private-library/upload-manifest.json mr-han-music-private
```

此辅助脚本调用登录后的 Wrangler，逐文件上传，最后写入索引；文件内容不变。**Wrangler 单对象上传有大小限制**，长时间高解析 WAV 可能超过限制。较大文件请通过 R2 的 S3-compatible API 使用支持 multipart 的工具（例如 `aws s3 cp` 或 rclone），按清单中的 `key` 上传，最后更新 `library.json`。S3 密钥只存在于本机凭据配置 / 环境变量中，绝不写进前端或 Git。

## 3. Cloudflare Access

在 Zero Trust → Access 中建立 Self-hosted application，覆盖整个 `music.example.com/*`。仅允许自己的邮箱 / 身份，不添加公开 Bypass 规则。记录：

- Team domain，例如 `your-team.cloudflareaccess.com`。
- Application Audience (AUD) tag。

Access 在请求到达 Worker 前附加 `Cf-Access-Jwt-Assertion`。Worker 不盲目信任这个 header，会从团队 JWKS 验证 RS256 签名、issuer、audience 和 expiry。没有合法 token 时，R2 不会被读取。

## 4. 媒体 Worker

编辑 `cloudflare/wrangler.toml` 中的 `APP_ORIGIN`、`ACCESS_TEAM_DOMAIN` 和 Bucket 名。配置 Worker route：

```toml
routes = [
  { pattern = "music.example.com/media/*", zone_name = "example.com" }
]
```

将 `routes` 放在文件顶层（`[vars]` 之前）。同域 `/media/*` 避免第三方 Cookie、跨域 Access 登录和 CORS 的复杂性。

```bash
npx wrangler secret put ACCESS_AUD --config cloudflare/wrangler.toml
npm run deploy:media
```

`workers_dev = false` 用于避免不必要的公开备用入口。私有 Bucket 的访问通过 binding 完成；不需要在 Worker 配置 R2 Secret Access Key。

## 5. 部署后验证

1. 无登录访问应用和 `/media/library.json`：应进入 Access 登录或被拒绝。
2. 登录允许的本人身份后：真实资料库加载，首曲可播放。
3. DevTools 网络页确认音频请求支持 `Range`，响应为 `206`，且 `Accept-Ranges: bytes`、`Content-Range`、`Content-Length` 和 MIME 正确。
4. 对大型 WAV 跳到后半段，确认请求仅取所需字节，而非应用将整个文件缓冲到 Worker 内存。
5. 手机主屏幕安装、后台 / 锁屏与蓝牙控制、Safari FLAC / ALAC、实际 DAC 输出情况分别做真机验证。
6. 检查公开 `pages.dev` / Worker 别名没有绕过私人访问策略。

## 安全与缓存边界

- 音频使用 `private, no-store`；所有 `/media/*` 默认绕过 Service Worker Cache。用户明确导入的本地 Blob 与歌词保存在自己的浏览器存储。
- App Shell 与公开静态资源可离线使用。Access 退出登录不等于清除 IndexedDB；在共享设备上，应使用独立浏览器资料或清除站点数据。
- CORS 只允许配置的 `APP_ORIGIN`。CORS 不是鉴权，JWT 校验始终独立执行。
- Range 支持单段、开放结尾、suffix；不支持 multipart-range，会返回 416。
- 测试覆盖模拟 R2 和真实密码学 JWT 验证，但不代替在真实账户上检查 Access 路由与 Bucket 配置。

## 回滚与日常维护

应用版本通过 Pages deployment 回滚；Worker 使用 Cloudflare deployment history 回滚。更新音乐时，先上传音频、封面与歌词，再更新索引。保持原始音乐的单独备份。

本地 dry run：

```bash
npx wrangler deploy --dry-run --config cloudflare/wrangler.toml
```

dry run 只验证 Worker 打包，不创建云资源、不证明生产权限或路由已经正确。
