# 🎵 Chorus Deck

Welcome to **Chorus Deck**, a lightweight, high-performance next-generation desktop music player. Originally built with Electron, Chorus Deck has been completely re-architected in **Rust** and **Tauri v2** to deliver native performance, blazing-fast startup times, and minimal memory footprint.

## ✨ Features

- 🎵 **Music Discovery & Streaming**: Deep integration with YouTube Music for an endless library of tracks.
- 🚀 **Native Desktop Integration**: Full support for system media controls (SMTC/MPRIS), hardware media keys, and an interactive system tray.
- 🎮 **Discord Rich Presence**: Share your currently playing tracks with your Discord friends in real-time.
- 🎼 **Immersive Lyrics**: Beautiful synchronized desktop lyrics and a convenient mini-mode for background listening.
- 💾 **Offline Downloads**: Fast, concurrent audio downloading directly from the player. Take your music anywhere.
- 📝 **Comprehensive Management**: Seamlessly manage your listening history, favorites, custom playlists, and discover daily recommendations.
- 🎨 **Beautiful UI**: A modern, sleek Vue 3 interface with seamless Light and Dark mode transitions.
- 🎧 **High-Quality Audio**: Built-in EQ customization and a robust playback engine.
- ⚡ **Ultra-Fast Engine**: Powered by Tauri v2 and Rust, meaning faster startup times, a smaller app size, and drastically lower RAM usage than traditional Electron apps.

## 🏗️ Architecture

Chorus Deck leverages a modern, robust tech stack designed for speed and reliability:
- **Core Engine:** [Rust](https://www.rust-lang.org/) & [Tauri v2](https://v2.tauri.app/)
- **Frontend:** [Vue 3](https://vuejs.org/) & [TypeScript](https://www.typescriptlang.org/)
- **Storage:** SQLite for robust, fast metadata caching and library management
- **State Management:** [Pinia](https://pinia.vuejs.org/)
- **Media Controls:** `souvlaki` for seamless cross-platform OS media integration

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your system:
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [Rust](https://rustup.rs/) (latest stable)
- Build tools required by Tauri for your specific OS (e.g., MSVC on Windows, WebKit dependencies on Linux). See the [Tauri prerequisites guide](https://v2.tauri.app/start/prerequisites/).

### Installation

Clone the repository and install the frontend dependencies:

```bash
git clone https://github.com/Chorus-Deck/Chorus-Deck.git
cd Chorus-Deck
npm install
```

### Running Locally

To start the development server with the Tauri Rust backend, run:

```bash
npm run tauri dev
```

### Building for Production

To build an optimized, standalone executable for your operating system:

```bash
npm run tauri build
```
The compiled binaries will be available in `src-tauri/target/release/bundle/`.

## 🛠️ Development Structure

- `src/` — Contains the entire Vue 3 frontend source code (components, views, and styles).
- `src-tauri/` — Houses the Rust backend, including Tauri commands, system integrations, and OS-specific logic.
- `src/renderer/api/bridge.ts` — The strictly typed IPC layer that serves as the communication bridge between the frontend UI and the Rust backend, ensuring secure and predictable message passing.

## 📄 License

This project is for educational and learning purposes.
