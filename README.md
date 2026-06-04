# 🤖 AI-HRMS — Next-Generation HR Management Platform

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com)
[![Groq AI](https://img.shields.io/badge/Groq_Llama_3-f39c12?style=for-the-badge&logo=analytics&logoColor=white)](https://console.groq.com)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)

A premium, production-grade Human Resource Management System (HRMS) that leverages artificial intelligence and real-time WebSockets to streamline workforce operations, automate resume screening, and conduct voice candidate interviews.

---

## 🏗 System Architecture

```
┌─────────────────────┐     HTTP/REST     ┌──────────────────────┐
│   React + Vite      │ ◄────────────── ► │   FastAPI Backend     │
│   (Port 5173)       │                   │   (Port 8000)         │
│                     │                   │                        │
│  - AuthContext      │                   │  - JWT Auth            │
│  - React Router v6  │                   │  - Role Guards         │
│  - Axios + JWT      │                   │  - Pydantic Schemas    │
│  - Recharts         │                   │  - Async SQLAlchemy    │
│  - Lucide Icons     │                   │  - Motor (MongoDB)     │
└─────────────────────┘                   └──────────┬───────────┘
                                                       │
                         ┌─────────────────────────────┼────────────┐
                         │                             │            │
                    ┌─────▼──────┐           ┌─────────▼──────┐  ┌──▼───────────┐
                    │ PostgreSQL │           │   MongoDB       │  │   Groq AI    │
                    │ (Primary)  │           │  (Secondary)    │  │ (Groq Cloud) │
                    │            │           │                 │  │              │
                    │ Users      │           │ chat_history    │  │ llama-3.3    │
                    │ Employees  │           │ resume_screen   │  │ -70b         │
                    │ Attendance │           │ ai_logs         │  │              │
                    │ Leave      │           └─────────────────┘  └──────────────┘
                    │ Payroll    │
                    │ Goals      │
                    │ Reviews    │
                    └────────────┘
```

### 📊 Interactive Mermaid Component
The diagram below represents the complete stateless data flow, WebSocket event broadcast pipeline, and AI service integrations.

```mermaid
graph TD
    %% Frontend Layer
    subgraph Frontend [React SPA - Port 5173]
        UI[Tailwind UI / Recharts]
        AC[Auth Context - JWT]
        WS_C[WebSocket Client - useWebSocket]
        RC[Realtime Provider - react-hot-toast]
        WebSpeech[Web Speech API - Speech-to-Text / TTS]
    end

    %% Network / Protocol
    REST[HTTP / REST Calls]
    WS_Conn[WebSocket Channel - /ws]

    %% Backend Layer
    subgraph Backend [FastAPI Services - Port 8000]
        Limiter[SlowAPI Rate Limiter]
        GZip[GZip Compression]
        Auth[JWT Handler / Role guards]
        Cache[TTLCache - 60s Cache]
        WS_M[Connection Manager]
        Routes[API Routes: Auth, Employees, Leave, Attendance, Payroll, Performance, Recruitment, AI]
    end

    %% Database & LLM Layer
    subgraph Storage [Databases & AI Integrations]
        PostgreSQL[(PostgreSQL - SQLAlchemy)]
        MongoDB[(MongoDB - Motor)]
        Groq[Groq Cloud LLM - llama-3.3-70b]
    end

    %% Connections
    UI --> AC
    UI --> WS_C
    UI --> WebSpeech
    AC --> REST
    WS_C --> WS_Conn
    RC --> UI

    REST --> Limiter
    WS_Conn --> WS_M
    Limiter --> GZip
    GZip --> Auth
    Auth --> Routes
    Routes --> Cache

    Routes -->|Async Query| PostgreSQL
    Routes -->|Non-relational Logs/Assessments| MongoDB
    Routes -->|JSON Chat / Voice Prompts| Groq

    WS_M -->|Pushes Notifications| WS_Conn

    %% PostgreSQL tables
    subgraph PostgreSQL_Tables [PostgreSQL Schema]
        Users[Users Table]
        Emps[Employees Table]
        Att[Attendance Table]
        Lvs[Leave Requests]
        Pay[Payslips & Salaries]
        Goals[Performance Goals]
        Rev[Performance Reviews]
    end
    PostgreSQL --- PostgreSQL_Tables

    %% MongoDB collections
    subgraph MongoDB_Collections [MongoDB Collections]
        Screenings[Resume Screenings]
        Interviews[Voice Interview Audits]
        ChatHist[HR Chatbot History]
        Logs[AI Call Logs]
    end
    MongoDB --- MongoDB_Collections
```

---

## 🚀 Key Features

### 1. 🤖 AI-Driven Recruitment & Screening
*   **Resume Screener**: Upload PDF resumes to automatically extract text, match skills, identify weaknesses, score credentials from 0 to 100, and receive hire/reject recommendations.
*   **Automated Voice Recruiter**: Fully dynamic, turn-based candidate interviews mimicking ChatGPT/Gemini voice mode:
    *   AI reads questions aloud using native Text-to-Speech (TTS).
    *   Microphone automatically starts recording answers (Speech-to-Text).
    *   AI recruiter adapts and asks dynamic context-aware follow-up questions.
    *   Optionally uploads candidate's resume (PDF) to tailor questions to their experience.
    *   Generates a structured candidate evaluation scorecard at completion.

### 2. ⚡ Real-Time WebSockets & Notifications
*   **Active Notifications**: Instant alerts pushed to users via `react-hot-toast` for critical updates:
    *   Attendance updates (clock-in / clock-out events broadcasted to managers).
    *   Leave updates (approval/rejection targeted alerts pushed to employees).
    *   Roster updates (new employee additions).
*   **Bell Hub**: Unified notification bell in the top navigation bar with a live connection status dot (Green for connected, Amber for reconnecting, Red for disconnected).

### 3. 📊 Interactive Visual Dashboards
*   **Admin Per-Employee Drill-down**: Full-activity profiles for individual employees (accessible by Admins, Managers, and HR) showcasing:
    *   6-Month Attendance rates (Bar Chart).
    *   6-Month Net Pay history (Line Chart).
    *   Leave balances (Circular progress trackers).
    *   Active goals (Checklist percentage indicators).
    *   Average Performance Review rating (interactive Star ratings).
*   **Workforce Overview**: Real-time KPI summary widgets, department headcount ratios, and monthly clock-in rates.

### 4. 🔒 Multi-Role Authorization & Security
*   **Granular Role Guards**: Supports `management_admin`, `senior_manager`, `hr_recruiter`, and `employee`.
*   **Approval Gatekeeping**: Employees registered by HR remain in a pending state (`is_approved = False`) until an Admin verifies and approves the account login.
*   **Leave Safeguards**: Gender-restricted maternity leave configuration (only female profiles can request or view maternity leave balance options).

### 5. ⚡ Enterprise Scalability
*   **Database Pool Optimization**: Configured PostgreSQL connection pools (`pool_size=20`, `max_overflow=40`) and MongoDB pools to support 5,000+ concurrent requests.
*   **Rate Limiting**: Protects endpoints against brute-force attacks via SlowAPI (10 req/min for auth logins, 20 req/min for AI endpoints).
*   **Caching & Optimization**: In-memory `TTLCache` (60s TTL) for complex dashboard queries, GZip compression middleware, and execution time tracing headers.

---

## ⚙️ Setup Instructions

### Prerequisites
*   **Python 3.11+**
*   **Node.js 18+**
*   **PostgreSQL** (running locally)
*   **MongoDB** (running locally)
*   **Groq API Key** (Get a free key at [Groq Console](https://console.groq.com))

### 1. Backend Setup
```bash
cd backend

# Create & activate virtual environment
python -m venv venv
venv\Scripts\activate      # Windows
source venv/bin/activate   # Mac/Linux

# Install packages
pip install -r requirements.txt

# Configure environment variables
copy .env.example .env     # Windows
cp .env.example .env       # Mac/Linux
# Open .env and add your database connections and GROQ_API_KEY

# Initialize database and run server (creates schema and tables automatically)
uvicorn main:app --reload --port 8000
```
*API docs will be available at:* http://localhost:8000/docs

### 2. Seed Mock Database Data
Create complete initial testing accounts (admins, managers, recruiters, female/male employees) and mock records (payslips, attendance history, active goals):
```bash
cd backend
python seed.py
```

### 3. Frontend Setup
```bash
cd frontend

# Install packages
npm install

# Start local server
npm run dev
```
*Application interface will be available at:* http://localhost:5173

---

## 🔌 Core API Endpoints

### 🔐 Authentication
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/auth/register` | Register a new user | Public |
| `POST` | `/auth/login/json` | JSON authentication | Public |
| `POST` | `/auth/change-password` | Update account password | Authenticated |
| `GET` | `/auth/me` | Fetch active user credentials | Authenticated |

### 👥 Employees
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/employees` | List/search employees | Admin / Manager / HR |
| `POST` | `/employees` | Register new employee | Admin / HR |
| `PUT` | `/employees/{id}` | Update full profile fields | Admin / Manager |
| `PATCH` | `/employees/{id}` | Edit phone & address only | Own Account / Admin |
| `PUT` | `/employees/{id}/approve` | Approve pending user login | Admin |
| `DELETE` | `/employees/{id}` | Terminate employee record | Admin |

### 📅 Attendance
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/attendance/clock-in` | Register current clock-in | Employee |
| `POST` | `/attendance/clock-out` | Register current clock-out | Employee |
| `GET` | `/attendance` | Fetch attendance records | Admin / Manager / HR |
| `GET` | `/attendance/summary` | Retrieve monthly summaries | Employee |

### ✈️ Leave Requests
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/leave` | List leave request backlog | Admin / Manager / HR |
| `POST` | `/leave/apply` | Apply for a leave request | Employee |
| `PUT` | `/leave/{id}/approve` | Approve/Reject leave requests | Admin / Manager |
| `GET` | `/leave/types` | Fetch valid leave selection types | Authenticated |

### 💰 Payroll
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/payroll/payslips` | List payslips / roster details | Admin / HR |
| `POST` | `/payroll/generate` | Generate bulk monthly payslips | Admin |
| `POST` | `/payroll/salary-structure` | Configure employee salaries | Admin |
| `GET` | `/payroll/summary` | Fetch gross/net finance totals | Admin / HR |

### 💼 Recruitment
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/recruitment` | List active job postings | Authenticated |
| `POST` | `/recruitment` | Create a new job posting | Admin / HR |
| `GET` | `/recruitment/{id}` | Get job details by ID | Authenticated |
| `PUT` | `/recruitment/{id}` | Update job details | Admin / HR |
| `DELETE` | `/recruitment/{id}` | Terminate job posting | Admin / HR |

### 🎯 Performance & Goals
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/performance/goals` | List performance goals | Authenticated (Employee: self-only) |
| `POST` | `/performance/goals` | Create a new goal | Authenticated (Employee: self-only) |
| `PUT` | `/performance/goals/{id}` | Update goals details / progress | Authenticated (Employee: self-only) |
| `DELETE` | `/performance/goals/{id}` | Delete a goal | Authenticated (Employee: self-only) |
| `GET` | `/performance/reviews` | List performance reviews | Authenticated (Employee: self-only) |
| `POST` | `/performance/reviews` | Create a performance review | Admin / Manager |
| `GET` | `/performance/reviews/{id}` | Get detailed performance review | Authenticated (Employee: self-only) |

### 📋 Onboarding Checklist
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/performance/onboarding` | Retrieve onboarding checklists | Authenticated |
| `POST` | `/performance/onboarding` | Create onboarding task | Admin / Manager |
| `PUT` | `/performance/onboarding/{id}/complete` | Mark onboarding task complete | Authenticated |

### 📊 Dashboards
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/dashboard/admin` | Fetch company-wide Admin KPIs | Admin |
| `GET` | `/dashboard/manager` | Fetch team-wide Manager KPIs | Admin / Manager |
| `GET` | `/dashboard/recruiter` | Fetch recruiter statistics | Admin / HR |
| `GET` | `/dashboard/employee` | Fetch personal employee overview | Authenticated |
| `GET` | `/dashboard/employee/{employee_id}` | Fetch individual activity metrics | Admin / Manager / HR |

### 🤖 AI Services & Voice
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/ai/chat` | Chat with global assistant "Alex" | Authenticated |
| `POST` | `/ai/screen-resume` | Evaluate candidate PDF resume | Admin / HR |
| `POST` | `/ai/voice-interview/start` | Begin Dynamic Voice Interview | Admin / HR |
| `POST` | `/ai/voice-interview/next` | Proceed turn-based voice interview | Admin / HR |
| `GET` | `/ai/voice-interviews` | List past interview reports | Admin / HR |
| `POST` | `/ai/performance-summary` | Generate review writeup drafts | Admin / Manager / HR |

### ⚡ Live WebSockets
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/ws` | WebSocket subscription channel | Authenticated (`?token=`) |

---

## 🔐 Environment Variables (`backend/.env`)

```env
# PostgreSQL Database URL
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/aihrms

# MongoDB URL (For Logs & AI Data)
MONGODB_URL=mongodb://localhost:27017
MONGODB_NAME=aihrms

# JWT Authorization
SECRET_KEY=your-super-secret-cryptographic-hash-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Groq Cloud API Key
GROQ_API_KEY=gsk_your_groq_developer_api_key_goes_here

# Frontend Application Origin
FRONTEND_URL=http://localhost:5173
```

---

## 🔑 Demo Access Profiles (Seed Credentials)

| Role | Username / Email | Password | Allowed Modules |
|---|---|---|---|
| **Management Admin** | `admin@hrms.com` | `HrMs@2026!Sec` | All features (including payroll write, approvals) |
| **HR Recruiter** | `hr@hrms.com` | `HrMs@2026!Sec` | Recruitment, Performance, Attendance, Payroll (Read-only) |
| **Senior Manager** | `manager@hrms.com` | `HrMs@2026!Sec` | Team Attendance, Team Leaves, Performance (Payroll Hidden) |
| **Employee (Female)** | `emp@hrms.com` | `HrMs@2026!Sec` | Self-service Portal (Maternity leave allowed) |
| **Employee (Male)** | `amit@hrms.com` | `HrMs@2026!Sec` | Self-service Portal (Maternity leave hidden) |
