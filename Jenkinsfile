pipeline {
  agent { label 'docker' }

  options {
    disableConcurrentBuilds()
    timestamps()
    timeout(time: 20, unit: 'MINUTES')
  }

  environment {
    COMPOSE_PROJECT_NAME = 'edutube-analytics'
    IMAGE_TAG = "${BUILD_NUMBER}"
  }

  stages {
    stage('Checkout') {
      steps { checkout scm }
    }

    stage('Validate') {
      steps {
        sh 'docker compose config --quiet'
        sh 'docker build --target build --tag edutube-frontend-check:${IMAGE_TAG} .'
        sh 'docker build --tag edutube-backend-check:${IMAGE_TAG} ./server'
      }
    }

    stage('Build images') {
      steps { sh 'docker compose build --pull' }
    }

    stage('Deploy') {
      steps {
        withCredentials([
          string(credentialsId: 'edutube-youtube-api-key', variable: 'YOUTUBE_API_KEY'),
          string(credentialsId: 'edutube-postgres-password', variable: 'POSTGRES_PASSWORD')
        ]) {
          sh 'docker compose up --detach --remove-orphans --wait --wait-timeout 120'
        }
      }
    }

    stage('Smoke test') {
      steps {
        sh 'wget --quiet --tries=6 --timeout=5 --output-document=- http://localhost:8080/api/health | grep -q \'"status":"ok"\''
      }
    }
  }

  post {
    failure {
      sh 'docker compose ps || true'
      sh 'docker compose logs --no-color --tail=100 || true'
    }
    cleanup {
      sh 'docker image rm edutube-frontend-check:${IMAGE_TAG} edutube-backend-check:${IMAGE_TAG} 2>/dev/null || true'
    }
  }
}
