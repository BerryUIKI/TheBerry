# ADR-0007: Unified Database Portability and CI Pipeline

## Status
Accepted (2026-08-31)

## Context
As users rely on TheBerry for daily developer snippets, clipboard history, and customized application launcher shortcuts, having a reliable mechanism for complete data backup, cross-device sync, and automated cross-platform continuous integration became essential.

## Decision
1. **Unified JSON Backup Architecture**:
   - Implemented `BackupService` in Rust reading directly from all redb tables (`CLIPBOARD_TABLE`, `SNIPPETS_TABLE`, `LAUNCHER_TABLE`) and `ConfigManager`.
   - Formatted into an encrypted-ready, human-readable JSON schema with metadata timestamps and version tags.
   - Provided transactional merge-restore with item counting summary feedback.

2. **Automated Continuous Integration Matrix**:
   - Configured `.github/workflows/ci.yml` running across `windows-latest`, `ubuntu-22.04`, and `macos-latest`.
   - Automates Vitest runner, Vite production bundle compiler, and Rust integration test matrix.

## Consequences
- 100% offline data portability for users without cloud lock-in.
- High test confidence across all targeted desktop operating systems on every PR.
