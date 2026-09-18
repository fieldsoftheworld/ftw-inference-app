# FTW Explorer - The Inference App

A Vue 3 application for running inference on satellite imagery using the FTW API.

## Running the Application Locally

### Step 1: Clone the Repositories

```sh
# Clone both repositories
git clone https://github.com/fieldsoftheworld/ftw-inference-app.git
git clone https://github.com/fieldsoftheworld/ftw-inference-api.git
```

### Step 2: Set Up the API

The API is always being updated, so it is best to follow the directions directly in the [API repository](https://github.com/fieldsoftheworld/ftw-inference-api).

Prerequisites:

- [Docker](https://docs.docker.com/get-docker/) (required for local DynamoDB)
- [Pixi](https://pixi.sh/latest/#installation) (package manager)

```sh
# Navigate to API directory
cd ftw-inference-api

# Copy environment configuration
cp .env.example .env

# Configure local DynamoDB in .env file (uncomment these lines):
# DYNAMODB__DYNAMODB_ENDPOINT="http://localhost:8001"
# AWS_ACCESS_KEY_ID="fake_key_id"
# AWS_SECRET_ACCESS_KEY="fake_secret_key"

# Download precomputed models for api endpoint
# Store the .ckpt files from <https://github.com/fieldsoftheworld/ftw-baselines/releases/tag/v1>
# in this directory

# Start local DynamoDB
pixi run dynamodb-local

# In a new terminal, start the API server
pixi run start
```

The API will be available at `http://localhost:8000`

### Step 3: Set Up the Frontend App

```sh
# Open a new terminal and navigate to the app directory
cd ../ftw-inference-app

# Install dependencies
npm install

# Create environment file
echo "VITE_API_BASE_URL=http://127.0.0.1:8080/v1/" > .env.development

# Start the development server
npm run dev
```

Optionally, to get access to model results from a local ftw-inference-api instance, run

    npx serve --cors ../ftw-inference-api/server/data/results/

and add the VITE_FTW_INFERENCE_OUTPUT_URL environment variable pointing to that dev server:

```sh
echo "VITE_FTW_INFERENCE_OUTPUT_URL=http://127.0.0.1:3000/" > .env.development
```

The app will be available at `http://localhost:5173`

## Alternative API Setup

If you prefer not to use conda, you can install the API manually:

Prerequisites:

- Python 3.11 or 3.12
- GDAL 3.11 or later with `libgdal-arrow-parquet`

Then follow the same steps as above, skipping the conda environment creation.

## Additional Commands

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

## Prerequisites

- Node.js (v16 or higher)
- npm (v7 or higher)
