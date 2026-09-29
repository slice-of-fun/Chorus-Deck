# 🎵 Chorus Deck

Welcome to **Chorus Deck**, a lightweight, high-performance next-generation desktop music player. Originally built with Electron, Chorus Deck has been completely rewritten in **Rust** and **Tauri v2** to deliver native performance with minimal memory usage.

## ✨ Features

- 🎵 **Music Discovery & Streaming**: Deep integration with YouTube Music for an endless library of tracks.
- 🚀 **Native Desktop Integration**: Full support for system media controls (SMTC/MPRIS), media keys, and an interactive system tray.
- 🎼 **Immersive Lyrics**: Beautiful synchronized desktop lyrics and mini-mode support.
- 💾 **Offline Downloads**: Fast, concurrent audio downloading directly from the player.
- 📝 **Comprehensive Management**: Seamlessly manage your history, favorites, custom playlists, and daily recommendations.
- 🎨 **Beautiful UI**: A modern, sleek Vue 3 interface with full Light/Dark mode support.
- 🎧 **High-Quality Audio**: Built-in EQ customization and robust playback engine.
- ⚡ **Ultra-Fast Engine**: Powered by Tauri v2 and Rust, meaning faster startup times, a smaller app size, and drastically lower RAM usage than traditional Electron apps.

## 🏗️ Architecture

Chorus Deck leverages a modern, robust stack:
- **Core Engine:** Rust & Tauri v2
- **Frontend:** Vue 3 & TypeScript
- **Storage:** SQLite (via tauri-plugin-sql)
- **State Management:** Pinia
- **Media Controls:** `souvlaki` (Cross-platform OS media integration)

## 🚀 Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) and [Rust](https://rustup.rs/) installed on your system.

### Installation

Clone the repository and install the frontend dependencies:

```bash
npm install
```

### Running Locally

To start the development server with the Tauri Rust backend:

```bash
npm run tauri dev
```

### Building for Production

To build an optimized, standalone executable for your operating system:

```bash
npm run tauri build
```

## 🛠️ Development

- The frontend source code is located in the `src/renderer/` directory.
- The Rust backend is located in the `src-tauri/` directory.
- For inter-process communication (IPC), we use a strictly typed API Bridge defined in `src/renderer/api/bridge.ts` instead of legacy ContextBridge exposed globals.

## 📄 License

This project is for educational and learning purposes.
