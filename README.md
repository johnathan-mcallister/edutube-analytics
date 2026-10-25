# EduTube Analytics

A deliberately small three-service project:

- **frontend:** React dashboard and charts
- **backend:** Express API that collects YouTube data
- **db:** PostgreSQL storage

The frontend performs the engagement analysis after loading saved videos. Engagement is `(likes + comments) / views`, and the dashboard also calculates the Pearson correlation between duration and engagement.

## Run with Docker

1. Copy `.env.example` to `.env`.
2. Put your YouTube Data API key in `.env` as `YOUTUBE_API_KEY`.
3. Start everything:

```bash
docker compose up --build
```

4. Open <http://localhost:8080>.

Enter a search topic and select **Collect up to 500 videos**. The backend paginates through YouTube search results, stores or updates those videos and their categories in PostgreSQL, and the frontend reloads the data and graphs. A 500-video collection uses considerably more YouTube API quota than a small search.

## API

- `GET /api/health` checks the API and database.
- `GET /api/videos` returns saved videos.
- `POST /api/collect` accepts `{ "query": "education", "count": 500 }` (maximum 500).

The YouTube key exists only in the backend container and is never sent to the browser.

## Jenkins deployment

The checked-in `Jenkinsfile` validates both images, builds the Compose application, deploys it in place, waits for all services to become healthy, and smoke-tests the API through the frontend proxy.

Prepare at least one Windows Jenkins agent with:

- Docker Engine with the Compose v2 plugin
- permission for the Jenkins user to use Docker
- Windows PowerShell available on the agent

Create these Jenkins **Secret text** credentials:

- `edutube-youtube-api-key`
- `edutube-postgres-password`

Create a Pipeline or Multibranch Pipeline pointed at this repository and use `Jenkinsfile` as its script path. The deployment is exposed on port `8080` of that agent. Builds reuse the named `edutube-analytics` Compose project and its PostgreSQL volume, so a deployment updates the containers without discarding stored video data.

The pipeline uses any available Jenkins agent and verifies Docker and Compose before building. If you have multiple agents, replace `agent any` in the `Jenkinsfile` with the label assigned to the intended deployment host. The pipeline deliberately deploys on the selected agent instead of copying credentials or Docker context over SSH.
