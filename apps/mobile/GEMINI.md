# Money Shepherd Mobile

Money Shepherd Mobile is a personal and household finance management application built with Expo and React Native. It features a layered architecture designed for local-first reliability with cloud synchronization via Firebase.

## Project Overview

- **Core Purpose:** To provide a robust, intuitive interface for managing household budgets, tracking transactions, and allocating funds to envelopes.
- **Key Technologies:**
  - **Framework:** [Expo](https://expo.dev) / React Native
  - **State Management:** [Zustand](https://github.com/pmndrs/zustand)
  - **Database & Auth:** [Firebase](https://firebase.google.com/) (Firestore & Anonymous Auth)
  - **Routing:** [Expo Router](https://docs.expo.dev/router/introduction) (File-based)
  - **Business Logic:** Shared logic from `@money-shepherd/domain` (local package dependency).
- **Architecture:**
  - **UI Layer (`app/`, `components/`):** React components and file-based routes.
  - **State Layer (`src/store/`):** Zustand store providing snapshots of the app state to the UI.
  - **Domain Engine (`src/domain/`):** Coordinates business logic, persistence, and synchronization.
  - **Infrastructure Layer (`src/infra/`):** Handles external services like Firebase and local storage.

## Building and Running

### Prerequisites
- Node.js (v18+)
- npm or yarn
- Expo Go (for mobile preview) or simulators (Xcode/Android Studio)

### Key Commands
- `npm install`: Install dependencies.
- `npx expo start`: Start the development server.
- `npm run android`: Run on Android emulator.
- `npm run ios`: Run on iOS simulator.
- `npm run web`: Run in web browser.
- `npm run lint`: Run ESLint.
- `npm run reset-project`: Resets the project to a blank state (moves current app to `app-example`).

## Development Conventions

### Domain Logic
- **Engine-First:** All mutations and complex state queries should go through the `Engine` (`src/domain/engine.ts`). The engine ensures that every change is recomputed, persisted locally, and pushed to the remote repository if configured.
- **Domain Decoupling:** Business rules (like transaction application or budget calculations) are imported from `@money-shepherd/domain`. Avoid implementing raw business logic directly in the mobile app.

### State Management
- Use `useAppStore` for UI-related state.
- The store acts as a bridge: it calls `Engine` methods and updates its internal state with the results.
- **Persistence:** The `Engine` handles persistence automatically. The store does not need to worry about `AsyncStorage`.

### Infrastructure
- **Firebase:** Configuration is managed via environment variables (see `.env`).
- **Sync Strategy:** The app uses a "last-write-wins" or "pull-on-conflict" strategy for simple household synchronization.

## Directory Structure Highlights
- `app/`: Expo Router pages (Routes).
- `assets/`: Images, fonts, and icons.
- `components/`: Reusable UI components.
- `constants/`: Theme, colors, and global constants.
- `hooks/`: Custom React hooks (e.g., color scheme).
- `src/domain/`: Engine, app state definitions, and command wrappers.
- `src/infra/`: Firebase client, remote repositories, and local sync metadata.
- `src/store/`: Zustand store definitions.
- `src/lib/`: Low-level utilities (ID generation, logging).
