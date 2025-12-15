#!/bin/bash

# Script de Deploy para Cloud Run - Cataratas PLS
# Este script faz o deploy da aplicação com a API key do Gemini injetada durante o build

set -e  # Para execução se houver erro

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Deploy Cataratas PLS ===${NC}\n"

# Verificar se o arquivo .env existe
if [ ! -f .env ]; then
    echo -e "${RED}Erro: Arquivo .env não encontrado!${NC}"
    echo "Crie um arquivo .env com a variável VITE_API_KEY"
    exit 1
fi

# Carregar variáveis do .env
source .env

# Verificar se a API key foi carregada
if [ -z "$VITE_API_KEY" ]; then
    echo -e "${RED}Erro: VITE_API_KEY não encontrada no arquivo .env${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} API Key carregada do .env"

# Configurações do Google Cloud
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-cataratas-pls}"
REGION="${GOOGLE_CLOUD_REGION:-southamerica-east1}"
SERVICE_NAME="${SERVICE_NAME:-cataratas-pls}"

echo -e "${BLUE}Configurações:${NC}"
echo "  Project ID: $PROJECT_ID"
echo "  Region: $REGION"
echo "  Service: $SERVICE_NAME"
echo ""

# Perguntar qual método de deploy usar
echo -e "${YELLOW}Escolha o método de deploy:${NC}"
echo "  1) Deploy direto do código (mais rápido)"
echo "  2) Build manual + Deploy (mais controle)"
echo ""
read -p "Opção [1]: " DEPLOY_METHOD
DEPLOY_METHOD="${DEPLOY_METHOD:-1}"

if [ "$DEPLOY_METHOD" = "1" ]; then
    echo -e "\n${BLUE}Iniciando deploy direto...${NC}"
    gcloud run deploy "$SERVICE_NAME" \
        --source . \
        --platform managed \
        --region "$REGION" \
        --project "$PROJECT_ID" \
        --allow-unauthenticated \
        --build-env-vars "VITE_API_KEY=$VITE_API_KEY"
    
elif [ "$DEPLOY_METHOD" = "2" ]; then
    echo -e "\n${BLUE}Iniciando build da imagem...${NC}"
    IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME:$(date +%Y%m%d-%H%M%S)"
    
    docker build \
        --build-arg VITE_API_KEY="$VITE_API_KEY" \
        -t "$IMAGE_NAME" \
        .
    
    echo -e "\n${BLUE}Fazendo push da imagem...${NC}"
    docker push "$IMAGE_NAME"
    
    echo -e "\n${BLUE}Fazendo deploy no Cloud Run...${NC}"
    gcloud run deploy "$SERVICE_NAME" \
        --image "$IMAGE_NAME" \
        --platform managed \
        --region "$REGION" \
        --project "$PROJECT_ID" \
        --allow-unauthenticated
else
    echo -e "${RED}Opção inválida!${NC}"
    exit 1
fi

echo -e "\n${GREEN}✓ Deploy concluído com sucesso!${NC}"
echo -e "\nAcesse sua aplicação em:"
gcloud run services describe "$SERVICE_NAME" --region "$REGION" --project "$PROJECT_ID" --format="value(status.url)"
