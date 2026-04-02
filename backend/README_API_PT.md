# Documentação da API rPPG (Backend)

Este backend fornece uma API REST para análise de sinais vitais (frequência cardíaca) a partir de vídeos faciais usando rPPG (Photoplethysmography remota).

## Endpoints da API

A API roda por padrão na porta `8000`.

### 1. Verificar Status
Verifica se o servidor está online.

- **URL**: `/health`
- **Método**: `GET`
- **Resposta**:
  ```json
  {
    "status": "ok"
  }
  ```

### 2. Analisar Upload de Vídeo
Envia um arquivo de vídeo local para análise.

- **URL**: `/analyze`
- **Método**: `POST`
- **Content-Type**: `multipart/form-data`
- **Parâmetros**:
  - `file`: O arquivo de vídeo (mp4, avi, mov, etc).

**Exemplo (cURL):**
```bash
curl -X POST "http://seu-servidor:8000/analyze" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@/caminho/para/seu/video.mp4"
```

### 3. Analisar Vídeo via URL
Envia um link direto de um vídeo para o servidor baixar e analisar.

- **URL**: `/analyze-url`
- **Método**: `POST`
- **Content-Type**: `application/json`
- **Corpo da Requisição**:
  ```json
  {
    "url": "https://exemplo.com/videos/rosto.mp4"
  }
  ```

**Exemplo (cURL):**
```bash
curl -X POST "http://seu-servidor:8000/analyze-url" \
  -H "accept: application/json" \
  -H "Content-Type: application/json" \
  -d "{ \"url\": \"https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4\" }"
```

**Exemplo (JavaScript/Fetch):**
```javascript
const response = await fetch('http://seu-servidor:8000/analyze-url', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    url: 'https://exemplo.com/videos/rosto.mp4'
  })
});

const data = await response.json();
console.log(data);
```

---

## Formato da Resposta

Ambos os endpoints retornam um JSON com a seguinte estrutura:

```json
{
  "success": true,
  "heart_rate_bpm": 72.5,          // Frequência cardíaca média (BPM)
  "hr_std_bpm": 1.2,               // Desvio padrão da frequência cardíaca
  "video_name": "video_temp",
  "video_duration_sec": 15.4,      // Duração do vídeo processado
  "num_chunks": 2,                 // Número de janelas de tempo processadas
  "fps_used": 30.0,                // FPS utilizado na análise
  "method": "POS",                 // Método rPPG utilizado (padrão: POS)
  "bvp_signal_length": 462,        // Tamanho do vetor de sinal
  "bvp_signal": [0.12, 0.15, ...], // Array com o sinal BVP bruto (para gráficos)
  "quality": {                     // Métricas de qualidade do sinal
    "snr_db": 5.2,                 // Relação Sinal-Ruído em dB
    "is_flatline": false,          // Se o sinal está "morto"
    "is_clipped": false,           // Se o sinal estourou (saturação)
    "quality_score": 0.52,         // Nota de 0 a 1
    "quality_level": "Fair"        // Nível: Excellent, Good, Fair, Poor, Very Poor
  },
  "error": null
}
```

---

## Como Rodar no Servidor (VPS) com Docker

Para rodar esta aplicação em um servidor (DigitalOcean, AWS, etc.), recomenda-se usar **Docker**.

### 1. Instalar Docker
Se o servidor ainda não tiver o Docker instalado:
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install docker.io
```

### 2. Construir a Imagem (Build)
Navegue até a pasta `backend` onde está o `Dockerfile` e rode:

```bash
docker build -t rppg-backend .
```

### 3. Rodar o Container
Inicie o servidor na porta 8000:

```bash
docker run -d -p 8000:8000 --name rppg-api rppg-backend
```

- `-d`: Roda em segundo plano (detached).
- `-p 8000:8000`: Mapeia a porta 8000 do servidor para a porta 8000 do container.
- `--name`: Dá um nome ao container para facilitar o gerenciamento.

### 4. Verificar Logs
Para ver se está tudo rodando ou debugar erros:

```bash
docker logs -f rppg-api
```

### 5. Parar o Servidor
```bash
docker stop rppg-api
docker rm rppg-api
```

---

## Guia: Do GitHub para a VPS

Aqui está o fluxo recomendado para levar seu código do computador local para o servidor:

### 1. Preparar o Repositório (Local)
Na pasta raiz do projeto (`rppg_web_app`), inicie o git e suba para o GitHub:

```bash
# Iniciar repositório
git init
git add .
git commit -m "Versão inicial com backend e frontend"

# Criar repositório no site do GitHub e depois conectar:
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git push -u origin main
```

### 2. No Servidor VPS (Ex: DigitalOcean, AWS)
Acesse seu servidor via SSH e clone o projeto:

```bash
# 1. Clonar o repositório
git clone https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
cd SEU_REPOSITORIO/backend

# 2. Construir a imagem Docker (Isso pode levar alguns minutos)
docker build -t rppg-backend .

# 3. Rodar o container (em background)
docker run -d -p 8000:8000 --restart always --name rppg-api rppg-backend
```

### 3. Atualizando a Aplicação
Quando você fizer alterações no código e subir para o GitHub, para atualizar no servidor:

```bash
# No servidor, dentro da pasta do projeto:
git pull origin main
docker stop rppg-api
docker rm rppg-api
docker build -t rppg-backend .
docker run -d -p 8000:8000 --restart always --name rppg-api rppg-backend
```

---

## Opção Alternativa: DigitalOcean App Platform (Mais Fácil)

Se você estiver vendo uma tela pedindo "Repository" e "Image tag" (como na sua imagem), você está no **App Platform**.

Para usar o código do GitHub direto lá:

1.  No topo da tela da DigitalOcean, clique na aba **Git repository** (ao invés de Container image).
2.  Conecte sua conta do GitHub.
3.  Selecione o repositório `rppg_web_app`.
4.  A DigitalOcean vai detectar o `Dockerfile` na pasta `backend` automaticamente.
5.  Clique em **Next** e **Create Resource**.

Isso fará o deploy automático toda vez que você der `git push` no GitHub.

---

## Opção Alternativa: Portainer (Stacks)

Se você usa o **Portainer** para gerenciar seus containers, o processo é muito simples usando "Stacks".

1.  Acesse seu Portainer.
2.  Vá em **Stacks** > **Add stack**.
3.  Dê um nome, por exemplo: `rppg-backend`.
4.  Escolha a opção **Repository**.
5.  Em **Repository URL**, coloque o link do seu GitHub: `https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git`
6.  Em **Compose path**, coloque: `backend/docker-compose.yml` (Importante: indique a pasta `backend`).
7.  Clique em **Deploy the stack**.

O Portainer vai baixar o código, ler o arquivo `docker-compose.yml` que eu criei na pasta, construir a imagem e rodar o serviço na porta 8000.
