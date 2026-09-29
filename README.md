<div align="center">
  <img src="resources/logo.png" alt="Chorus Deck Logo" width="160" />
  
  # Chorus Deck

  <p>
    <strong>A next-generation, high-performance desktop music player.</strong><br>
    <em>Re-architected from the ground up for zero stutter, minimal memory footprint, and true native performance.</em>
  </p>

  <p>
    <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-blue?style=flat-square" alt="Supported Platforms" />
    <img src="https://img.shields.io/badge/Architecture-Tauri%20v2%20%2B%20Rust-orange?style=flat-square" alt="Architecture" />
    <img src="https://img.shields.io/badge/Frontend-Vue%203%20%2B%20TypeScript-41B883?style=flat-square" alt="Frontend" />
    <img src="https://img.shields.io/badge/Status-Active%20Development-success?style=flat-square" alt="Status" />
  </p>
</div>

<hr />

## 📖 Overview

**Chorus Deck** began as an Electron application but has been completely rebuilt as a native desktop client. By offloading all audio decoding, playback, and database operations to a highly optimized **Rust backend**, the UI is left to do what it does best—render a beautiful, stutter-free interface. 

The result is a music player that feels incredibly snappy, integrates seamlessly with your operating system, and uses a fraction of the RAM compared to traditional web-based desktop apps.

## 🛠️ Technologies & Architecture

Chorus Deck leverages a cutting-edge stack to achieve its performance targets:

- 🦀 **Rust & [Tauri v2](https://v2.tauri.app/):** The core engine. Handles OS-level IPC, robust concurrent chunk downloading, and powers the native audio sink (`rodio`).
- ⚡ **[Vue 3](https://vuejs.org/) & [TypeScript](https://www.typescriptlang.org/):** A strictly typed, reactive frontend.
- 🗄️ **[SQLite](https://www.sqlite.org/):** Highly tuned with WAL mode and memory-mapped I/O to comfortably handle massive local libraries and cache registries.
- 🎛️ **Native DSP:** Equalizer processing is done via native biquad filters in Rust, entirely bypassing the browser's heavy Web Audio API.
- 🍍 **[Pinia](https://pinia.vuejs.org/):** Modular state management for the player, queue, and library.

## ✨ Core Features

| Feature | Description |
| :--- | :--- |
| 🎵 **Unlimited Streaming** | Deep integration with YouTube Music for an endless discovery and listening experience. |
| 🎛️ **Native Equalizer** | A built-in 10-band EQ powered by Rust DSP, giving you hardware-level audio manipulation. |
| 💾 **Offline Caching** | Resilient chunk-based downloading allows you to take your music anywhere, saving network bandwidth on replays. |
| 🎤 **Immersive Lyrics** | fluid, word-by-word synchronized lyrics with a custom feather-edged UI and a background mini-mode. |
| 🚀 **System Integration** | Full support for OS media controls (SMTC/MPRIS), hardware media keys, and an interactive system tray. |
| 🎮 **Discord RPC** | Show off what you're listening to in real-time with Discord Rich Presence integration. |
| 🎨 **Premium Aesthetics** | A meticulously crafted Vue 3 interface featuring seamless Light/Dark mode transitions and dynamic themes. |
| 📦 **Library Import** | Import your playlists and likes from Spotify to seamlessly migrate your library. *(More platforms coming soon)* |

## 🚀 Getting Started

### 1. Prerequisites

You will need the following tools installed on your development machine:
- **[Node.js](https://nodejs.org/)** (v18 or higher)
- **[Rust](https://rustup.rs/)** (latest stable release)
- **OS-specific build tools** (e.g., MSVC on Windows, WebKit dependencies on Linux). Please refer to the [Tauri v2 Prerequisites Guide](https://v2.tauri.app/start/prerequisites/).

### 2. Installation

Clone the repository and install the Node dependencies:

```bash
git clone https://github.com/Chorus-Deck/Chorus-Deck.git
cd Chorus-Deck
npm install
```

### 3. Local Development

Start the Vite development server and the Tauri Rust backend simultaneously:

```bash
npm run tauri dev
```

### 4. Building for Production

Compile a highly optimized, standalone executable for your operating system:

```bash
npm run tauri build
```
*Your compiled binaries will be placed in `src-tauri/target/release/bundle/`.*

## 📂 Project Structure

- **`src/`**: The Vue 3 frontend application. Contains all UI components, views, and Pinia stores.
- **`src-tauri/`**: The Rust backend. Contains the `rodio` audio pipeline, SQLite database schemas, and Tauri command definitions.
- **`src/renderer/api/bridge.ts`**: The strictly typed IPC (Inter-Process Communication) layer. This is the only way the frontend communicates with the native Rust backend.

## 📄 License

This project is open-source and intended for educational and learning purposes.
