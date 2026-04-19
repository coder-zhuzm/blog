---
title: 'Colima 入门与实战：在 macOS 上更轻量地使用 Docker、containerd 和 Kubernetes'
description: '从安装、启动到 Docker、containerd、Kubernetes 实战，一篇讲清 Colima 在 macOS 上的常见用法与适用场景。'
pubDate: 'April 19 2026'
updatedDate: 'April 19 2026'
tags: ['containers', 'docker', 'kubernetes', 'macOS', 'devtools']
draft: false
---

如果你在 macOS 上做开发，大概率早就接触过 Docker。

但很多人真正需要的，其实不是一个很重的桌面应用，而是一套“本地能稳定跑容器、命令行好用、配置别太折腾”的环境。Colima 正好就是为这类需求准备的。

简单说，Colima 可以理解成：

> 一个在 macOS 上以更轻量方式运行容器环境的工具。

它基于 Lima，把本地容器运行时、网络、挂载、资源配置这些事情都包装成了更顺手的 CLI 工作流。对很多开发者来说，它是一个很实用的 Docker Desktop 替代方案，尤其适合更偏 terminal-first 的使用习惯。

这篇文章我会从“它适合谁”开始，再讲到安装、常用命令、Docker / containerd / Kubernetes 的基本用法，以及我觉得比较值得注意的几个实践建议。

## Colima 是什么，适合谁用

Colima 的仓库简介非常直接：它的目标是“用尽量少的配置，在 macOS（也支持 Linux）上运行容器 runtime”。

它比较适合下面几类人：

- 在 macOS 上做后端、全栈或基础设施开发的人
- 主要使用命令行，而不是依赖 GUI 管理容器的人
- 想本地跑 Docker、Kubernetes，但希望环境更轻一些的人
- 使用 Apple Silicon，希望本地容器体验更顺手的人

如果你平时只是：

- 拉起几个服务
- 本地构建镜像
- 跑 `docker compose`
- 偶尔开一个 Kubernetes 集群做测试

那 Colima 往往已经够用了，而且体验通常比“完整桌面套件”更直接。

## 它和 Docker Desktop 的关系

一个常见误区是：装了 Colima 之后，是不是就不能再用 `docker` 命令了？

不是。

更准确地说：

- Colima 负责准备并运行本地容器环境
- Docker CLI 仍然是你日常最常用的命令接口

也就是说，Colima 更像是底层运行环境管理器，而不是重新发明一整套容器命令。

对日常开发来说，你的使用方式通常还是：

```bash
colima start
docker ps
docker run hello-world
```

这种感觉很像一句话：same Docker workflow, lighter local runtime。

## 安装：先把最小可用环境跑起来

在 macOS 上最常见的安装方式是 Homebrew。

### 安装 Colima

```bash
brew install colima
```

如果你打算使用 Docker runtime，也建议安装 Docker CLI：

```bash
brew install docker
```

如果你后面要启用 Kubernetes，再安装 `kubectl`：

```bash
brew install kubectl
```

如果你想用 containerd 的完整命令体验，可以再补一个 `nerdctl`，不过 Colima 自己也提供了相关辅助命令。

## 第一次启动：默认就够大多数人用

Colima 最友好的地方之一，是默认值已经能覆盖很多场景。

直接启动：

```bash
colima start
```

启动后就可以直接试：

```bash
docker run hello-world
docker ps
```

如果这两步能通，说明你的本地容器环境已经基本 ready 了。

默认情况下，Colima 会创建一台用于容器运行的虚拟机，默认资源大致是：

- 2 CPU
- 2 GiB 内存
- 100 GiB 磁盘

这个配置对轻量开发够用，但如果你要跑数据库、向量库、多个服务或者本地 Kubernetes，通常建议尽早调大一点。

## 最常用的几个命令

### 启动

```bash
colima start
```

### 停止

```bash
colima stop
```

### 重启

```bash
colima restart
```

### 查看状态

```bash
colima status
```

### 删除当前实例

```bash
colima delete
```

`delete` 会移除实例本身，这个命令要慎用。对于大多数日常场景，`stop` 已经足够。

## 资源配置：别等卡了再改

如果你一开始就知道自己会跑较重的服务，建议直接带参数启动。

例如：

```bash
colima start --cpu 4 --memory 8 --disk 100
```

这表示：

- 4 核 CPU
- 8 GiB 内存
- 100 GiB 磁盘

如果你已经启动过实例，也可以先停掉再按新参数启动：

```bash
colima stop
colima start --cpu 4 --memory 8
```

一个实用建议是：

- 轻量 Web 开发：2 CPU / 4 GiB 基本可用
- 有数据库 + 多服务：4 CPU / 8 GiB 更稳
- 本地 k8s / 较重构建：从 6 CPU / 8~12 GiB 起步更舒服

如果你不想总是敲参数，可以直接编辑配置：

```bash
colima start --edit
```

这会打开配置文件，让你把常用资源设置固定下来。

## Docker 用法：最常见，也是最省心的模式

对于大多数开发者，Colima 最常见的使用方式就是搭配 Docker runtime。

启动默认就是 Docker：

```bash
colima start
```

然后你就能继续使用熟悉的命令：

```bash
docker build -t my-app .
docker run -p 3000:3000 my-app
docker ps
docker images
```

如果你平时使用 `docker compose`，在大多数场景下也能直接接上现有工作流。

例如：

```bash
docker compose up -d
```

