# FTW Inference App

A Vue 3 application for running inference on satellite imagery using the FTW API.

## Prerequisites

- Node.js (v16 or higher)
- npm (v7 or higher)

## Environment Setup

1. Create a `.env.development` file in the project root with the following variables or copy one of the existing example files:

```env
VITE_API_BASE_URL=https://4k6wlmocxk.execute-api.us-west-2.amazonaws.com/v1/
```

Replace the URL with your actual API endpoint if different.

## Project Setup

```sh
# Install dependencies
npm install
```

### Development

```sh
# Start the development server
npm run dev:local
```

The app will be available at `http://localhost:5173` by default.

### Production Build

```sh
# Build for production
npm run build
```

### Type Checking

```sh
# Run type checking
npm run type-check
```

### Linting

```sh
# Run ESLint
npm run lint
```
