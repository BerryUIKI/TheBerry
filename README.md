# TheBerry

**TheBerry** is a high-performance personal desktop utility suite built with **Rust (Tauri v2)** on the backend and **SolidJS + TypeScript + Tailwind CSS** on the frontend.

Designed specifically for developers, designers, photographers, and video operators, TheBerry provides a unified, lightweight, and modern utility hub.

---

## Key Features (MVP Suite)

1. 📋 **Clipboard History Manager**: Search, preview, pin, and manage copied text snippets and assets.
2. 💻 **Developer Code Snippet Library**: Organize reusable code blocks, boilerplate, and commands by language and tag.
3. 🚀 **Application Launcher & Batch Organizer**: Quick launch programs, manage favorites, and trigger custom multi-command batch workflows (e.g. WeChat multi-instance, toolchains).
4. 🖼️ **Batch Image Format Converter**: Fast batch conversion and compression between PNG, JPEG, and WebP.
5. 🔍 **Everything Fast Local File Search**: High-speed Rust file traversal and search engine with category filters and direct path operations.

---

## Tech Stack & Architecture

- **Backend**: [Rust](https://www.rust-lang.org/) + [Tauri v2](https://v2.tauri.app/)
- **Frontend**: [SolidJS](https://www.solidjs.com/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vite.dev/) + [Tailwind CSS](https://tailwindcss.com/) + [Lucide Icons](https://lucide.dev/)
- **Persistence**: [redb](https://github.com/cberner/redb) (pure Rust embedded ACID database) + `config.toml`
- **Data Policy**: Zero dependency on hidden default app-data folders; user-defined custom root directory (defaults to `<Documents>/BerryAppData`).
- **GUI Styling**: Custom frameless title bar, dark/light theme toggle, and system tray background integration.

---

## Project Structure

```text
TheBerry/
├── docs/                     # Architecture and IPC Interface Specifications
│   ├── architecture.md
│   └── interfaces.md
├── src/                      # SolidJS Frontend Codebase
│   ├── components/           # TitleBar, Sidebar, Modals, UI
│   ├── context/              # App & Theme context
│   ├── services/             # Tauri IPC wrappers
│   ├── types/                # TypeScript Interfaces
│   └── views/                # 5 MVP Modules + Settings View
└── src-tauri/                # Rust Backend (Tauri v2)
    ├── capabilities/         # Tauri security permissions
    └── src/
        ├── core/             # DB (redb), Config (TOML), Path resolver
        ├── modules/          # Clipboard, Snippets, Launcher, Image, Search
        ├── commands/         # Tauri invoke command endpoints
        └── tray.rs           # System tray background service
```

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- [pnpm](https://pnpm.io/)
- [Rust & Cargo](https://www.rust-lang.org/tools/install) (1.78+)

### Development

1. **Install frontend dependencies**:
   ```bash
   pnpm install
   ```

2. **Run in development mode** (launches Vite + Tauri dev window):
   ```bash
   pnpm tauri dev
   ```

3. **Build release package**:
   ```bash
   pnpm tauri build
   ```

---

## Git Workflow
- `main`: Production-ready release branch.
- `dev`: Active development and feature integration branch.
- Feature branches merge into `dev`, which merges to `main` for official releases.

---

## Documentation
- [Architecture Design](docs/architecture.md)
- [Module IPC Interfaces](docs/interfaces.md)
