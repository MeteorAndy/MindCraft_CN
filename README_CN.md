# Mindcraft 🧠⛏️

使用大型语言模型和[Mineflayer!](https://prismarinejs.github.io/mineflayer/#/)为《我的世界》打造智能体

[常见问题](https://github.com/kolbytn/mindcraft/blob/main/FAQ.md) | [Discord支持](https://discord.gg/mp73p35dzC) | [English Version](README.md) | [视频教程](https://www.youtube.com/watch?v=gRotoL8P8D8) | [博客文章](https://kolbynottingham.com/mindcraft/) | [贡献者TODO](https://github.com/users/kolbytn/projects/1)

> [!Caution]
请勿将开启代码编写功能的机器人连接到公共服务器。本项目允许LLM在您的计算机上编写/执行代码，代码虽然运行在沙箱中但仍存在注入攻击风险。代码编写功能默认关闭，如需启用请在`settings.js`中将`allow_insecure_coding`设为`true`。后果自负。

## 环境要求

- [Minecraft Java版](https://www.minecraft.net/zh-hans/store/minecraft-java-bedrock-edition-pc) (最高支持v1.21.1，推荐v1.20.4)
- [Node.js](https://nodejs.org/) (至少v14版本)
- [pnpm](https://pnpm.io/) (至少v9版本)
- 任选其一API密钥：[OpenAI](https://openai.com/blog/openai-api) | [Gemini](https://aistudio.google.com/app/apikey) | [Anthropic](https://docs.anthropic.com/claude/docs/getting-access-to-claude) | [Replicate](https://replicate.com/) | [Hugging Face](https://huggingface.co/) | [Groq](https://console.groq.com/keys) | [Ollama](https://ollama.com/download) | [Mistral](https://docs.mistral.ai/getting-started/models/models_overview/) | [通义千问[国际]](https://www.alibabacloud.com/help/en/model-studio/developer-reference/get-api-key)/[国内](https://help.aliyun.com/zh/model-studio/getting-started/first-api-call-to-qwen?) | [Novita AI](https://novita.ai/settings?utm_source=github_mindcraft&utm_medium=github_readme&utm_campaign=link#key-management) |

## 安装与运行

1. 确保满足上述环境要求
2. 克隆或下载本仓库（点击绿色Code按钮）
3. 将`keys.example.json`重命名为`keys.json`并填写API密钥（只需其中一个）。默认模型配置见`andy.json`或其他角色配置文件，其他模型支持详见下表
4. 在终端中执行`pnpm install`（项目目录下）
5. 启动《我的世界》并开启局域网联机（本地主机端口`55916`）
6. 运行`node main.js`

遇到问题请查看[常见问题解答](https://github.com/kolbytn/mindcraft/blob/main/FAQ.md)或加入[Discord支持频道](https://discord.gg/mp73p35dzC)。我们目前较少响应GitHub问题。

## 包管理

本项目使用[pnpm](https://pnpm.io/)工作区功能，具体依赖版本锁定在`pnpm-lock.yaml`，工作区配置定义于`pnpm-workspace.yaml`。

## 模型配置

您可以通过`settings.js`配置项目细节，通过角色配置文件（如`andy.json`）中的`model`字段配置智能体的名称、模型和提示词。完整配置说明详见[模型规格](#模型规格)。

| API服务 | 配置变量 | 示例模型 | 文档 |
|------|------|------|------|
| `openai` | `OPENAI_API_KEY` | `gpt-4o-mini` | [文档](https://platform.openai.com/docs/models) |
| `google` | `GEMINI_API_KEY` | `gemini-2.0-flash` | [文档](https://ai.google.dev/gemini-api/docs/models/gemini) |
| `anthropic` | `ANTHROPIC_API_KEY` | `claude-3-haiku-20240307` | [文档](https://docs.anthropic.com/claude/docs/models-overview) |
| `xai` | `XAI_API_KEY` | `grok-2-1212` | [文档](https://docs.x.ai/docs) |
| `deepseek` | `DEEPSEEK_API_KEY` | `deepseek-chat` | [文档](https://api-docs.deepseek.com/) |
| `ollama` (本地) | 无需 | `ollama/llama3.1` | [文档](https://ollama.com/library) |
| `qwen` | `QWEN_API_KEY` | `qwen-max` | [国际版](https://www.alibabacloud.com/help/en/model-studio/developer-reference/use-qwen-by-calling-api)/[国内版](https://help.aliyun.com/zh/model-studio/getting-started/models) |
| `mistral` | `MISTRAL_API_KEY` | `mistral-large-latest` | [文档](https://docs.mistral.ai/getting-started/models/models_overview/) |
| `replicate` | `REPLICATE_API_KEY` | `replicate/meta/meta-llama-3-70b-instruct` | [文档](https://replicate.com/collections/language-models) |
| `groq` | `GROQCLOUD_API_KEY` | `groq/mixtral-8x7b-32768` | [文档](https://console.groq.com/docs/models) |
| `huggingface` | `HUGGINGFACE_API_KEY` | `huggingface/mistralai/Mistral-Nemo-Instruct-2407` | [文档](https://huggingface.co/models) |
| `novita` | `NOVITA_API_KEY` | `novita/deepseek/deepseek-r1` | [文档](https://novita.ai/model-api/product/llm-api?utm_source=github_mindcraft&utm_medium=github_readme&utm_campaign=link) |
| `openrouter` | `OPENROUTER_API_KEY` | `openrouter/anthropic/claude-3.5-sonnet` | [文档](https://openrouter.ai/models) |
| `glhf.chat` | `GHLF_API_KEY` | `glhf/hf:meta-llama/Llama-3.1-405B-Instruct` | [文档](https://glhf.chat/user-settings/api) |
| `hyperbolic` | `HYPERBOLIC_API_KEY` | `hyperbolic/deepseek-ai/DeepSeek-V3` | [文档](https://docs.hyperbolic.xyz/docs/getting-started) |

使用Ollama时，执行以下命令安装默认模型：
`ollama pull llama3.1 && ollama pull nomic-embed-text`

### 在线服务器连接

连接在线服务器需要正版Microsoft/Minecraft账号。配置方法：
```javascript
"host": "111.222.333.444",
"port": 55920,
"auth": "microsoft",
// 其余配置保持不变...
```
> [!重要]
> 角色配置文件中的名称必须与Minecraft个人资料名称完全一致！否则机器人会自言自语。

### Docker容器

建议在启用`allow_insecure_coding`时使用Docker容器运行以降低风险：
```bash
docker run -i -t --rm -v $(pwd):/app -w /app -p 3000-3003:3000-3003 node:latest node main.js
```
或直接使用：
```bash
docker-compose up
```
连接本地服务器时需使用特殊地址：
```javascript
"host": "host.docker.internal", // 替代"localhost"
```

# 角色配置

角色配置文件（如`andy.json`）定义：
1. 使用的LLM后端（对话、编码、视觉）
2. 影响行为的提示词
3. 任务示例

## 模型规格

LLM模型可简写为`"model": "gpt-4o"`，也可通过对象配置：
```json
{
  "api": "openai",
  "model": "gpt-4o",
  "url": "https://api.openai.com/v1/",
  "params": {
    "max_tokens": 1000,
    "temperature": 1
  }
}
```
`model`用于对话，`code_model`用于编码，`vision_model`用于图像理解，`embedding`用于文本嵌入。未指定时默认使用`model`。

## 引用
```
@misc{mindcraft2023,
    Author = {Kolby Nottingham and Max Robinson},
    Title = {MINDcraft: LLM Agents for cooperation, competition, and creativity in Minecraft},
    Year = {2023},
    url={https://github.com/kolbytn/mindcraft}
}
```