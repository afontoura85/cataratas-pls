<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# PLS - Sistema de Acompanhamento de Obras

Sistema de acompanhamento de obras com integração ao Google Gemini AI.

## Executar Localmente

**Pré-requisitos:** Node.js 18+

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Configure as variáveis de ambiente:
   - Copie o arquivo `.env.example` para `.env`
   - Defina `VITE_API_KEY` com sua chave da API do Gemini
   - Obtenha sua chave em: https://aistudio.google.com/app/apikey

3. Execute o app:
   ```bash
   npm run dev
   ```

## Deploy no Google Cloud Run

### Opção 1: Build e Deploy Direto

```bash
# Substitua SUA_CHAVE_API pela sua chave do Gemini
gcloud run deploy cataratas-pls \
  --source . \
  --platform managed \
  --region southamerica-east1 \
  --allow-unauthenticated \
  --set-build-env-vars VITE_API_KEY=SUA_CHAVE_API
```

### Opção 2: Build Manual com Docker

```bash
# 1. Build da imagem com a API key
docker build --build-arg VITE_API_KEY=SUA_CHAVE_API -t cataratas-pls .

# 2. Tag da imagem
docker tag cataratas-pls gcr.io/SEU_PROJECT_ID/cataratas-pls

# 3. Push para o Google Container Registry
docker push gcr.io/SEU_PROJECT_ID/cataratas-pls

# 4. Deploy no Cloud Run
gcloud run deploy cataratas-pls \
  --image gcr.io/SEU_PROJECT_ID/cataratas-pls \
  --platform managed \
  --region southamerica-east1 \
  --allow-unauthenticated
```

## Variáveis de Ambiente

- `VITE_API_KEY`: Chave da API do Google Gemini (obrigatória)

