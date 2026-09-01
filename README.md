# Íris

**Íris** é uma extensão para o Google Chrome que permite controlar um cursor no
navegador usando **movimentos da cabeça** e **gestos faciais**, sem precisar das
mãos. Ela foi pensada para pessoas com mobilidade reduzida dos membros
superiores, como alternativa a mousesticks, ponteiros de cabeça e outros
dispositivos físicos.

Todo o processamento acontece **no seu computador**: a imagem da câmera é
analisada localmente e **nenhuma imagem ou dado da câmera é enviado para a
internet**.

> **Contexto acadêmico.** O Íris é o Trabalho de Conclusão de Curso de
> **Yago Oliveira**. Ele foi construído a partir da extensão de código aberto
> [head-tracking-chrome-extension](https://github.com/thshao2/head-tracking-chrome-extension)
> (licença MIT, de Timothy Shao, desenvolvida no
> [UCSC Computer Vision Lab](https://vision.soe.ucsc.edu/welcome-ucsc-computer-vision-lab)
> sob orientação do Prof. Roberto Manduchi), inspirada no artigo
> [_Towards Personalized Head-Tracking Pointing_](https://escholarship.org/content/qt26z6d0t4/qt26z6d0t4.pdf).
> O Íris reescreve boa parte da arquitetura e do fluxo de uso — em especial a
> calibração, agora totalmente integrada à extensão — e disponibiliza uma interface em português.

---

## Sumário

- [Requisitos](#requisitos)
- [Instalação](#instalação)
- [Primeiro uso](#primeiro-uso)
- [Como usar no dia a dia](#como-usar-no-dia-a-dia)
- [Configurações](#configurações)
- [Atalhos de teclado](#atalhos-de-teclado)
- [Como o Íris funciona por dentro](#como-o-íris-funciona-por-dentro)
- [Privacidade](#privacidade)
- [Limitações atuais](#limitações-atuais)
- [Desenvolvimento](#desenvolvimento)
- [Licença](#licença)

---

## Requisitos

- **Google Chrome** (ou navegador baseado em Chromium) atualizado.
- Uma **webcam** funcional.
- Ambiente com **iluminação razoável**, com o rosto visível para a câmera.
- Para gerar a extensão a partir do código: **Node.js 20+** e **npm**.

---

## Instalação

O Íris ainda não está publicado na Chrome Web Store. A instalação é feita em
**modo desenvolvedor**, a partir do código.

### 1. Gerar a build

Na pasta do projeto:

```bash
npm install
npm run build
```

Isso cria a pasta **`dist/`** com a extensão pronta.

### 2. Carregar no Chrome

1. Abra `chrome://extensions`.
2. Ative o **Modo do desenvolvedor** (canto superior direito).
3. Clique em **Carregar sem compactação**.
4. Selecione a pasta **`dist/`**.

   ⚠️ Selecione a pasta `dist/` em si. Apontar para a pasta pai causa erro de
   carregamento.

Sempre que o código mudar, rode `npm run build` de novo e clique em **Atualizar**
no card da extensão. Se você alterar o `manifest.json` (por exemplo, os
_content scripts_), **remova e carregue a extensão novamente** em vez de só
atualizar.

---

## Primeiro uso

Clique no ícone do Íris na barra do Chrome para abrir o **popup**. A tela de
configuração tem três passos:

### 1. Ativar a câmera

Clique em **Ativar Câmera**. Na primeira vez, o Chrome vai pedir permissão:

- Escolha **"Permitir ao visitar este site"**.
- **Não** escolha "Permitir apenas desta vez" — isso não concede acesso
  persistente e o rastreamento não vai funcionar depois.

Se a permissão estiver bloqueada, vá em `chrome://extensions` → **Detalhes** da
extensão → **Configurações do site** → **Câmera** → **Permitir**.

### 2. Executar a calibração

Clique em **Executar Calibração**. Uma aba em tela cheia se abre com **9 pontos**,
mostrados um de cada vez.

- Olhe diretamente para cada ponto por **3 segundos**, movendo a cabeça como se
  estivesse levando o cursor até ele.
- Mantenha o rosto **centralizado** na câmera durante todo o processo.

Ao final, o Íris calcula o seu perfil de movimento e **salva automaticamente** na
extensão. Você pode refazer isso quando quiser pelo botão **Recalibrar**.

### 3. Iniciar o rastreamento

Clique em **Iniciar Rastreamento**. O popup fecha e um cursor passa a aparecer
nas páginas web.

---

## Como usar no dia a dia

- **Mover o cursor:** mova a cabeça. O cursor acompanha o movimento de acordo com
  a sua calibração.
- **Elemento clicável:** o cursor fica **verde** quando está sobre um link, botão
  ou campo em que dá para clicar.
- **Clicar:** faça o **gesto facial** configurado (veja
  [Configurações](#configurações)) ou ative o **Clique por Pausa**.
- **Rolar a página:** leve o cursor até a **borda superior** (rola para cima) ou
  **borda inferior** (rola para baixo) e **segure** ali por cerca de 1 segundo. O
  movimento para assim que o cursor sai da borda.
- **Parar:** abra o popup e clique em **Parar Rastreamento** (ou use o atalho de
  teclado).

O cursor continua funcionando ao trocar de aba e ao navegar entre páginas.

---

## Configurações

Abra o popup **durante o rastreamento** para ajustar. Tudo é salvo
automaticamente e vale para todas as páginas.

| Configuração | O que faz |
|---|---|
| **Estilo do Cursor** | Alterna entre **Ponteiro** (seta) e **Disco** (círculo). |
| **Filtro de Suavização** (0,50–0,99) | Controla a estabilidade do cursor. Valores **menores** = resposta mais rápida e sensível. Valores **maiores** = movimento mais suave e estável (bom para tremores). |
| **Gesto de Clique** | Gesto facial que dispara um clique. Opções: sorrir, sorrir só para a esquerda, sorrir só para a direita, levantar sobrancelhas, abaixar sobrancelhas, abrir a boca, franzir os lábios, mostrar os dentes, olhar para a esquerda/direita/cima/baixo. |
| **Gesto de Clique Duplo** | Mesmo conjunto de gestos, para clique duplo. |
| **Gesto de Clique Direito** | Mesmo conjunto de gestos, para abrir o menu de contexto. |
| **Assistência de Clique** | Ao entrar em um elemento clicável, "trava" o cursor nele por um tempo, mesmo que a cabeça se mexa um pouco durante o gesto. Ajustável: **raio** (30–500 px) e **tempo limite** (0,1–10 s). |
| **Clique por Pausa** | Dispara um clique quando o cursor fica parado dentro de uma pequena área. Ajustável: **área** (3–100 px) e **tempo** (0,3–5 s). Um anel de progresso aparece depois de 20% do tempo. |

> ⚠️ Um mesmo gesto **não pode** ser usado em duas ações diferentes. Ao escolher
> um gesto já usado, o outro é liberado automaticamente.

**Dica:** escolha para clique um gesto que você **não faz sem querer** enquanto
usa o computador, para evitar cliques acidentais.

---

## Atalhos de teclado

Podem ser alterados em `chrome://extensions/shortcuts`.

| Ação | Padrão |
|---|---|
| Abrir o popup do Íris | <kbd>Alt</kbd> + <kbd>Q</kbd> |
| Iniciar / parar o rastreamento | <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>X</kbd> (no macOS, <kbd>Command</kbd> + <kbd>Shift</kbd> + <kbd>X</kbd>) |

Se você ainda não calibrou ou não deu permissão de câmera, o atalho de
iniciar/parar apenas abre o popup para você concluir a configuração.

---

## Como o Íris funciona por dentro

### Visão geral

1. Um **documento offscreen** (invisível) abre a câmera e roda o modelo
   [MediaPipe FaceLandmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker),
   que detecta ~478 pontos do rosto e dezenas de _blendshapes_ (medidas de
   expressão facial) a cada quadro, cerca de 60 vezes por segundo.
2. O **service worker** (script de fundo) recebe esses dados e os encaminha para
   a aba ativa.
3. Um **content script** em cada página converte a posição do rosto em uma
   posição de cursor, desenha o cursor e trata cliques e rolagem.
4. O **popup** em React é a interface de configuração e status.

### Da cabeça para o cursor

Durante a calibração, para cada um dos 9 pontos o Íris grava a posição média de
3 marcos do rosto (ponta do nariz e os cantos externos dos dois olhos) e a
posição conhecida do ponto na tela. Com esses pares, ele resolve por **mínimos
quadrados** uma **matriz de transformação** que mapeia "configuração do rosto" →
"posição na tela" (incluindo termos quadráticos, para capturar a não
linearidade do movimento).

Durante o uso, a cada quadro essa matriz é aplicada à posição atual do rosto, o
resultado é reescalado para o tamanho da janela e passa por uma **suavização
exponencial** (o "Filtro de Suavização") antes de mover o cursor.

### Cliques por gesto

Os _blendshapes_ do MediaPipe (por exemplo `mouthSmileLeft`, `browInnerUp`,
`jawOpen`) são combinados em uma pontuação por gesto. Quando a pontuação do gesto
configurado passa de um limiar, o Íris **sintetiza** os eventos de mouse
(`pointerdown`, `mousedown`, `mouseup`, `click`, etc.) sobre o elemento sob o
cursor, atravessando inclusive _shadow DOM_.

### Resiliência

Extensões Manifest V3 têm um _service worker_ que o Chrome **desliga quando fica
ocioso**. Para o rastreamento não "travar" ao navegar:

- O documento offscreen **reconecta sozinho** quando o service worker reinicia.
- Um _content script_ declarativo mínimo (`boot.js`) roda em **toda navegação**
  (inclusive páginas pré-renderizadas e restauradas do cache) e pede ao fundo
  para retomar o rastreamento.
- Ao parar, o Íris garante que a câmera e o documento offscreen sejam
  encerrados.

---

## Privacidade

- A câmera é usada **somente** enquanto o rastreamento (ou a calibração) está
  ativo.
- O vídeo é processado **localmente**, quadro a quadro. **Nada é gravado, salvo
  ou enviado** para nenhum servidor.
- O que fica salvo no seu navegador (`chrome.storage.local`) são apenas: o seu
  perfil de calibração (números da matriz) e as suas preferências.

---

## Limitações atuais

### Onde o cursor **não** funciona

- **Interface do Chrome:** o cursor não alcança a barra de abas, a barra de
  endereço, os botões de voltar/avançar, menus do navegador nem extensões.
- **Páginas internas:** `chrome://…`, `chrome-extension://…`, a Chrome Web Store,
  a página de nova aba e a tela de erro não aceitam extensões — nessas páginas o
  cursor não aparece. Ao iniciar o rastreamento numa aba dessas, o Íris abre uma
  nova aba comum.
- **Conteúdo especial:** PDFs abertos no visualizador do Chrome, o editor do
  Google Docs/Planilhas e páginas feitas inteiramente em `<canvas>` podem não
  responder ao cursor. A rolagem por borda também não funciona nesses casos.
- **Arquivos locais (`file://`):** só funcionam se você habilitar
  "Permitir acesso a URLs de arquivo" nos detalhes da extensão.

### Cliques sintéticos

Os cliques são **simulados** por software. Ações que o navegador só permite a
partir de um clique "real" do usuário **não** são acionadas pelo Íris, por
exemplo: abrir a janela de **seleção de arquivo** (`<input type="file">`), entrar
em **tela cheia**, acessar a **área de transferência** e responder a **pop-ups de
permissão** do navegador.

### Sobre precisão e uso

- Apontar com a cabeça é, com a tecnologia atual, **mais lento e menos preciso**
  que um mouse. Melhorar isso é justamente o objetivo do projeto.
- É necessário **rosto visível, centralizado e boa iluminação**. Contraluz,
  rosto muito de lado ou parcialmente fora do quadro degradam o rastreamento.
- O modelo acompanha **um rosto** por vez.
- Ao trocar de **monitor ou de resolução**, o Íris reescala a calibração pelas
  dimensões salvas, mas o resultado é aproximado — **recalibrar** é recomendado.
- O perfil de calibração **não sincroniza** entre computadores ou perfis do
  Chrome.
- O rastreamento usa **CPU/GPU de forma contínua** enquanto está ativo (câmera +
  inferência a ~60 fps).

### Navegação dentro de um site (SPA)

Sites que trocam de conteúdo sem recarregar a página (por exemplo, passar de um
vídeo para outro no YouTube) podem, em alguns casos, exigir um **recarregar**
para o cursor voltar a se comportar corretamente.

### Ainda não implementado

- **Comando de voz** (planejado como evolução).
- **Teclado virtual na tela** para digitação sem as mãos.
- Publicação na Chrome Web Store.

---

## Desenvolvimento

```bash
npm run dev      # ambiente de desenvolvimento (Vite + crxjs)
npm run build    # build de produção em dist/
npm run lint     # ESLint
```

### Estrutura

| Pasta | Papel |
|---|---|
| `src/offscreen/` | Documento offscreen — único ponto com acesso à câmera; roda o MediaPipe e transmite os marcos do rosto. |
| `src/background/` | Service worker — roteia os dados, injeta os content scripts, gerencia o ciclo de vida. |
| `src/content/` | Scripts injetados nas páginas: `boot.js` (bootstrap declarativo), `tracker.js` (núcleo), além de cursor, hover, rolagem e cliques. |
| `src/popup/` | Interface React — configuração, status e ajustes. |
| `src/calibration/` | Página de calibração de 9 pontos (aba dedicada). |
| `public/` | Recursos estáticos: CSS do cursor, modelo `.task` e binários WASM do MediaPipe. |

### Tecnologias

Vite, `@crxjs/vite-plugin`, React 19, `@mediapipe/tasks-vision`, `mathjs`.

---

## Licença

MIT — veja [LICENSE](LICENSE). O aviso de copyright do projeto que serviu de base
é mantido, conforme exige a licença MIT.
