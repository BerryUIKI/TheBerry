# ADR-0002: Persistence Layer: redb Embedded Database & TOML Configuration

## Status
Accepted

## Context
A personal utility suite requires durable, ACID-compliant local storage for clipboard history, code snippets, launcher configurations, and user preferences. Standard desktop frameworks often default to storing user data in hidden OS application data directories (e.g. `AppData/Roaming`), making backups and user data ownership difficult.

## Decision
1. **Embedded Database**: We adopt **`redb`** (a 100% pure Rust, zero-C-dependency, ACID key-value store). Tables are partitioned for each domain: `clipboard_history`, `snippets`, `launcher_items`, and `kv_store`. SQLite is deferred to future multi-table relational iterations.
2. **Configuration File**: We store application settings in human-readable and editable **`config.toml`**.
3. **Custom Root Directory Policy**: TheBerry strictly avoids using the default Tauri app-data directory. On first launch, a bootstrap pointer (`~/.theberry/bootstrap.toml`) is written pointing to a user-customizable root directory, defaulting to `<Documents>/BerryAppData`.

## Consequences
- **Positive**:
  - Full user data ownership and portability; easy to back up, migrate, or sync.
  - Zero external C-library dependency overhead or SQLite compilation bloat in MVP.
  - Guaranteed ACID safety for local transactions.
- **Negative**:
  - Complex relational SQL joins must be handled in Rust application logic if needed.
