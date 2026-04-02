# AI Rules & Tech Stack

This document outlines the architectural guidelines and technology stack for this application.

## Tech Stack

- **Framework**: React with TypeScript for type-safe frontend development.
- **Routing**: React Router (v6+) for client-side navigation.
- **Styling**: Tailwind CSS for utility-first, responsive design.
- **UI Components**: shadcn/ui (built on Radix UI) for accessible and customizable components.
- **Icons**: Lucide React for a consistent and scalable icon set.
- **State Management**: React Hooks (useState, useReducer, useContext) for local and global state.
- **Architecture**: Component-based architecture with a clear separation between pages and shared components.

## Development Rules

### 1. Library Usage
- **UI Elements**: Always prefer shadcn/ui components. Do not reinvent components that already exist in the library (e.g., Buttons, Dialogs, Inputs).
- **Styling**: Use Tailwind CSS classes for all styling. Avoid CSS-in-JS or raw CSS files unless absolutely necessary.
- **Icons**: Use `lucide-react` for all iconography to maintain visual consistency.

### 2. Project Structure
- **Pages**: All route-level components must reside in `src/pages/`.
- **Components**: Shared, reusable components must reside in `src/components/`.
- **Routing**: All application routes must be defined and managed within `src/App.tsx`.
- **Entry Point**: `src/pages/Index.tsx` is the default landing page. Ensure it is updated when new features or sections are added.

### 3. Coding Standards
- **TypeScript**: Use strict TypeScript. Avoid using `any`; define proper interfaces and types for props and state.
- **File Naming**: Use PascalCase for component files (e.g., `UserDashboard.tsx`) and camelCase for utility files.
- **Components**: Prefer functional components with hooks. Keep components small and focused on a single responsibility.
- **Simplicity**: Prioritize simple, readable code over complex abstractions.
