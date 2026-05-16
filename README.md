# Sukačev · 开源视频平台后端

Sukačev开源视频平台的后端微服务，提供视频上传、转码、存储、分发的一站式解决方案。

## 核心概念

Sukačev是一个面向未来的开源视频平台，采用微服务架构设计，支持大规模视频内容的处理与分发。后端服务采用Express + Prisma技术栈，集成FFmpeg实现视频转码，支持P2P内容分发以降低带宽成本。

## 功能特性

- RESTful API（视频/用户/评论/搜索）
- 视频上传与分片处理
- FFmpeg多格式转码（MP4/WebM/HLS）
- PostgreSQL关系数据存储
- P2P内容分发网络
- 实时弹幕WebSocket服务
- JWT身份认证与权限控制

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Node.js | 20 LTS | 运行时 |
| Express | 4.x | Web框架 |
| Prisma | 5.x | ORM |
| PostgreSQL | 16 | 数据库 |
| FFmpeg | 6.x | 视频转码 |
| WebSocket | ws库 | 实时通信 |
| JWT | jsonwebtoken | 身份认证 |

## 快速开始

### 前置条件

- Node.js >= 20
- PostgreSQL >= 16
- FFmpeg

### 安装

```bash
git clone https://github.com/Suk-Builder/sukaczev.git
cd sukaczev
npm install
```

### 配置

```bash
cp .env.example .env
# 编辑 .env 配置数据库连接
```

### 数据库初始化

```bash
npx prisma migrate dev
npx prisma db seed
```

### 运行

```bash
npm run dev   # 开发模式
npm start     # 生产模式
```

## 项目状态

开发中（Dev）— API核心功能已完成，正在优化转码性能与P2P分发效率。

## 关联项目

- [sukaczev-web](https://github.com/Suk-Builder/sukaczev-web) — Web前端（React 19）
- [sukaczev-app](https://github.com/Suk-Builder/sukaczev-app) — 移动端（React Native）

---

Powered by [Suk-Builder](https://github.com/Suk-Builder)
