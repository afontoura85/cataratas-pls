# Guia de Deploy - Cataratas PLS

Este guia explica como fazer o deploy da aplicação Cataratas PLS no Google Cloud Run com a API key do Gemini configurada corretamente.

## 📋 Pré-requisitos

1. **Google Cloud SDK** instalado e configurado
   ```bash
   gcloud auth login
   gcloud config set project SEU_PROJECT_ID
   ```

2. **Arquivo `.env`** configurado localmente
   ```env
   VITE_API_KEY=sua_api_key_do_gemini_aqui
   ```

3. **Docker** instalado (apenas para o método 2)

## 🚀 Métodos de Deploy

### Método 1: Script Automatizado (Recomendado)

O jeito mais fácil é usar o script `deploy.sh`:

```bash
# Tornar o script executável (apenas na primeira vez)
chmod +x deploy.sh

# Executar deploy
./deploy.sh
```

O script irá:
- ✅ Verificar se o arquivo `.env` existe
- ✅ Carregar a API key automaticamente
- ✅ Perguntar qual método de deploy você prefere
- ✅ Fazer o deploy completo no Cloud Run

### Método 2: Deploy Direto (Manual)

Deploy direto do código-fonte, sem criar imagem Docker intermediária:

```bash
# Carregar variáveis do .env
source .env

# Deploy direto
gcloud run deploy cataratas-pls \
  --source . \
  --platform managed \
  --region southamerica-east1 \
  --allow-unauthenticated \
  --build-env-vars "VITE_API_KEY=$VITE_API_KEY"
```

**Vantagens:**
- ⚡ Mais rápido
- 🎯 Mais simples
- ✨ Sem necessidade de Docker local

### Método 3: Build Manual + Deploy

Para mais controle sobre o processo:

```bash
# 1. Carregar API key
source .env

# 2. Build da imagem com a API key
docker build \
  --build-arg VITE_API_KEY="$VITE_API_KEY" \
  -t gcr.io/SEU_PROJECT_ID/cataratas-pls:latest \
  .

# 3. Push para o Container Registry
docker push gcr.io/SEU_PROJECT_ID/cataratas-pls:latest

# 4. Deploy no Cloud Run
gcloud run deploy cataratas-pls \
  --image gcr.io/SEU_PROJECT_ID/cataratas-pls:latest \
  --platform managed \
  --region southamerica-east1 \
  --allow-unauthenticated
```

**Vantagens:**
- 🔍 Mais controle
- 🧪 Pode testar a imagem localmente antes
- 📦 Pode reutilizar a mesma imagem

## 🔐 Segurança da API Key

### ⚠️ Importante: API Key no Front-end

Como esta é uma aplicação front-end (React), a API key do Gemini **será incluída no código JavaScript compilado** e ficará visível para qualquer pessoa que inspecionar o código.

### Medidas de Proteção Recomendadas

1. **Configure restrições de API Key no Google Cloud Console:**
   - Acesse: https://console.cloud.google.com/apis/credentials
   - Edite sua API key do Gemini
   - Em "Application restrictions", selecione "HTTP referrers"
   - Adicione seus domínios autorizados:
     - `https://pls.construtoracataratas.com.br/*`
     - `https://seu-dominio-de-staging.com/*`

2. **Considere criar um backend proxy** (para produção de longo prazo):
   ```
   [Frontend] → [Seu Backend] → [Gemini API]
   ```
   Assim a API key fica segura no servidor.

3. **Monitore o uso** no Google Cloud Console para detectar abusos

## 🔄 Atualizações de Produção

Para atualizar a aplicação em produção:

```bash
# 1. Fazer suas alterações no código
# 2. Commit no git
git add .
git commit -m "Descrição das mudanças"
git push origin main

# 3. Deploy
./deploy.sh
```

## 🧪 Deploy de Staging/Dev

Para deploy em ambiente de desenvolvimento:

```bash
# Usar arquivo .env.local ou .env.staging
source .env.local

gcloud run deploy cataratas-pls-dev \
  --source . \
  --platform managed \
  --region southamerica-east1 \
  --build-env-vars "VITE_API_KEY=$VITE_API_KEY"
```

## 📊 Verificação Pós-Deploy

Após o deploy, verifique se tudo está funcionando:

1. **Acesse a URL** fornecida pelo Cloud Run
2. **Teste o assistente de IA**:
   - Clique no ícone do assistente
   - Tente fazer upload de uma imagem
   - Verifique se não há erros de API key
3. **Verifique os logs**:
   ```bash
   gcloud run logs read cataratas-pls --region southamerica-east1 --limit 50
   ```

## ❓ Troubleshooting

### Erro: "API key is missing"

- ✅ Verifique se o arquivo `.env` existe e contém `VITE_API_KEY`
- ✅ Certifique-se de que passou a API key durante o build
- ✅ Refaça o deploy usando um dos métodos acima

### Erro: "Permission denied"

```bash
# Autentique novamente
gcloud auth login

# Configure o projeto
gcloud config set project SEU_PROJECT_ID
```

### Build muito lento

- Use o Método 2 (Deploy Direto) ao invés do build manual
- O Google Cloud Build é otimizado e usa cache

## 📝 Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `VITE_API_KEY` | ✅ Sim | API key do Google Gemini |
| `GOOGLE_CLOUD_PROJECT` | ❌ Não | ID do projeto GCP (default: cataratas-pls) |
| `GOOGLE_CLOUD_REGION` | ❌ Não | Região do Cloud Run (default: southamerica-east1) |

## 🔗 Links Úteis

- [Google Cloud Console](https://console.cloud.google.com)
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Gemini API Keys](https://aistudio.google.com/app/apikey)
- [API Key Restrictions](https://cloud.google.com/docs/authentication/api-keys#api_key_restrictions)
