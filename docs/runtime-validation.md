# Runtime packaging validation

## Windows installer size

Sizes use decimal MB. Published baselines come from the [0.1.14 release](https://github.com/BerryUIKI/TheBerry/releases/tag/v0.1.14), [0.1.15 release](https://github.com/BerryUIKI/TheBerry/releases/tag/v0.1.15), [0.1.16 release](https://github.com/BerryUIKI/TheBerry/releases/tag/v0.1.16), [0.1.17 release](https://github.com/BerryUIKI/TheBerry/releases/tag/v0.1.17), [0.1.18 release](https://github.com/BerryUIKI/TheBerry/releases/tag/v0.1.18), and [0.1.19 release](https://github.com/BerryUIKI/TheBerry/releases/tag/v0.1.19).

| Installer | 0.1.14 | 0.1.15 | 0.1.16 | 0.1.17 | 0.1.18 | 0.1.19 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Windows EXE | 80.68 MB | 438.48 MB | 80.88 MB | 80.92 MB | 80.89 MB | 80.92 MB |
| Windows MSI | 110.02 MB | 789.51 MB | 110.31 MB | 110.33 MB | 110.31 MB | 110.36 MB |

The 0.1.17 pre-release local build (80.99 MB EXE, 110.51 MB MSI) matched the published artifacts. The 0.1.17 release published the Linux and macOS installers: 90.44 MB AppImage, 10.97 MB deb, and 11.58 MB macOS arm64 dmg. 0.1.18 published a 90.50 MB AppImage, 11.00 MB deb, and 11.59 MB dmg; 0.1.19 published 90.45 MB, 10.97 MB, and 11.63 MB. Windows installers stayed within 0.03 MB of the 0.1.17 baseline across both patches.

The MSI database contains 1,324 payload files, including `QuickLook.exe`, and no llama.cpp, ggml, cuBLAS, or CUDA runtime files. The generated NSIS file list also excludes AI runtimes. Shared configuration has no resource bundle; the Windows override contains only QuickLook. An automated configuration test protects these platform boundaries.

## Automated verification

- `pnpm test`: 112 frontend tests passed, including explicit backend selection, cached/download size labels, progress restoration, cancellation, stale status protection, and preparation exceeding the generation watchdog timeout.
- `pnpm build`: production frontend build passed.
- `cargo test --manifest-path src-tauri/Cargo.toml -j 2`: 82 backend unit and integration tests passed, including the Windows installation file-lock regression and the new cross-platform archive tests. Two optional tests remain ignored by default: hardware-fixture inference and live OS autostart changes. Hardware inference was exercised separately for all three Windows backends.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`: passed.
- `pnpm tauri build`: Windows MSI and NSIS installers built successfully.

Runtime tests use a local HTTP server for partial transfers, rejected/ignored ranges, invalid ranges, oversized responses, stalled transfers, and cancellation. They also cover corrupt archive deletion, unsafe ZIP paths, duplicate extraction names, missing DLLs, invalid cache versions, shared preparation, detached callers, explicit cancellation, persistent errors, backend preferences, and user-selected recovery.

The runtime core emits progress through an optional callback rather than retaining a desktop application handle, allowing ordinary backend tests to launch without a special Windows activation manifest.

## Real hardware smoke tests

CPU, CUDA 12.4, and Vulkan installation and inference passed on Windows x64 with an NVIDIA T600. Each run verifies official archive hashes, retained dependencies, the pinned executable version, atomic installation, license inclusion, archive cleanup, offline cache reuse, health checks, generated text, and shutdown.

The smoke model is the 1,185,376-byte [Stories260K GGUF fixture](https://huggingface.co/ggml-org/models/blob/499bc8821c6b12b4e53c5bffcb21ec206f212d81/tinyllamas/stories260K.gguf), with SHA-256 `270cba1bd5109f42d03350f60406024560464db173c0e387d91f0426d3bd256d`. Model catalog contents remain unchanged.

To repeat the optional smoke test, put the official b11425 archives and `stories260K.gguf` under `src-tauri/target/runtime-verification/`. Name the CPU archive `cpu.zip` on Windows or `cpu.tar.gz` on macOS/Linux; retain upstream names for the GPU archives. Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml --lib official_runtime_installs_and_runs_inference -- --ignored --nocapture
```

Set `THEBERRY_TEST_RUNTIME_BACKEND` to `cuda`, `vulkan`, or `metal` to test those backends on compatible hardware. The default is `cpu`. These fixture-dependent tests are ignored during the normal offline test suite.

## Cross-platform runtime coverage

The managed runtime targets Windows x64, macOS arm64, and Linux x64. Unit tests cover the platform archive table, Metal/Vulkan backend ordering, required-file validation, and `.tar.gz` extraction (relative symlinks, executable bits, unsafe paths, hardlinks, and escaping symlinks) on all three CI hosts. Archive names, byte counts, and SHA-256 hashes are pinned from the official b11425 release asset digests.

Real-hardware inference has been exercised on Windows x64 for CPU, CUDA 12.4, and Vulkan. macOS arm64 (Metal/CPU) and Linux x64 (Vulkan/CPU) currently have CI compilation and unit-test coverage only; their native inference still needs a smoke test on machines running those platforms.

## Validation limits

TypeScript checking reports 132 existing diagnostics in both unchanged HEAD and the modified sources. Comparing diagnostic locations and codes found no new errors; expanded translation-key union lengths were normalized during comparison. The temporary baseline source copy was removed after checking.

macOS and Linux installers were not built on this Windows host. Platform resource configuration is covered by automated tests; native package verification remains available through the existing release matrix. The implementation was validated at version 0.1.15 before preparing the 0.1.16 release. Published 0.1.16 and 0.1.17 installer sizes were measured from the release artifacts after the release workflow completed. The cross-platform runtime was validated through CI compilation and unit tests on macOS and Linux; native inference on those platforms remains pending.
