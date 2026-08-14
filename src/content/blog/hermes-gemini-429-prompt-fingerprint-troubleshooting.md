---
title: 'Hermes Agent 调用 Gemini 稳定 429：从 System Prompt 指纹到 SOUL.md 修复'
description: '记录 Hermes Agent 经中转网关调用 Gemini 时稳定触发 429 的排查过程，并介绍如何用 SOUL.md 覆盖默认身份提示词。'
pubDate: 'August 14 2026'
updatedDate: 'August 14 2026'
tags: ['ai-agent', 'hermes', 'gemini', 'llm', 'troubleshooting']
draft: false
---

最近用 [Hermes Agent](https://github.com/NousResearch/Hermes-Agent) 通过中转网关调用 Gemini 时，我遇到了一个很像“额度耗尽”、实际却和额度无关的问题。

同一个模型、同一个账号和同一条用户消息，用普通 API 客户端可以正常返回；换成 Hermes 后，请求却总是在等待约 32 秒后报错：

```text
429 RESOURCE_EXHAUSTED
```

最终的有效修复并不是增加配额，也不是修改 Hermes 源码，而是用 `~/.hermes/SOUL.md` 覆盖 Hermes 默认注入的身份提示词。

这篇文章记录完整的判断过程，也会区分哪些是源码和社区案例已经证明的事实，哪些只是根据对照实验得出的推断。

## 先说结论

这次排查得到的结论可以概括成四点：

1. 额度充足时出现 `429 RESOURCE_EXHAUSTED`，不一定真的是速率或配额问题
2. 如果只有特定 Agent 客户端失败，应优先比较它和普通 API 请求的 System Prompt、Headers 与工具定义
3. Hermes 默认身份文本是这次问题的关键差异；覆盖它之后，请求恢复正常
4. `SOUL.md` 是 Hermes 官方支持的身份覆盖机制，比直接修改 Python 源码更稳定

需要说明的是：现有证据可以确认“特定竞争性 Agent 身份提示词可能触发 Antigravity 返回 429”，也可以确认这次修改 Hermes 身份文本后问题消失；但我没有上游内部规则，因此不能把具体匹配算法断言为已经证实的“全词或语义指纹识别”。更准确的说法是：**默认身份提示词高度疑似命中了上游的提示词过滤策略。**

## 问题现场

我使用的是网关暴露的 `gemini-3.7-flash-high` 模型标识。这个名称可能是渠道或网关自定义的别名，不一定对应 Google 官方公开的标准模型名称。

执行最基础的单次探活命令：

```bash
hermes -z "ping" -m gemini-3.7-flash-high
```

请求没有立即失败，而是挂起约 32 秒，随后返回：

```text
litellm.RateLimitError: litellm.RateLimitError: OpenAIException -
Error code: 429 - {'error': {'message': 'RESOURCE_EXHAUSTED', 'code': 429}}
```

一开始很容易把它理解成普通限流，但几个对照现象并不支持这个判断：

- 中转平台显示账号余额以及 RPM、TPM 配额都没有耗尽
- 使用普通 API 脚本调用同一模型可以正常流式返回
- Hermes 调用其他渠道或模型正常
- 只有 Hermes 与该 Gemini 渠道的组合稳定复现

如果真是通用配额不足，那么不同客户端通常应该表现一致。现在故障只跟着客户端变化，排查重点自然应该从“额度”转向“请求内容有什么不同”。

## 缩小范围：Hermes 比普通请求多发了什么

普通脚本只发送一条简短用户消息，而 Agent 框架通常还会组装：

- System Prompt
- Agent 身份描述
- 工具定义
- Skills 与记忆上下文
- 运行环境信息
- 额外请求头

逐项缩小差异后，我把注意力放到了 Hermes 的默认身份提示词上。

Hermes 当前源码在 `agent/prompt_builder.py` 中定义了默认身份：

```python
DEFAULT_AGENT_IDENTITY = (
    "You are Hermes Agent, an intelligent AI assistant created by Nous Research. "
    "You are helpful, knowledgeable, and direct. ..."
)
```

首次运行生成的默认 `SOUL.md` 也使用了同一段身份文本。也就是说，即使用户消息只有一个 `ping`，实际提交给模型的上下文仍可能带有明确的 Hermes / Nous Research 身份特征。

## 外部案例能证明什么

9router 社区里有两个与本次现象接近的记录。

[Issue #3274](https://github.com/decolua/9router/issues/3274) 记录了升级后，Antigravity 在账号额度仍为 100% 时持续返回 `429 resource has been exhausted`。这个 Issue 能证明“429 与后台显示配额不一致”的现象确实存在，但没有给出完整根因。

[PR #3223](https://github.com/decolua/9router/pull/3223) 则提供了更直接的线索：提交者在 `AntigravityExecutor` 中删除一段带有 Claude Agent 身份的 System Prompt，以避免请求被 Antigravity 用 quota-exhausted 响应拦截。这个 PR 最终关闭且没有合并，因此不能当作 9router 已采用的正式修复，但它证明了至少存在一个“特定 Agent 身份文本与 429 强相关”的复现案例。

把这些记录与本地对照实验放在一起，可以形成一条相对可靠的推理链：

```text
普通 API 请求正常
  ↓
Hermes 请求稳定 429
  ↓
覆盖 Hermes 默认身份后恢复
  ↓
社区存在其他 Agent 身份文本触发同类 429 的案例
  ↓
默认 System Prompt 高度疑似命中了上游过滤策略
```

这里仍然要保留边界：我能观察到输入变化与结果变化，但无法看到 Antigravity 内部实现，所以不对它究竟采用精确字符串、模糊匹配还是其他分类方式下定论。

## 修复：用 SOUL.md 覆盖默认身份

直接修改 Hermes 安装目录里的 Python 源码当然可以绕开默认文本，但这种改法有两个明显问题：

- 升级或重新安装后容易被覆盖
- 修改的是程序实现，而不是官方预留的用户配置层

Hermes 官方支持通过全局 `SOUL.md` 定义 Agent 身份。文档说明，这个文件会作为系统提示词中的身份槽位，**完整替换内置默认身份文本**。

默认路径是：

```text
~/.hermes/SOUL.md
```

如果设置了自定义 `HERMES_HOME`，对应路径则是：

```text
$HERMES_HOME/SOUL.md
```

### 创建或编辑 SOUL.md

```bash
mkdir -p ~/.hermes

cat <<'EOF' > ~/.hermes/SOUL.md
你是一个高效、严谨、直接的智能助手和开发伙伴。
你沟通清晰，在不确定时坦率说明，并始终优先解决实际问题。
你的探索与排查应当有的放矢、准确高效。
EOF
```

这里并不需要写复杂人设。重点是提供一段真实、稳定且不包含默认 Hermes 身份签名的自定义内容。

如果原本已经维护了 `SOUL.md`，不要直接覆盖；先备份现有内容，再进行小范围修改。

### 重新验证

创建新会话后，再次执行：

```bash
hermes -z "ping" -m gemini-3.7-flash-high
```

在我的环境中，原先约 32 秒后稳定出现的 429 不再复现，模型恢复正常流式响应，后续多轮对话和工具调用也可以继续工作。

## 为什么这种修复更合适

`SOUL.md` 并不是专门用于“绕过过滤”的补丁，而是 Hermes 官方提供的身份定制入口。用它解决问题有几个实际好处：

- 不改源码，升级 Hermes 时不容易丢失
- 配置意图明确，后续排查时更容易发现
- 可以同时建立更符合个人工作方式的默认沟通风格
- 如果需要回退，只需恢复原文件

不过，这种处理只适合解决“默认身份文本与渠道策略不兼容”的情况。它不能替代正常的配额、账号、网络和网关排查，也不代表任何第三方渠道都会稳定支持相同请求。

使用聚合或中转服务时，还应自行确认渠道来源、隐私边界以及相关服务条款。不要把账号凭据、长期 Token 或敏感上下文交给不可信的中转服务。

## 一套更通用的 429 排查顺序

以后再遇到类似问题，可以按下面的顺序缩小范围：

1. 检查平台余额、RPM、TPM 和并发限制
2. 用最小化 API 请求调用同一模型
3. 保持账号、模型和用户消息不变，只替换客户端
4. 比较 System Prompt、Headers、工具定义与消息结构
5. 逐项删除额外上下文，寻找最小触发条件
6. 优先使用框架提供的配置层修复
7. 最后才考虑修改源码或在网关层做清洗

这种方法的关键是控制变量。不要因为错误码写着 `RateLimit`，就把所有时间都花在额度上。

## 总结

这次问题最值得记录的，不只是如何编辑一个 `SOUL.md`，而是一个更通用的排障经验：

> 当服务端错误码与配额事实矛盾，而且故障只在特定客户端出现时，应把客户端注入的上下文也视为协议的一部分。

最终结果是：不修改 Hermes 源码，只用官方支持的身份覆盖机制，就消除了稳定复现的 429。

至于上游到底使用了哪一种匹配算法，现有公开证据还不足以下定论。把可观察事实、对照实验和推断分开，反而能让这份排障记录在以后更有参考价值。

## 参考资料

- [Hermes Agent 源码仓库](https://github.com/NousResearch/Hermes-Agent)
- [Hermes 官方文档：Use SOUL.md with Hermes](https://hermes-agent.nousresearch.com/docs/guides/use-soul-with-hermes)
- [9router Issue #3274：额度充足时 Antigravity 返回 429](https://github.com/decolua/9router/issues/3274)
- [9router PR #3223：清理竞争性 System Prompt 的尝试](https://github.com/decolua/9router/pull/3223)
