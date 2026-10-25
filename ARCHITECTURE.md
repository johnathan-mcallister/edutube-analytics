# EduTube Analytics architecture

## System architecture

```mermaid
flowchart LR
    U[User browser]

    subgraph Docker[Docker Compose]
        subgraph Frontend[frontend container]
            N[Nginx :80]
            R[React dashboard]
            A[Client-side analysis]
            C[Recharts visualizations]
            R --> A --> C
        end

        subgraph Backend[backend container]
            E[Express API :3000]
            H[GET /api/health]
            V[GET /api/videos]
            P[POST /api/collect]
            Y[YouTube collection logic]
            T[Duration conversion]
            Q[PostgreSQL queries and upserts]
            E --> H
            E --> V
            E --> P --> Y
            Y --> T --> Q
            V --> Q
            H --> Q
        end

        subgraph Database[db container]
            DB[(PostgreSQL :5432)]
            VOL[(postgres_data volume)]
            DB --- VOL
        end
    end

    YT[YouTube Data API v3]

    U -->|http://localhost:8080| N
    N -->|static files| R
    R -->|/api requests| N
    N -->|reverse proxy| E
    Y -->|search.list| YT
    Y -->|videoCategories.list| YT
    Y -->|videos.list, batches of 50| YT
    Q -->|SQL| DB
    DB -->|stored video records| Q
```

## Collection request flow

```mermaid
sequenceDiagram
    actor User
    participant UI as React frontend
    participant Proxy as Nginx
    participant API as Express backend
    participant YouTube as YouTube Data API
    participant DB as PostgreSQL

    User->>UI: Enter topic and collect up to 500 videos
    UI->>Proxy: POST /api/collect
    Proxy->>API: Forward request
    loop Up to 10 pages of 50 results
        API->>YouTube: search.list
        YouTube-->>API: Video IDs and nextPageToken
    end
    API->>YouTube: videoCategories.list
    YouTube-->>API: Category labels
    loop Batches of up to 50 IDs
        API->>YouTube: videos.list
        YouTube-->>API: Metadata, duration, and statistics
    end
    API->>API: Convert ISO 8601 duration to minutes
    API->>DB: INSERT ... ON CONFLICT UPDATE
    DB-->>API: Commit transaction
    API-->>UI: Number of videos collected
    UI->>API: GET /api/videos
    API->>DB: SELECT saved videos
    DB-->>API: Video records
    API-->>UI: JSON dataset
    UI->>UI: Calculate metrics, filters, and chart data
```

## Routes and external endpoints

| Method | Route or endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Confirms that the backend can connect to PostgreSQL. |
| `GET` | `/api/videos` | Returns all stored videos, ordered by view count. |
| `POST` | `/api/collect` | Accepts a topic and count, collects YouTube data, and upserts it into PostgreSQL. |
| `GET` | YouTube `search.list` | Finds video IDs using paginated search requests. |
| `GET` | YouTube `videoCategories.list` | Resolves YouTube category IDs to readable category names. |
| `GET` | YouTube `videos.list` | Retrieves metadata, ISO 8601 duration, views, likes, and comments in batches of 50. |

## Data and analysis boundary

```mermaid
flowchart TD
    RAW[Raw stored fields<br/>ID, title, channel, category,<br/>date, duration, views, likes, comments]
    FILTER[Category and duration filters]
    ENG[Engagement rate<br/>likes + comments / views]
    CORR[Pearson correlation<br/>duration vs. engagement]
    GROUPS[Five dynamic length groups]
    CHANNELS[Unique channels and channel spread]
    CHARTS[Scatter, category pie, and bar charts]

    RAW --> FILTER
    FILTER --> ENG
    FILTER --> CHANNELS
    ENG --> CORR
    ENG --> GROUPS
    FILTER --> CHARTS
    CORR --> CHARTS
    GROUPS --> CHARTS
    CHANNELS --> CHARTS
```

The backend collects and stores raw data. The React frontend performs the current filtering and statistical analysis after loading the dataset from `GET /api/videos`.
