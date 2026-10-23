pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                bat 'npm ci'
                bat 'cd server && npm ci'
            }
        }

        stage('Frontend Tests') {
            steps {
                bat 'npm test'
            }
        }

        stage('Backend Tests') {
            steps {
                bat 'cd server && npm test'
            }
        }

        stage('Lint') {
            steps {
                bat 'npm run lint'
            }
        }

        stage('Build') {
            steps {
                bat 'npm run build'
            }
        }
       stage('Docker Check') {
    steps {
        bat '"C:\\Users\\Cyborg\\AppData\\Local\\Programs\\DockerDesktop\\resources\\bin\\docker.exe" --version'
        
    }
}
       stage('Docker Build') {
    steps {
        bat '"C:\\Users\\Cyborg\\AppData\\Local\\Programs\\DockerDesktop\\resources\\bin\\docker.exe" build -t interntrack-frontend:ci .'
        bat '"C:\\Users\\Cyborg\\AppData\\Local\\Programs\\DockerDesktop\\resources\\bin\\docker.exe" build -t interntrack-backend:ci ./server'
    }
}
    }
}