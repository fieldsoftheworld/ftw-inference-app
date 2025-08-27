# FTW Inference App

A Vue 3 application for running inference on satellite imagery using the FTW API.

## Running the Application Locally

### Step 1: Clone the Repositories

```sh
# Clone both repositories
git clone https://github.com/fieldsoftheworld/ftw-inference-app.git
git clone https://github.com/fieldsoftheworld/ftw-inference-api.git
```

### Step 2: Set Up the API

```sh
# Navigate to API directory
cd ftw-inference-api

# Create and activate conda environment (recommended)
conda env create -f server/env.yml
conda activate ftw-inference-api

# Install dependencies
pip install -r server/requirements.txt
pip install -r server/requirements-dev.txt  # For development

# Download precomputed models for examples api endpoint
cd server/data/models
# Store the .ckpt files from <https://github.com/fieldsoftheworld/ftw-baselines/releases/tag/v1>
# in this directory

# Start the API server
cd ../..
python run.py --host 127.0.0.1 --port 8080 --debug
```

The API will be available at `http://127.0.0.1:8080`

### Step 3: Set Up the Frontend App

```sh
# Open a new terminal and navigate to the app directory
cd ../ftw-inference-app

# Install dependencies
npm install

# Create environment file
echo "VITE_API_BASE_URL=http://127.0.0.1:8080/v1/" > .env.development
echo "VITE_FTW_INFERENCE_OUTPUT_URL=https://source.coop/ftw/ftw-inference-output/" > .env.development

# Start the development server
npm run dev
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
