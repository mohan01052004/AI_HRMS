# AI-HRMS — System Architecture

## Overview

AI-HRMS is a full-stack Human Resource Management System built on a decoupled frontend/backend architecture with two databases (PostgreSQL and MongoDB) and Groq AI for intelligent features.

---

## System Architecture Diagram

```mermaid
graph TB
    subgraph CLIENT["🌐 Browser Client"]
        direction TB
        React["React 19 + Vite\n(Port 5173)"]
        Router["React Router v7\n(Protected Routes)"]
        Tailwind["TailwindCSS v4\nStyling"]
        Recharts["Recharts\nCharts & Graphs"]
    end

    subgraph FRONTEND_STATE["⚛️ Frontend State"]
        AuthCtx["AuthContext\n(JWT + User)"]
        AxiosInst["Axios Instance\n(JWT Interceptor)"]
        HotToast["react-hot-toast\n(Notifications)"]
    end

    subgraph PAGES["📄 Pages"]
        Login["Login"]
        Dashboard["Dashboard\n(Role-specific)"]
        Employees["Employees"]
        Attendance["Attendance"]
        Leave["Leave"]
        Payroll["Payroll"]
        Recruitment["Recruitment"]
        Performance["Performance"]
        Onboarding["Onboarding"]
        Profile["Profile / Settings"]
    end

    subgraph BACKEND["⚙️ FastAPI Backend (Port 8000)"]
        direction TB
        FastAPI["FastAPI App\nmain.py"]

        subgraph AUTH["🔐 Auth Layer"]
            JWT["JWT Handler\n(python-jose)"]
            PassLib["Passlib\n(bcrypt hashing)"]
            Guards["Role Guards\n(require_admin / require_hr / ...)"]
        end

        subgraph ROUTES["🛣️ API Routes"]
            AuthRoutes["/auth\nRegister / Login / Me / Change-PW"]
            EmpRoutes["/employees\nCRUD + Approve + Departments"]
            AttRoutes["/attendance\nClock In/Out + History + Summary"]
            LeaveRoutes["/leave\nApply + Approve + Reject + Types"]
            PayRoutes["/payroll\nStructure + Generate + Slips"]
            RecRoutes["/recruitment\nJob Postings + AI Screening"]
            PerfRoutes["/performance\nGoals + Reviews + AI Summary"]
            DashRoutes["/dashboard\nAdmin / Manager / Recruiter / Employee"]
            AIRoutes["/ai\nInsights + Chatbot + Screening"]
            OBRoutes["/onboarding\nTasks + Progress"]
        end
    end

    subgraph DATABASES["💾 Databases"]
        PostgreSQL["PostgreSQL\n(Primary — Relational)\n\nUsers · Employees · Departments\nAttendance · Leave · Payroll\nGoals · Reviews · Onboarding"]
        MongoDB["MongoDB\n(Secondary — Document)\n\nAI Chat History\nResume Screening Results\nAI Analysis Logs"]
    end

    subgraph AI["🤖 AI Layer"]
        Groq["Groq Cloud API\n(Llama 3.3-70B / Llama 3-8B)"]
        PyMuPDF["PyMuPDF\n(PDF Text Extraction)"]
        ResumeScreen["Resume Screener\n(Skill Match + Score 0-100)"]
        HRChatbot["HR Chatbot 'Alex'\n(Conversation History)"]
        PerfSummary["Performance Summary\n(AI Written Reviews)"]
        WorkforceInsights["Workforce Insights\n(Anomaly Detection)"]
    end

    %% Client connections
    React --> Router
    React --> Tailwind
    React --> Recharts
    React --> FRONTEND_STATE
    Router --> PAGES
    AuthCtx --> AxiosInst
    AxiosInst --> FastAPI

    %% Backend internal
    FastAPI --> AUTH
    FastAPI --> ROUTES
    AUTH --> JWT
    JWT --> PassLib
    JWT --> Guards
    Guards --> ROUTES

    %% Database connections
    ROUTES --> PostgreSQL
    AIRoutes --> MongoDB
    RecRoutes --> MongoDB

    %% AI connections
    AIRoutes --> Groq
    Groq --> PyMuPDF
    Groq --> ResumeScreen
    Groq --> HRChatbot
    Groq --> PerfSummary
    Groq --> WorkforceInsights
    PyMuPDF --> ResumeScreen
```

---

## Data Flow

### Authentication Flow

```mermaid
sequenceDiagram
    participant Browser as 🌐 Browser
    participant Login as Login.jsx
    participant Axios as Axios Instance
    participant API as FastAPI /auth
    participant DB as PostgreSQL

    Browser->>Login: Enter email + password
    Login->>Axios: POST /auth/login/json
    Axios->>API: JSON { email, password }
    API->>DB: SELECT user WHERE email = ?
    DB-->>API: User record
    API->>API: bcrypt verify password
    API-->>Axios: { access_token, user }
    Axios-->>Login: Response
    Login->>Login: localStorage.setItem(token, user)
    Login->>Browser: Navigate /dashboard
```

---

### Role-Based Access Control

