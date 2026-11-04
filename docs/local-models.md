# Managed local models

The built-in local provider runs the OpenAI-compatible `llama-server` from llama.cpp as a child process owned by TheBerry. Managed inference supports Windows x64, macOS Apple Silicon (arm64), and Linux x64. The server binds only to `127.0.0.1`. Model weights remain under `local-models/` in the selected data directory and are never included in the installer.

## On-demand runtime

No installer includes llama.cpp binaries. Starting a local model from settings or sending its first message prepares the runtime automatically. Opening the application or settings, importing a model, and downloading model weights do not download runtimes.

On Windows, TheBerry detects devices through the installed CUDA and Vulkan drivers. It prefers CUDA 12.4 on compatible NVIDIA devices, then a physical Vulkan GPU, then CPU. On Linux it offers a physical Vulkan GPU or CPU; on Apple Silicon it uses Metal with a CPU fallback. Driver probes do not require a CUDA Toolkit, `nvidia-smi`, or Vulkan diagnostic tools. Detection selects a candidate; successful startup determines whether the backend can actually run the selected model.

Downloads come directly from the fixed [llama.cpp b11425 release](https://github.com/ggml-org/llama.cpp/releases/tag/b11425). Archive names, byte sizes, and SHA-256 hashes are embedded in the application; runtime downloads never follow a mutable latest-release URL.

| Platform | Backend | Official download size |
| --- | --- | ---: |
| Windows x64 | CPU | 19.4 MB |
| Windows x64 | Vulkan | 33.3 MB |
| Windows x64 | CUDA 12.4, including dependencies | 655.9 MB |
| macOS arm64 | Metal or CPU (shared archive) | 12.0 MB |
| Linux x64 | CPU | 17.7 MB |
| Linux x64 | Vulkan | 31.6 MB |

These are upstream archive sizes. Local trimming reduces disk usage, not download traffic. Installation retains `llama-server` (`llama-server.exe` on Windows), the bundled shared libraries (including architecture-specific CPU implementations), relative library symlinks on macOS and Linux, executable permissions, and license/notice files. Other executables, debugging files, development files, and examples are excluded. The pinned upstream [MIT license](https://github.com/ggml-org/llama.cpp/blob/b11425/LICENSE) is installed alongside the retained notices.

Windows uses the upstream ZIP archives; macOS and Linux use `.tar.gz` archives. Extraction flattens the upstream top-level directory, preserves same-directory library symlinks and executable permissions, and rejects unsafe paths, hardlinks, and symlinks that escape the staging directory. The Linux Vulkan backend requires a Vulkan 1.2 loader and driver; systems that lack one fall back to CPU. Linux builds come from the upstream Ubuntu x64 release, so distributions with an older glibc than the upstream build may not be able to launch the runtime.

Runtimes are cached at `<data_dir>/local-runtimes/llama/b11425/<platform>/<backend>`, where `<platform>` is `windows-x64`, `macos-arm64`, or `linux-x64`. On macOS the Metal and CPU backends share the `metal` directory because they come from the same archive. Downloads support cancellation and HTTP range resumption. When a server ignores a range request, the download restarts. SHA-256 checks precede safe extraction into a staging directory; the server must report the pinned version before the installation is committed. Completed archives and temporary files are removed. Incomplete installations cannot be launched.

Settings and the chat sidebar display preparation progress and cancellation controls. Chat preparation does not consume the normal 60-second generation timeout; stalled network requests have their own timeouts. Concurrent requests share preparation. Cancelling a chat stops that caller from waiting or sending its prompt; cancelling runtime preparation stops the shared operation.

If preparation or GPU startup fails, TheBerry displays the error and lets the user retry or explicitly select CPU or another detected backend. It never downloads another backend automatically. Backend buttons show the full download size or that the runtime is already installed. A successful explicit selection is remembered while the detected hardware and drivers remain unchanged. Existing backend caches are retained and work offline.

The launcher owns startup and shutdown, selects a free loopback port, and waits for the health endpoint. No API key or separately installed Ollama service is needed. Runtime changes do not move or delete existing models. No installer bundles llama.cpp binaries on any platform; macOS and Linux installers also exclude Windows QuickLook resources.

## Recommended catalog model

| Model | Source revision | Size | License | Tool support |
| --- | --- | ---: | --- | --- |
| Qwen3 1.7B Q4_K_M | [`Qwen/Qwen3-1.7B-GGUF` at `7fb011e9aee6e4dc7adf8430df9ea8de6a466aa3`](https://huggingface.co/Qwen/Qwen3-1.7B-GGUF/tree/7fb011e9aee6e4dc7adf8430df9ea8de6a466aa3) | 1.11 GB | Apache-2.0 | Catalog template supports tool calls |

The catalog file is [`Qwen3-1.7B-Q4_K_M.gguf`](https://huggingface.co/Qwen/Qwen3-1.7B-GGUF/blob/7fb011e9aee6e4dc7adf8430df9ea8de6a466aa3/Qwen3-1.7B-Q4_K_M.gguf). Its SHA-256 is `228fb5627f7510b8b3516cdb6435e4b0d2a2bf330fe5b0ab19284a3570a8bb1f`. The catalog pins both revision and hash so a changed remote file cannot be silently substituted. Qwen's model card identifies the license as Apache-2.0; the model page and license remain the authoritative source for model terms.

The Q4_K_M weights take about 1.11 GB on disk. Allow at least 4 GB of available system memory; 6 GB or more is recommended. GPU memory use varies with backend and context size. Model downloads use HTTP range requests where available, retain `.part` files when paused, and are checked for GGUF structure and SHA-256 before being made available.

## Imported GGUF files

Imported models are copied into the selected data directory, fingerprinted with SHA-256, and inspected for GGUF metadata and a chat template. Metadata alone cannot establish that a model can make reliable tool calls. TheBerry therefore labels imported tool support `unverified` when a chat template exists and `unsupported` when it does not. In both cases plain chat remains enabled, and local tool invocation is omitted from requests. The curated catalog marks its known tool-capable template as `verified`; that label describes catalog support, not a guarantee that every response will call a tool correctly.

The initial allowlisted local tool is `get_current_time`. Its implementation runs inside TheBerry; the model can request it but cannot execute a shell command or access arbitrary files through this interface.
