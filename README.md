# Kaizen

> A philosophy of continuous improvement — making small, meaningful changes every day to enhance learning, performance, and mastery.

## Overview

Kaizen is a web application built with SvelteKit 5 and Supabase that provides assessment and analytics capabilities for continuous improvement tracking. The application features a modern, gradient-themed UI with authentication and dynamic assessment flows.

## Tech Stack

- **Framework**: SvelteKit 2.43.2 (Svelte 5.39.5)
- **Language**: TypeScript 5.9.2
- **Backend/Database**: Supabase (via @supabase/supabase-js)
- **Deployment**: Vercel (via @sveltejs/adapter-vercel)
- **Build Tool**: Vite 7.1.7
- **Package Manager**: npm

## Project Structure

## Routes

### Public Routes

- **/** - Landing page with fullscreen hero section and CTA to get started
- **/login** - Authentication page (login/signup)

### Protected Routes

- **/dashboard** - Main dashboard view after login
- **/assessment/[id]** - Individual assessment page (dynamic, requires assessment ID)
- **/prompt/[id]** - Prompt interface (dynamic, requires prompt ID)
- **/results/[id]** - Results display page (dynamic, requires result ID)
- **/analytics/aptitude** - Aptitude analytics view

### Route Parameters

Dynamic routes use SvelteKit's [id] convention:
- The id parameter is accessible via $page.params.id in page components
- Used for assessment flows, prompts, and results viewing

## Getting Started

### Prerequisites

- Node.js (compatible with npm)
- Supabase account and project
- Environment variables configured

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd kaizen

# Install dependencies
npm install
```
### Environment Setup
Create a .env file in the root directory with the following variables:

### Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

## Development
### Start development server
```bash
npm run dev
```

The app will be available at http://localhost:5173

## Building for Production
### Build the application
```bash
npm run build
```

### Preview production build
```bash
npm run preview
```

## Deployment
The project is configured for Vercel deployment via @sveltejs/adapter-vercel.
```bash
# Deploy to Vercel
vercel

# Or push to your connected repository
git push
```

## Key Features
### 1. Landing Page
- Fullscreen hero with gradient overlay
- Responsive design with mobile optimizations
- SSR disabled for landing page (export const ssr = false)

### 2. Authentication
- Supabase-powered authentication
- Login/signup flow via /login

### 3. Assessment System
- Dynamic assessment pages with unique IDs
- Assessment flow management
- Results tracking and display

### 4. Analytics
- Aptitude analytics dashboard
- Data visualization for continuous improvement tracking

### 5. Dashboard
- Central hub after authentication
- Access to assessments and analytics

## Development Notes
### Styling
- The project uses a custom CSS approach (no Bulma or heavy CSS frameworks on landing page)
- Gradient theme: Purple to Blue (#a855f7, #6366f1, #3b82f6)
- Inter font family for consistent typography
- Mobile-first responsive design

### State Management
- Svelte stores are located in src/lib/stores/
- Check individual store files for available state management utilities

### Supabase Client
The Supabase client is configured in src/lib/supabaseClient.ts. Import and use it for:
- Authentication operations
- Database queries
- Real-time subscriptions
- File storage operations

Example usage:
```typescript
import { supabase } from '$lib/supabaseClient';

// Query example
const { data, error } = await supabase.from('table_name').select('*');
```

## Code Quality
- TypeScript: Strict type checking enabled
- Prettier: Code formatting configured (.prettierrc)
- ESLint: Linting rules in eslint.config.js
- Svelte Check: Run npm run check for type checking

## Scripts
- Check package.json for available scripts. Common ones include:
  - `npm run dev` - Start development server
  - `npm run build` - Build for production
  - `npm run preview` - Preview production build
  - `npm run check` - Type checking with svelte-check
  - `npm run format` - Format code with Prettier
