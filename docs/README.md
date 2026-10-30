<div align="center">
  <img src="./logo.svg" width=50 height=50 />
</div>
<h1 align="center">
Dental X-Ray Analysis AI
</h1>
<p align="center">
<img src="https://img.shields.io/badge/-TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
<img src="https://img.shields.io/badge/-Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js">
<img src="https://img.shields.io/badge/-React-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React">
<img src="https://img.shields.io/badge/-Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python">
<img src="https://img.shields.io/badge/-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI">
<img src="https://img.shields.io/badge/-TailwindCSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="TailwindCSS">
</p>

_An AI-powered platform for detecting dental conditions in X-ray images using computer vision and DICOM processing_

[Features](#-features) • [Architecture](#-architecture) • [Setup](#-setup--installation) • [API Documentation](#api-documentation)

---

## [▶️ Demo Video](https://www.youtube.com/watch?v=diI3qsaASuo)

[![Watch the video](https://img.youtube.com/vi/diI3qsaASuo/0.jpg)](https://www.youtube.com/watch?v=diI3qsaASuo)

[YouTube Link](https://www.youtube.com/watch?v=diI3qsaASuo)

## 📋 Table of Contents

- [🌟 Introduction](#-introduction)
- [✨ Features](#-features)
- [🏗️ Architecture](#️-architecture)
- [🛠️ Tech Stack](#️-tech-stack)
- [📋 Prerequisites](#-prerequisites)
- [🚀 Setup & Installation](#-setup--installation)
- [🏃‍♂️ Running the Application](#️-running-the-application)
- [📚 API Documentation](#-api-documentation)
- [🐳 Docker Deployment](#-docker-deployment)
- [📁 Project Structure](#-project-structure)
- [⚙️ Environment Configuration](#️-environment-configuration)
- [🔧 Development](#-development)

## 🌟 Introduction

Dobbe is a modern web application that leverages artificial intelligence to analyze dental X-ray images and detect various dental conditions such as cavities and periapical lesions. The platform supports both standard image formats and DICOM files, providing comprehensive metadata extraction and analysis capabilities.

## ✨ Features

### 🔍 AI-Powered Detection

- **Cavity Detection**: Automatically identify cavities with confidence scores
- **Periapical Lesion Detection**: Detect periapical lesions with precise bounding boxes
- **Real-time Analysis**: Fast inference using Roboflow's computer vision models

### 📁 File Support

- **DICOM Processing**: Full DICOM file support with metadata extraction
- **PNG Image Support**: Upload PNG dental X-rays for AI detection; DICOM studies are converted to lossless PNG for model inference while original DICOM metadata is extracted and returned separately for display and reporting
- **DICOM Metadata**: Preserve and display available patient, study, acquisition, equipment, and image details independently of the converted model image
- **Drag & Drop Interface**: Intuitive file upload experience
- **File Validation**: DICOM and PNG type validation with a 10MB per-file limit
- **Sample Files**: Test DICOM files available in `docs/sample/` folder for development and testing

### 🏥 Clinical Workspace

- **Two-Screen Workflow**: Separate New Analysis uploads from the Analysis Workspace; completing processing opens the workspace directly
- **Responsive Navigation**: Full-height desktop sidebar and accessible slide-out navigation on smaller screens
- **Per-Study Review**: Switch between completed and failed studies in the analysis workspace
- **Responsive Radiology UI**: Clinical navy and teal styling keeps uploads, DICOM previews, and findings easy to review across screen sizes

### 📊 Comprehensive Results

- **Image Review**: Large radiograph viewer with zoom controls, fullscreen inspection, and numbered model regions
- **Linked Findings**: Selecting a numbered finding highlights its box; selecting a box identifies the matching finding
- **Duplicate Handling**: Near-identical overlapping predictions of the same model class are suppressed from the clinical view, while raw predictions remain in diagnostics
- **Model Diagnostics**: Confidence scores (model scores, not diagnostic probabilities) and raw bounding-box coordinates are hidden in a collapsible technical section
- **Metadata Display**: DICOM metadata remains available separately from the converted inference image
- **Clinical Report Workspace**: Actual model findings and supporting image markers, uncertainty and limitations, finding-linked assessment prompts, and an explicitly unconfirmed dentist impression draft
- **Export Capabilities**: Print or download clinical review reports as PDFs

### 🩺 Clinical Review Aid

- **Finding-Specific Assessment Prompts**: Caries, periapical findings, periodontal findings, restorations, impaction, fractures, implants, and anatomy labels receive different review prompts tied to the submitted detection
- **Clinical Limitations**: No inferred tooth numbers, confirmed diagnoses, severity ratings, treatment plans, prescriptions, or assistant task assignments
- **Validation Status**: Prompts are not a validated clinical protocol; dentist review and clinical validation are required before clinical use
- **No External Report Generation**: Review aids are generated locally from the supplied model detections; Groq is not used
- **Dentist Confirmation Required**: The impression draft is not saved or identity-verified and is not a final clinical record

### 📄 PDF Export Features

- **Professional Formatting**: Clean, medical-grade PDF layout with proper typography
- **Clinical Review Content**: Includes detected findings, supporting numbered image markers, limitations, and finding-linked dentist assessment prompts
- **Technical Information**: DICOM metadata, image specifications, and processing details
- **Multi-page Support**: Automatic page breaks and pagination for lengthy reports
- **Draft Status**: Clearly labels user-entered impression text as an unsaved, unconfirmed draft

## 🏗️ Architecture

```mermaid
graph TB
    subgraph "Frontend (Next.js)"
        A[React Components] --> B[State Management<br/>Zustand]
        A --> C[API Client<br/>React Query + Axios]
        A --> D[DICOM Processing<br/>dcmjs-imaging]
        A --> E[UI Components<br/>Radix UI + Tailwind]
    end

    subgraph "Backend (FastAPI)"
        F[API Routes] --> G[Service Layer]
        G --> H[DICOM Parser<br/>pydicom]
        G --> I[Image Converter<br/>PIL + NumPy]
        G --> J[AI Inference<br/>Roboflow SDK]
    end

    subgraph "External Services"
        K[Roboflow API<br/>Computer Vision Models]
    end

    C --> F
    J --> K
```

### Architecture Highlights

- **Microservices Design**: Separate frontend and backend services
- **Type Safety**: Full TypeScript implementation with Pydantic models
- **Async Processing**: Non-blocking file processing and API calls
- **Error Handling**: Comprehensive error boundaries and validation
- **Scalable Structure**: Modular design for easy feature additions

## 🛠️ Tech Stack

### Frontend

- **Framework**: Next.js 15.3.3 with React 19
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 with customized shadcn/ui
- **State Management**: Zustand + React Query (TanStack Query)
- **UI Components**: shadcn/ui + Radix UI primitives
- **Medical Imaging**: dcmjs-imaging for DICOM preview (uses WASM for fast client side parsing)
- **File Handling**: React Dropzone

### Backend

- **Framework**: FastAPI with Python 3.12+
- **Medical Imaging**: pydicom for DICOM processing
- **Image Processing**: Pillow (PIL) + NumPy
- **AI Inference**: Roboflow Inference SDK
- **Validation**: Pydantic v2 with type safety
- **Configuration**: Pydantic Settings with environment variables
- **Package Management**: UV for fast dependency resolution

### External Services

- **AI Models**: [Roboflow computer vision platform](https://app.roboflow.com/ "Roboflow computer vision platform")
- **Model**: `p_fase_1_v2/4`
- **Model classes**: Determined by the selected Roboflow model

## 📋 Prerequisites

- **Node.js**: v18.0.0 or higher
- **Python**: 3.12 or higher
- **UV**: Python package manager ([installation guide](https://docs.astral.sh/uv/getting-started/installation/))
- **pnpm**: Fast package manager for Node.js (optional but recommended)
- **Roboflow API Key**: Required for AI inference

## 🚀 Setup & Installation

### 1. Clone the Repository

```bash
git clone https://github.com/adityanandanx/dental-conditions-detection
cd dental-conditions-detection
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies using UV
uv sync

# Create environment file
cp .env.example .env
# Edit .env and add your Roboflow API key
```

### 3. Frontend Setup

```bash
cd ../frontend

# Install dependencies
pnpm install
# or
npm install

# Create environment file
cp .env.example .env.local
```

### 4. Environment Configuration

Create `.env` files in both directories:

**Backend (`backend/.env`)**:

```env
ROBOFLOW_API_KEY=your_roboflow_api_key_here
DEBUG=false
```

The backend requires a Roboflow API key for image inference. For Docker Compose, put it in the repository-root `.env` file; for local backend development, put it in `backend/.env`. Clinical review aids are generated locally and do not require a Groq API key.

**Frontend (`frontend/.env.local`)**:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

## 🏃‍♂️ Running the Application

### Development Mode

**Terminal 1 - Backend**:

```bash
cd backend

# Unix/Linux/macOS
source .venv/bin/activate
# Windows
.venv\Scripts\activate

fastapi dev
```

**Terminal 2 - Frontend**:

```bash
cd frontend
pnpm dev
# or
npm run dev
```

### Production Mode

**Backend**:

```bash
cd backend

# Unix/Linux/macOS
source .venv/bin/activate
# Windows
.venv\Scripts\activate

fastapi run
```

**Frontend**:

```bash
cd frontend
pnpm build && pnpm start
# or
npm run build && npm start
```

### Access Points

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **Alternative API Docs**: http://localhost:8000/redoc

## 📚 API Documentation

### Endpoints

#### `POST /api/v1/detect`

Detect dental conditions in standard image files.

**Request**: Multipart form with image file
**Response**: Detection results with bounding boxes and confidence scores

#### `POST /api/v1/detect-dicom`

Process DICOM files with metadata extraction or PNG images without DICOM metadata.

**Request**: Multipart form with a DICOM (`.dcm`, `.dicom`), DICOM-compatible RVG (`.rvg`), or PNG (`.png`) file. Proprietary RVG formats that are not DICOM-compatible are not supported.
**Response**: Complete analysis with the following format:

```json
{
  "predictions": [
    {
      "x": 346.5,
      "y": 323.5,
      "width": 107,
      "height": 105,
      "confidence": 0.839,
      "class": "cavity",
      "class_id": 0,
      "detection_id": "uuid-string"
    }
  ],
  "metadata": {
    "patient_id": "12345",
    "study_date": "20241208"
    // ... additional DICOM metadata; empty for PNG images
  },
  "image_info": {
    "original_shape": [512, 512],
    "converted_format": "PNG",
    "converted_size": [512, 512]
  }
}
```

#### `POST /api/v1/generate-diagnostic-report`

Generate a clinical review aid from detection results already returned by `/api/v1/detect-dicom`. The report is generated deterministically from the submitted detections; no external language model or patient metadata is sent to a report-generation service.

**Request**: JSON with `predictions`, optional `metadata`, and optional `image_info`
**Features**:

- Does not rerun inference; uses the submitted detections from the completed analysis
- Produces uncertainty notes and one class-specific assessment prompt for each supplied detection ID
- Tailors review points to the detected label, including explicit handling of implant brands, anatomy labels, and unconfigured classes
- Does not infer tooth numbers, confirm diagnoses, prescribe treatment, or assign assistant tasks

**Response**: Clinical review aid in the following format:

```json
{
  "diagnostic_report": {
    "uncertainty_and_limitations": "These class-specific prompts are for clinician review, not diagnoses or treatment recommendations, and have not been independently validated as a clinical protocol. Model scores are not calibrated diagnostic probabilities. A dentist must review the source radiograph and clinical context before documenting a conclusion.",
    "suggested_assessments": [
      {
        "detection_id": "uuid-string",
        "suggestion": "Finding 01 (cavity): Inspect the marked surface for a radiolucency and its apparent relationship to enamel, dentin, and the pulp; check for proximal overlap, cervical burnout, and restoration-related artifacts. Correlate with a clinical visual examination, symptoms, and caries risk. The image and model label alone cannot establish lesion activity, cavitation, or treatment need."
      }
    ],
    "generated_at": "2024-12-08T10:30:00Z"
  },
  "detections_used": [
    {
      "x": 346.5,
      "y": 323.5,
      "width": 107,
      "height": 105,
      "confidence": 0.839,
      "class": "cavity",
      "class_id": 0,
      "detection_id": "uuid-string"
    }
  ],
  "metadata": {
    "patient_id": "12345",
    "study_date": "20241208"
    // ... additional DICOM metadata (if DICOM file)
  }
}
```

#### `GET /api/v1/health`

Health check endpoint for monitoring.

## 🐳 Docker Deployment

### Quick Start

```bash
# Create the environment file and add your API keys
echo "ROBOFLOW_API_KEY=your_api_key_here" > .env

# Start production environment
make quick-start
# or
docker compose build && docker compose up -d
```

**Access**: Frontend at http://localhost:3000, Backend at http://localhost:8000

### Development with Docker

```bash
# Create the environment file and add your API keys
echo "ROBOFLOW_API_KEY=your_api_key_here" > .env

# Start development with hot reload and file watching
make dev
# or
docker compose build && docker compose -f docker-compose.dev.yml up --build

# Or use Docker Compose watch (requires v2.22+)
make watch
# or
docker compose -f docker-compose.dev.yml watch
```

### Architecture Features

- **Multi-stage builds**: Optimized images with builder and production stages
- **Health checks**: Built-in health monitoring for both services
- **Volume caching**: Persistent volumes for dependencies and build cache
- **Security**: Non-root users in production containers
- **Development workflow**: File watching with automatic rebuilds

### Available Commands

```bash
make help           # Show all available commands
make dev           # Development with hot reload
make up            # Production deployment
make logs          # View service logs
make health        # Check service health
make clean         # Clean up containers and volumes
```

### Container Specifications

- **Backend**: Python 3.12-slim with medical imaging libraries (pydicom, OpenCV) utilizing uv package manager
- **Frontend**: Node.js 20-slim with pnpm package manager
- **Volumes**: Cached dependencies and build artifacts for faster rebuilds
- **Networking**: Internal service communication with external port exposure

## 📁 Project Structure

```
dobbe/
├── frontend/                 # Next.js frontend application
│   ├── src/
│   │   ├── app/              # App Router pages
│   │   ├── components/       # React components
│   │   │   ├── ui/           # Base UI components
│   │   │   ├── dicom/        # DICOM-specific components
│   │   │   ├── detection/    # Detection result components
│   │   │   └── results/      # Results display components
│   │   ├── hooks/            # Custom React hooks
│   │   └── lib/              # Utilities and configurations
│   ├── public/               # Static assets
│   ├── Dockerfile            # Frontend Docker configuration
│   ├── package.json          # Node.js dependencies
│   ├── pnpm-lock.yaml        # pnpm lock file
│   ├── next.config.ts        # Next.js configuration
│   ├── tsconfig.json         # TypeScript configuration
│   ├── eslint.config.mjs     # ESLint configuration
│   ├── postcss.config.mjs    # PostCSS configuration
│   ├── components.json       # shadcn/ui configuration
│   └── .env.example          # Environment variables template
│
├── backend/                  # FastAPI backend application
│   ├── app/
│   │   ├── api/              # API route handlers
│   │   ├── core/             # Core configurations
│   │   ├── models/           # Pydantic data models
│   │   ├── services/         # Business logic services
│   │   └── dependencies/     # Shared dependencies
│   ├── Dockerfile            # Backend Docker configuration
│   ├── pyproject.toml        # Python dependencies and project config
│   ├── uv.lock               # UV lock file
│   └── .env.example          # Environment variables template
│
├── docs/                     # Documentation and assets
│
├── docker-compose.yml        # Production Docker Compose
├── docker-compose.dev.yml    # Development Docker Compose
├── Makefile                  # Build and development commands
├── .env.example              # Global environment variables template
└── .gitignore                # Git ignore patterns
```

## ⚙️ Environment Configuration

### Required Environment Variables

| Variable              | Description                           | Required | Default                        |
| --------------------- | ------------------------------------- | -------- | ------------------------------ |
| `ROBOFLOW_API_KEY`    | API key for Roboflow inference        | Yes      | -                              |
| `DEBUG`               | Enable debug mode                     | No       | `false`                        |
| `NEXT_PUBLIC_API_URL` | Backend API URL                       | No       | `http://localhost:8000/api/v1` |
| `FRONTEND_PORT`       | Host port for the frontend            | No       | `3000`                         |

## 🔧 Development

### Code Quality

The project includes comprehensive tooling for code quality:

- **TypeScript**: Strict type checking
- **ESLint**: Code linting with Next.js configuration
- **Pydantic**: Runtime type validation for Python
- **UV**: Fast and reliable Python package management

### Sample DICOM Files

For testing and development purposes, sample DICOM files are provided in the `docs/sample/` directory:

- `abc.dcm` - Sample dental X-ray DICOM file
- `xyz.dcm` - Sample dental X-ray DICOM file
- `IM-0000-0000.dcm` - Sample DICOM file with metadata
- `IM-0001-0000.dcm` - Sample DICOM file with metadata
- `IM-0002-0000.dcm` - Sample DICOM file with metadata

These files can be used to test the DICOM processing, metadata extraction, and AI detection features without needing real patient data.

### Testing

```bash
# Frontend
cd frontend
pnpm test

# Backend
cd backend
uv run pytest
```

<p align="center">
  <b>Built with ❤️ for advancing dental healthcare through AI</b>
  <br/>
  <a href="#-table-of-contents">
  ⬆ Back to top
  </a>
</p>

<br/>

<br/>

<br/>
