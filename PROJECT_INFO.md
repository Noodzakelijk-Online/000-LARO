# LARO Desktop — Project Overview

LARO is a specialized desktop application designed for legal professionals to manage, scan, and process legal evidence using AI-driven tools. It combines the accessibility of a desktop app with the heavy-lifting capabilities of a containerized backend.

## 🚀 Key Features

- **Automated Evidence Scanning**: Scan local folders for legal documents (PDFs, images, etc.) with automated metadata extraction.
- **AI-Powered Analysis**: Integrated Large Language Model support (OpenAI, Anthropic) for case aggregation and evidence analysis.
- **Docker-Integrated Desktop**: A seamless "unzip and run" experience where the Electron app automatically manages the Docker backend services (MySQL, Redis, API).
- **Multi-Platform Integration**: Native OAuth support for Google (OAuth2/Drive), Microsoft (Graph API/Outlook), and Slack.
- **Secure Architecture**: Local processing where possible, with encrypted uploads to cloud storage (AWS S3).

## 🏗️ Architecture Overview

LARO follows a hybrid architecture to ensure performance, data isolation, and ease of deployment:

1.  **Frontend (UI)**: Built with **React 18**, **Vite**, and **Tailwind CSS**. It provides a clean, modern interface for legal case management.
2.  **Desktop Layer (Electron)**: A TypeScript-based **Electron** wrapper that handles local file system access, window management, and **automatic Docker life-cycle management**.
3.  **Backend Services (Docker)**:
    -   **API Server**: An Express.js + tRPC server that handles the business logic and AI orchestration.
    -   **Database**: MySQL 8.0 for persistent case data and evidence records.
    -   **Cache**: Redis for background task handling and session management.

## 🛠️ Technology Stack

- **Core**: TypeScript, Node.js 20.
- **Frontend**: React, Lucide Icons, Shadcn UI (Radix), TanStack Query.
- **Backend API**: Express, tRPC, Drizzle ORM.
- **Desktop**: Electron, Electron-Builder.
- **Persistence**: MySQL, Redis, Better-SQLite3 (local caching).
- **Processing**: esbuild (server build), Vite (renderer build), Docker Compose (stack orchestration).

## 📁 Project Structure

```text
/
├── electron/         # Electron main process and desktop services
├── src/              # Frontend React application (Renderer process)
├── server/           # Backend API source code (Dockerized)
├── shared/           # Shared types and utilities between Main and Renderer
├── docker/           # Docker initialization scripts and SQL patches
├── scripts/          # Build hooks, packaging scripts, and utils
└── docker-compose.yml # Definition of the backend service stack
```

## ⚙️ Development & Build

### Prerequisites
- **Node.js** (v20+)
- **Docker Desktop** (Required to run the backend)

### Local Development
```bash
npm install        # Install project dependencies
npm run dev        # Starts Vite (UI) and Electron concurrently
```

### Packaging for Release
The project uses `electron-builder` to bundle the entire Docker context into the app resources.
```bash
npm run build      # Build both renderer and main processes
npm run dist:win   # Package for Windows (.exe / setup)
```

## 🔒 Security & Connectivity
- **OAuth 2.0**: Integrated flow for Google, Microsoft, and Slack.
- **JWT**: Secure authentication for the tRPC API.
- **Local Persistence**: Key device-specific metadata is stored in a local SQLite database, while larger case data lives in the Docker MySQL instance.

---
*Generated: 2026-03-29 — LARO Team*
