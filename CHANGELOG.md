# Changelog

Todas as mudanças relevantes do **Íris** são registradas neste arquivo.

## 1.0.0 (2026-08-28)

Primeira versão do Íris. O projeto nasce a partir da extensão de código aberto
[head-tracking-chrome-extension](https://github.com/thshao2/head-tracking-chrome-extension)
(MIT, de Timothy Shao / UCSC Computer Vision Lab), usada como base, com uma
reescrita ampla da arquitetura e do fluxo de uso.

### Funcionalidades
- **Rastreamento de cabeça:** cursor virtual controlado por movimentos da cabeça,
  usando o MediaPipe FaceLandmarker (visão computacional executada localmente).
- **Calibração integrada:** fluxo próprio dentro da extensão (aba dedicada de
  9 pontos), sem depender de site externo nem de arquivo `.csv`.
- **Cliques por gesto facial:** gestos configuráveis para clique, clique duplo e
  clique direito (sorrir, levantar/abaixar sobrancelhas, abrir a boca, etc.).
- **Clique por pausa (dwell):** clica após manter o cursor parado numa pequena
  área, com anel de progresso visual.
- **Assistência de clique:** trava o cursor no elemento interativo durante o gesto.
- **Rolagem sem as mãos:** leve o cursor à borda superior/inferior da página.
- **Configurações persistentes:** suavização, estilo do cursor e todos os gestos,
  salvos automaticamente.
- **Atalhos de teclado:** ativar a extensão e iniciar/parar o rastreamento.
- Interface e calibração em português.

### Robustez
- O pipeline de câmera sobrevive ao encerramento do service worker do MV3: o
  documento offscreen reconecta a porta sozinho e o `boot.js` declarativo
  garante que o rastreamento seja retomado em qualquer navegação (incluindo
  pré-renderização e restauração de bfcache).
- Encerramento limpo ao parar o rastreamento — sem documento offscreen órfão.

### Removido em relação ao projeto-base
- Barra de abas customizada e teclado virtual na tela.
- Importação de calibração via CSV / site externo.