对于本地开发，这通常是迁移成本最低的一种方式：

- 你不用改日常命令习惯
- 你不用额外适应新的 GUI
- 你只是在把“本地容器环境”换成 Colima 提供的方案

## containerd 用法：更偏云原生一点

如果你更偏向 containerd 工作流，可以这样启动：

```bash
colima start --runtime containerd
```

随后可以通过 `nerdctl` 使用它：

```bash
nerdctl run hello-world
nerdctl ps
```

Colima 还提供了一个方便的入口：

```bash
colima nerdctl
```

官方也建议安装一个 `nerdctl` alias 到 PATH：

```bash
colima nerdctl install
```

containerd 模式更适合这些场景：

- 你本来就熟悉 containerd / nerdctl
- 你更偏云原生底层工具链
- 你希望尽量贴近某些生产环境的运行方式

但如果你的目标只是“本地日常开发跑容器”，那么 Docker runtime 往往仍然是更省事的选择。

## Kubernetes：适合本地验证，不适合无限堆复杂度

Colima 也支持直接开启 Kubernetes。

先确保安装了 `kubectl`：

```bash
brew install kubectl
```

然后启动：

```bash
colima start --kubernetes
```

试跑一个最简单的 workload：

```bash
kubectl run caddy --image=caddy
kubectl get pods
```

这类本地 k8s 很适合：

- 验证 Helm chart
- 快速测试 deployment / service 配置
- 演练基础 manifests
- 本地做 PoC

但我自己的建议是：

> 本地 Kubernetes 很适合验证，不适合把所有复杂度都塞进去。

如果你的目标只是开发一个应用，很多时候 `docker compose` 反而更直接。只有当你确实需要验证 k8s 行为时，再打开这层复杂度，会更有效率。

### 关于镜像可见性的一点提醒

如果你启用的是 Docker runtime，那么 Docker 构建/拉取的镜像通常能直接被 Kubernetes 使用。

但如果你启用的是 containerd runtime，就要注意镜像 namespace 的区别，尤其是 `k8s.io` 相关 namespace 问题。这个细节在做本地 k8s 调试时很容易踩坑。

## 多实例与场景隔离

Colima 支持多实例，这一点对“同一台机器上跑不同开发环境”很有帮助。

例如你可能会想区分：

- 一个实例专门跑日常 Docker 开发
- 一个实例专门跑 Kubernetes 测试
- 一个实例专门给某个较重项目使用更高资源配置

这样做的价值是，把资源和实验环境隔离开，避免一套配置试图兼顾所有场景，最后谁都不够好用。

## Apple Silicon 下的几个现实建议

如果你是 Apple Silicon 用户，我会建议优先关注下面几点：

### 1. 尽量优先使用原生支持 arm64 的镜像

虽然兼容层越来越强，但如果镜像本身就提供 arm64 支持，整体体验通常会稳定很多。

### 2. 需要兼容 x86 场景时，再考虑额外能力

Colima 支持基于 Apple 的虚拟化能力以及 Rosetta 相关选项。例如：

```bash
colima start --vm-type=vz --vz-rosetta
```

但这更适合你明确知道自己为什么要开，而不是默认全开。保持配置简单，往往更容易排查问题。

### 3. 有本地 AI / GPU 需求时，再看 krunkit 路线

新版本 Colima 已经开始支持面向 AI workload 的 GPU accelerated containers，但它有前提条件，比如 Apple Silicon、macOS 版本以及额外组件。

如果你只是普通 Web / backend 开发，这部分完全可以先忽略。不要为了“听起来很强”就把本地环境复杂化。

## 一个我比较推荐的日常工作流

如果你只是想稳定地本地开发，我会建议从这条最小路径开始：

### 第一步：装好基础工具

```bash
brew install colima docker kubectl
```

### 第二步：按你机器情况给一版保守但够用的资源

```bash
colima start --cpu 4 --memory 8 --disk 100
```

### 第三步：继续用你熟悉的 Docker 工作流

```bash
docker compose up -d
docker ps
```

### 第四步：只有需要验证 k8s 时，再加 `--kubernetes`

也就是说，先保持主路径简单，再按需求叠加能力，而不是一开始就把 Docker、containerd、k8s、兼容层、AI runtime 全部打开。

这类工具最怕的不是功能少，而是“还没真正需要，就先把自己配置复杂了”。

## 常见问题：什么时候 Colima 特别适合你

### 1. 你不想要一个很重的桌面容器工具

那 Colima 很适合。

### 2. 你主要在命令行里工作

那 Colima 会很顺手。

### 3. 你已经有一套 Docker CLI / Compose 工作流

那迁移成本通常不高。

### 4. 你偶尔需要本地 Kubernetes

Colima 也能覆盖这类需求。

### 5. 你想更明确地管理本地容器资源

Colima 的启动参数和配置方式都比较直白，适合精简控制。

## 我对 Colima 的总体看法

如果用一句话总结：

> Colima 不是在发明新的容器技术，而是在把“本地跑容器”这件事做得更轻、更顺、更适合开发者日常使用。

它最打动我的地方，不是功能堆得多，而是它把本地开发真正高频的那部分需求——启动、跑容器、调资源、接 Docker CLI、偶尔开 k8s——处理得足够实用。

对很多 macOS 开发者来说，这已经非常有价值了。

如果你之前一直把本地容器环境理解成“必须配一个大而全的桌面应用”，那 Colima 值得试一次。Once you try it, you may find the lighter workflow hard to give up.
