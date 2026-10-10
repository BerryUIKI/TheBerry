This directory is populated by `scripts/prepare-local-runtime.ps1` on Windows x64 builds.
The release packages pin the llama.cpp runtime to b11425 and include CPU, Vulkan, and CUDA 12.4 variants.
Model weights are downloaded or imported by the user and are not included in the application installer.
