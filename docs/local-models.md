# Managed local models

The built-in local provider runs the OpenAI-compatible `llama-server` from llama.cpp as a child process owned by TheBerry. This first release targets Windows x64. The server binds only to `127.0.0.1`; TheBerry tries the CUDA 12.4 build, then Vulkan, then CPU. GPU acceleration requires a compatible GPU driver. The model weights are kept in the user's selected TheBerry data directory under `local-models/` and are never placed in the installer.

## Runtime and notices

Windows release builds package the CPU, Vulkan, and CUDA 12.4 Windows x64 binaries from the pinned [llama.cpp b11425 release](https://github.com/ggml-org/llama.cpp/releases/tag/b11425). The build script also stores the upstream [MIT license](https://github.com/ggml-org/llama.cpp/blob/b11425/LICENSE) alongside those binaries. Release archives retain any license and notice files they contain.

The launcher manages server startup and shutdown, selects a free loopback port, waits for the health endpoint, and falls back to the next backend if the selected runtime cannot start. No API key or separately installed Ollama service is needed.

## Recommended catalog model

| Model | Source revision | Size | License | Tool support |
| --- | --- | ---: | --- | --- |
| Qwen3 1.7B Q4_K_M | [`Qwen/Qwen3-1.7B-GGUF` at `7fb011e9aee6e4dc7adf8430df9ea8de6a466aa3`](https://huggingface.co/Qwen/Qwen3-1.7B-GGUF/tree/7fb011e9aee6e4dc7adf8430df9ea8de6a466aa3) | 1.11 GB | Apache-2.0 | Catalog template supports tool calls |

The catalog file is [`Qwen3-1.7B-Q4_K_M.gguf`](https://huggingface.co/Qwen/Qwen3-1.7B-GGUF/blob/7fb011e9aee6e4dc7adf8430df9ea8de6a466aa3/Qwen3-1.7B-Q4_K_M.gguf). Its SHA-256 is `228fb5627f7510b8b3516cdb6435e4b0d2a2bf330fe5b0ab19284a3570a8bb1f`. The catalog pins both revision and hash so a changed remote file cannot be silently substituted. Qwen's model card identifies the license as Apache-2.0; the model page and license remain the authoritative source for model terms.

The Q4_K_M weights take about 1.11 GB on disk. Allow at least 4 GB of available system memory; 6 GB or more is recommended. GPU memory use varies with backend and context size. Model downloads use HTTP range requests where available, retain `.part` files when paused, and are checked for GGUF structure and SHA-256 before being made available.

## Imported GGUF files

Imported models are copied into the selected data directory, fingerprinted with SHA-256, and inspected for GGUF metadata and a chat template. Metadata alone cannot establish that a model can make reliable tool calls. TheBerry therefore labels imported tool support `unverified` when a chat template exists and `unsupported` when it does not. In both cases plain chat remains enabled, and local tool invocation is omitted from requests. The curated catalog marks its known tool-capable template as `verified`; that label describes catalog support, not a guarantee that every response will call a tool correctly.

The initial allowlisted local tool is `get_current_time`. Its implementation runs inside TheBerry; the model can request it but cannot execute a shell command or access arbitrary files through this interface.
