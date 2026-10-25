pipeline {
  agent any

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
    stage('Prerequisites') {
      steps {
        bat 'docker version'
        bat 'docker compose version'
      }
    }

    stage('Validate') {
      steps {
        bat 'docker compose config --quiet'
        bat 'docker build --target build --tag edutube-frontend-check:%IMAGE_TAG% .'
        bat 'docker build --tag edutube-backend-check:%IMAGE_TAG% ./server'
      }
    }

    stage('Build images') {
      steps { bat 'docker compose build --pull' }
    }

    stage('Deploy') {
      steps {
        withCredentials([
          string(credentialsId: 'edutube-youtube-api-key', variable: 'YOUTUBE_API_KEY'),
          string(credentialsId: 'edutube-postgres-password', variable: 'POSTGRES_PASSWORD')
        ]) {
          bat 'docker compose up --detach --remove-orphans --wait --wait-timeout 120'
        }
      }
    }

    stage('Smoke test') {
      steps {
        powershell '''
          $response = Invoke-RestMethod -Uri 'http://localhost:8080/api/health' -TimeoutSec 10
          if ($response.status -ne 'ok') {
            throw "Unexpected health response: $($response | ConvertTo-Json -Compress)"
          }
        '''
      }
    }
  }

  post {
    failure {
      bat returnStatus: true, script: 'docker compose ps'
      bat returnStatus: true, script: 'docker compose logs --no-color --tail=100'
    }
    cleanup {
      bat returnStatus: true, script: 'docker image rm edutube-frontend-check:%IMAGE_TAG% edutube-backend-check:%IMAGE_TAG%'
    }
  }
}