```mermaid
graph LR
    subgraph ROLES["User Roles"]
        Admin["management_admin\n👑 Full Access"]
        Manager["senior_manager\n👔 Team Management"]
        HR["hr_recruiter\n👥 HR Operations"]
        Employee["employee\n👤 Self Service"]
    end

    subgraph MODULES["Accessible Modules"]
        D["Dashboard ✓"]
        E["Employees"]
        A["Attendance"]
        L["Leave"]
        P["Payroll"]
        R["Recruitment"]
        Perf["Performance"]
        O["Onboarding"]
    end

    Admin --> D
    Admin --> E
    Admin --> A
    Admin --> L
    Admin --> P
    Admin --> R
    Admin --> Perf
    Admin --> O

    Manager --> D
    Manager --> E
    Manager --> A
    Manager --> L
    Manager --> Perf
    Manager --> O

    HR --> D
    HR --> E
    HR --> A
    HR --> L
    HR --> P
    HR --> R
    HR --> Perf

    Employee --> D
    Employee --> A
    Employee --> L
    Employee --> Perf
    Employee --> O
```

---

## Component Architecture

```mermaid
graph TD
    App["App.jsx\nBrowserRouter + AuthProvider + Toaster"]
    PRoute["ProtectedRoute\n(Auth + Role Guard)"]
    AppLayout["AppLayout\nSidebar + Navbar + ChatBot"]
    Sidebar["Sidebar.jsx\nRole-filtered nav, collapsible"]
    Navbar["Navbar.jsx\nNotifications + User menu + Logout"]
    ChatBot["ChatBot.jsx\nFloating AI chat widget"]

    App --> PRoute
    PRoute --> AppLayout
    AppLayout --> Sidebar
    AppLayout --> Navbar
    AppLayout --> ChatBot
    AppLayout --> Pages

    Pages["All Pages\n(Dashboard / Employees / Attendance / Leave / ...)"]
```

---

## Database Schema (PostgreSQL)

```mermaid
erDiagram
    users {
        int id PK
        string name
        string email
        string password_hash
        enum role
        bool is_active
    }
    employees {
        int id PK
        int user_id FK
        int department_id FK
        string phone
        string position
        string gender
        enum status
        bool is_approved
        date hire_date
    }
    departments {
        int id PK
        string name
    }
    attendance {
        int id PK
        int employee_id FK
        date date
        time clock_in
        time clock_out
        enum status
    }
    leave_requests {
        int id PK
        int employee_id FK
        int leave_type_id FK
        date from_date
        date to_date
        enum status
        string reason
    }
    payslips {
        int id PK
        int employee_id FK
        decimal gross
        decimal deductions
        decimal net
        string month
        int year
    }

    users ||--o| employees : "has"
    departments ||--o{ employees : "contains"
    employees ||--o{ attendance : "logs"
    employees ||--o{ leave_requests : "applies"
    employees ||--o{ payslips : "receives"
```

---

## API Endpoint Summary

| Prefix | Endpoints | Auth Required |
|--------|-----------|---------------|
| `/auth` | `POST /register`, `POST /login`, `POST /login/json`, `GET /me`, `PUT /me`, `POST /change-password` | Mixed |
| `/employees` | `GET /`, `POST /`, `GET /{id}`, `PUT /{id}`, `PATCH /{id}`, `DELETE /{id}`, `PUT /{id}/approve`, `GET /departments`, `GET /stats` | Admin / HR / Manager |
| `/attendance` | `POST /clock-in`, `POST /clock-out`, `GET /today`, `GET /my`, `GET /team`, `GET /summary` | All |
| `/leave` | `GET /types`, `POST /apply`, `GET /my`, `GET /pending`, `PUT /{id}/approve`, `PUT /{id}/reject` | All |
| `/payroll` | `POST /salary-structure`, `POST /generate`, `GET /my`, `GET /all` | Admin / HR |
| `/recruitment` | `GET /jobs`, `POST /jobs`, `PUT /jobs/{id}`, `DELETE /jobs/{id}` | Admin / HR |
| `/performance` | `GET /goals`, `POST /goals`, `GET /reviews`, `POST /reviews`, `GET /ai-summary` | All |
| `/dashboard` | `GET /admin`, `GET /manager`, `GET /recruiter`, `GET /employee` | Role-specific |
| `/ai` | `POST /screen-resume`, `POST /chat`, `GET /insights`, `GET /payroll-anomalies` | Authenticated |
| `/onboarding` | `GET /tasks`, `POST /tasks`, `PUT /tasks/{id}` | All |

---

## Environment Variables

### Backend `.env`

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection URL | `postgresql+asyncpg://...` |
| `MONGODB_URL` | MongoDB connection URL | `mongodb://localhost:27017` |
| `MONGODB_NAME` | MongoDB database name | `aihrms` |
| `SECRET_KEY` | JWT signing secret (32+ chars) | *(required)* |
| `ALGORITHM` | JWT algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token TTL | `1440` (24h) |
| `GROQ_API_KEY` | Groq Cloud API key for AI features | *(optional)* |
| `FRONTEND_URL` | CORS allowed origin | `http://localhost:5173` |

### Frontend `.env`

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API base URL | `http://localhost:8000` |
