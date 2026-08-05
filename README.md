This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

看完了。这是 op7418 的 Claude-to-IM-skill(约 2.8k star),我核对了 SKILL.md、README 和仓库源码。

它是什么
把 Claude Code / Codex 这个"写代码的 agent"桥接到 IM 平台(Telegram、Discord、飞书、QQ、微信),让你在手机上跟它聊天、批准它执行操作。


你在 IM 里发消息
   ↕ Bot API
后台守护进程 (Node.js)
   ↕ Claude Agent SDK / Codex SDK
Claude Code / Codex → 读写你的代码库
装法:npx skills add op7418/Claude-to-IM-skill,然后 /claude-to-im setup 走引导、start 启动
子命令:setup / start / stop / status / logs / reconfigure / doctor
权限模型:工具调用要在聊天里点允许/拒绝按钮(Telegram/Discord),或回 /perm / 1/2/3(飞书/QQ/微信)
微信走二维码登录(npm run weixin:login),单账号模式
⚠️ 一个实锤问题:安装链是断的
我拉了它的 package.json 验证过:


"dependencies": {
  "@anthropic-ai/claude-agent-sdk": "^0.2.62",
  "claude-to-im": "file:../Claude-to-IM",   // ← 期望旁边躺着另一个核心仓库
  ...
}
它依赖一个相邻的核心仓库 op7418/Claude-to-IM(lib/bridge 在那里面),但 npx skills add 不会自动拉它。所以单独 clone 这个 skill 装会报 lib/bridge 缺失(GitHub issue #107/#115)。要装得同时 clone 两个仓库放一起。它还有个带 GUI 的兄弟项目 CodePilot,本 skill 就是从那里抽出来的。

跟你项目的关联
要分清一个关键点:这是"手机遥控写代码的 agent",不是给商家用的聊天机器人框架。不能直接拿来给你的客户经营助手用。

但有两个值得你关注的点:

权限审批流正是你之前担心的问题:工具调用要人在聊天里批——这就是"agent + tool use"的形态。它跑在本地 Claude Code CLI 上,有完整 tool use,完全绕开了你中转的 thinking 限制。但那是"开发用的 agent",不是你网页 App 里的 AI。
架构蓝图:如果以后你想让老板在微信/飞书里直接跟你的 AI 助手对话、让它查客户库、写跟进记录——这个"IM 通道 → 守护进程 → agent SDK → 工具审批 → 流式回复"的设计思路很值得抄。但你的实现得自己做:基于你中转的 OpenAI 兼容端点 + gpt-5.4 强制 function calling,再加一层权限确认。
要不要我基于这个架构,给你画一个「微信/飞书接入客户经营助手」的可行方案?

Sources:

op7418/Claude-to-IM-skill (GitHub)
SKILL.md
Open Agent Skills 审查页
skills.sh 页面