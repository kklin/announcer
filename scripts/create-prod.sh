#!/bin/sh

# Create the VM:
# gcloud compute instances create monday-comments-watcher --project monday-comments-watcher --machine-type n1-standard-1

# Setup firewalls:
# gcloud compute --project monday-comments-watcher firewall-rules create allow-web --allow=tcp:80,tcp:443

# Install Docker (https://docs.docker.com/engine/install/debian/):
# sudo apt-get update
# sudo apt-get install \
#    apt-transport-https \
#    ca-certificates \
#    curl \
#    gnupg-agent \
#    software-properties-common
# curl -fsSL https://download.docker.com/linux/debian/gpg | sudo apt-key add -
# sudo add-apt-repository \
#   "deb [arch=amd64] https://download.docker.com/linux/debian \
#   $(lsb_release -cs) \
#   stable"
# sudo apt-get update
# sudo apt-get install docker-ce docker-ce-cli containerd.io
# sudo usermod -a kevin -G docker

# Install Docker Compose (https://docs.docker.com/compose/install/#linux)
# sudo curl -L "https://github.com/docker/compose/releases/download/1.27.4/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
# sudo chmod +x /usr/local/bin/docker-compose

# Download the application:
# git clone https://github.com/kklin/monday-comments-tracker

# Setup secrets by creating a .env file based on .env.example in the root.

# Build the application images:
# make docker-push

# Start the application:
# docker-compose pull && docker-compose up -d
