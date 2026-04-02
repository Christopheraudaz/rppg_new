# rPPG Standalone Package

Sistema simplificado de fotopletismografia remota (rPPG) para estimativa de frequência cardíaca a partir de vídeo.

## Características

- **Múltiplos métodos rPPG**: POS, CHROM, GREEN
- **Detecção facial**: MediaPipe ou Haar Cascade
- **Rastreamento dinâmico**: Redetecção periódica da face
- **Avaliação de qualidade do sinal**: Métricas opcionais de SNR e qualidade
- **Processamento em lote**: Eficiente em memória para vídeos longos

## Instalação
```bash
# Criar ambiente virtual
python3 -m venv venv
source venv/bin/activate  # No Windows: venv\Scripts\activate

# Instalar dependências
pip install -r requirements.txt

```

## Início Rápido
```bash
# Uso básico
python simple_rppg_processor.py --video video.mp4 --output resultados/

# Com verificação de qualidade
python simple_rppg_processor.py --video video.mp4 --output resultados/ --check-quality

# Usando método CHROM
python simple_rppg_processor.py --video video.mp4 --method CHROM --output resultados/

# Usar FPS real do vídeo
python simple_rppg_processor.py --video video.mp4 --use-video-fps --output resultados/
```


## Arquivo de Saída

### Arquivo HR (`*_HR.csv`)
Arquivo CSV contendo:
- `heart_rate_bpm`: Frequência cardíaca estimada
- `hr_std_bpm`: Desvio padrão entre chunks
- `num_chunks`: Número de segmentos de vídeo processados
- `fps_used`: FPS utilizado no processamento
- `method`: Método rPPG utilizado

### Arquivo BVP (`*_BVP.npy`)
Array NumPy contendo o sinal completo concatenado de volume de pulso sanguíneo (PPG).

Carregar com:
```python
import numpy as np
bvp = np.load('video_BVP.npy')
```

## Métodos

### POS (Plane-Orthogonal-to-Skin)
- **Método padrão**
- Mais robusto para iluminação variada
- Melhor para uso geral

### CHROM (Chrominance-based)
- Bom para ambientes controlados
- Mais sensível ao movimento

### GREEN
- Método mais simples
- Rápido mas menos preciso

## Resolução de Problemas

### "No face detected" (Nenhuma face detectada)
- Certifique-se de que o rosto está claramente visível
- Tente ajustar a iluminação
- Use `--no-mediapipe` para tentar Haar Cascade

### Estimativas de FC imprecisas
- Verifique o FPS do vídeo com `ffprobe`
- Tente métodos rPPG diferentes (`--method CHROM` ou `--method GREEN`)
- Garanta que o vídeo tenha pelo menos 15 segundos
- Use `--check-quality` para avaliar a qualidade do sinal

### Erros de memória
- Processe vídeos mais curtos
- Reduza a resolução do vídeo antes do processamento

## Estrutura do Pacote
```
rppg_standalone/
├── README.md                          # Este arquivo
├── requirements.txt                   # Dependências Python
├── simple_rppg_processor.py          # Processador principal
├── unsupervised_methods/             # Métodos rPPG validados
│   ├── __init__.py
│   ├── utils.py
│   └── methods/
│       ├── __init__.py
│       ├── POS_WANG.py               # Método POS
│       ├── CHROME_DEHAAN.py          # Método CHROM
│       └── GREEN.py                  # Método GREEN
└── dataset/                          # Recursos de detecção facial
    └── haarcascade_frontalface_default.xml
```

## Parâmetros da Linha de Comandos
```bash
python simple_rppg_processor.py [opções]

Opções obrigatórias:
  --video PATH              Caminho para o arquivo de vídeo

Opções de processamento:
  --output PATH             Diretório para salvar os resultados
  --method {POS,CHROM,GREEN}  Método rPPG (padrão: POS)
  --fps N                   FPS alvo para processamento (padrão: 30)
  --use-video-fps           Usar FPS real do vídeo

Opções de detecção facial:
  --no-mediapipe            Usar Haar Cascade em vez de MediaPipe

Opções de qualidade:
  --check-quality           Verificar e reportar métricas de qualidade do sinal
```


## Detalhes Técnicos

### Processamento de Vídeo
1. **Carregamento**: Vídeo é lido frame a frame (eficiente em memória)
2. **Detecção Facial**: MediaPipe ou Haar Cascade detecta e rastreia a face
3. **Pré-processamento**: Face é cortada e redimensionada para 128x128
4. **Segmentação**: Vídeo dividido em chunks de 180 frames (6 segundos a 30fps)
5. **Extração BVP**: Método rPPG aplicado a cada chunk
6. **Estimativa FC**: FFT usado para encontrar frequência cardíaca
7. **Agregação**: FC médio calculado entre todos os chunks

### Métodos rPPG

#### POS (Wang et al., 2017)
- Projeta sinais RGB num plano ortogonal ao tom de pele
- Robusto a variações de iluminação
- Janela deslizante de 1.6 segundos
- Detrending com matriz esparsa (λ=100)
- Filtro passa-banda: 0.75-3 Hz (45-180 bpm)

#### CHROM (De Haan & Jeanne, 2013)
- Baseado em crominância
- Combina canais RGB com pesos específicos
- Normalização por janela
- Bom para ambientes controlados

#### GREEN (Verkruysse et al., 2008)
- Usa apenas canal verde
- Método mais simples e rápido
- Menos robusto mas computacionalmente eficiente

### Estimativa de Frequência Cardíaca
- **Método**: Análise FFT (Fast Fourier Transform)
- **Gama**: 40-180 bpm (0.67-3 Hz)
- **Janela**: 6 segundos por chunk
- **Agregação**: Média entre todos os chunks

## Limitações Conhecidas

1. **Movimento**: Movimento excessivo da cabeça pode causar erros
2. **Iluminação**: Luz muito fraca ou muito forte afeta a precisão
3. **Tom de Pele**: Alguns tons de pele podem ter sinal mais fraco
4. **Duração**: Vídeos muito curtos (<15s) podem ser imprecisos
5. **FPS**: Vídeos com FPS incorreto nos metadados causam erros
