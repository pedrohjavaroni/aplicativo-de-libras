# Ponte Libras 🤟

Aplicativo de ajuda à comunicação entre pessoas **surdas** e **ouvintes que não sabem Libras**.

- **Voz → Libras**: a pessoa ouvinte fala, o app transcreve (pt-BR) e a **Lia**, uma intérprete 3D, sinaliza em Libras.
- **Libras → Voz**: a pessoa surda sinaliza para a câmera, o app reconhece os sinais e fala em voz alta.
- **Frases rápidas**: botões que falam frases úteis na hora (“Pode repetir?”, “Preciso de um médico”…).

Funciona no navegador do celular (Android/iPhone) e pode ser instalado como app (PWA). Não precisa de servidor: o vídeo da câmera é processado **no próprio aparelho**.

## A personagem: Lia

A Lia é um avatar **3D** baseado na modelo da foto de referência (`assets/modelo/referencia.png`): cabelo castanho cacheado e volumoso, óculos redondos de aro dourado, blusa gola alta terracota sem manga, jeans claro, a tatuagem de livro com borboletas no antebraço esquerdo e a aliança.

Ela é 3D porque a Libras depende de detalhes que só um esqueleto completo reproduz:

| Parâmetro da Libras | Como a Lia reproduz |
|---|---|
| Configuração de mão | 3 falanges articuladas em cada um dos 5 dedos |
| Orientação da palma | rotação completa do punho |
| Ponto de articulação e movimento | braços com IK (cinemática inversa) e animação por quadros-chave |
| Expressões não manuais | sobrancelhas, boca, olhos e inclinação de cabeça/tronco |

**Fluidez:** cada animação define um *alvo* de rotação por osso, e a pose exibida segue esse alvo com interpolação esférica (slerp) amortecida. Isso dá transições suaves entre letras e sinais (coarticulação), em qualquer taxa de quadros. Há também respiração, piscadas e micromovimentos de olhar e de cabeça.

Os ossos usam os nomes do padrão **VRM Humanoid** (`leftUpperArm`, `rightIndexProximal`…). Assim, um modelo profissional da Lia (feito no VRoid Studio ou no Blender a partir da foto) pode substituir o modelo atual, gerado por código, **sem refazer nenhuma animação**.

## Como os sinais da Lia são feitos: vídeos da intérprete → 3D

A modelo grava os sinais em vídeo e o **Estúdio de captura** (`captura.html`) converte cada vídeo em animação 3D:

```
vídeo da intérprete ──► MediaPipe (pose + 21 pontos por mão + expressões do rosto)
                    ──► retargeting para o esqueleto da Lia (quatérnios por osso)
                    ──► suavização ──► animação .json ──► a Lia sinaliza
```

1. Abra `captura.html`, escolha um vídeo (ou grave na hora) e informe a glosa (ex.: `OBRIGADO`) e as palavras em português.
2. Clique em **Gerar animação 3D**. Confira a Lia lado a lado com o vídeo.
3. **Salvar neste aparelho** → a Lia passa a usar o sinal no app na hora.
4. Para publicar para todos: **Baixar .json**, colocar em `dados/sinais/` e adicionar `"animacao": "dados/sinais/<id>.json"` à entrada em `dados/dicionario.json`.

O guia completo de gravação está em [`docs/GUIA-GRAVACAO.md`](docs/GUIA-GRAVACAO.md).

Enquanto um sinal não é capturado, a Lia **soletra** a palavra no alfabeto manual (datilologia). O alfabeto inicial é gerado por código e **precisa ser validado pela intérprete**; letras capturadas (`LETRA-A`, `LETRA-B`…) substituem as geradas automaticamente.

## Reconhecimento de Libras (Libras → Voz)

- O MediaPipe detecta as duas mãos (21 pontos 3D cada) e os ombros (local do sinal).
- Uma janela de ~1,2 s é reamostrada em 8 passos, o que captura o **movimento** e não só a forma da mão.
- Um classificador k-NN compara essa janela com exemplos gravados na aba **Treinar** (5–10 por sinal). Os exemplos podem ser exportados e importados em `.json` para compartilhar entre aparelhos.

## Executar

Câmera e microfone exigem **HTTPS** ou `localhost`.

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

Para testar no celular, publique no GitHub Pages (Settings → Pages → branch) ou use um túnel HTTPS.

Navegadores: Chrome/Edge (Android, desktop) e Safari (iOS 16+). O reconhecimento de voz usa a Web Speech API, que **não existe no Firefox**. Nele, é possível digitar o texto.

## Estrutura

```
index.html              app principal (Início, Voz→Libras, Libras→Voz, Treinar)
captura.html            estúdio: vídeo da intérprete → animação 3D
css/style.css
js/app.js               interface e fluxo das telas
js/captura.js           estúdio de captura
js/config.js            endereços do MediaPipe (CDN ou local)
js/avatar3d/
  rig.js                esqueleto (padrão VRM) + modelo 3D da Lia
  pose.js               IK de braço, orientação da mão, configurações de mão
  solver.js             gestos, alfabeto manual, sinais procedurais
  avatar.js             renderização (Three.js) e player com suavização
  retarget.js           landmarks do MediaPipe → rotações dos ossos
js/libras/
  glosa.js              português → glosas de Libras
  sinais.js             dicionário + animações capturadas
  fala.js               síntese e reconhecimento de voz (pt-BR)
  reconhecedor.js       reconhecimento de sinais pela câmera (k-NN)
dados/dicionario.json   palavras → sinais
dados/sinais/           animações capturadas (.json)
assets/modelo/          foto de referência da personagem
```

## Limitações e próximos passos

- **Validação com a comunidade surda é obrigatória.** Sinais, alfabeto e frases devem ser revisados por intérpretes e por pessoas surdas antes do uso real.
- **Tradução simplificada:** a conversão português → glosa usa dicionário e regras (remove artigos e preposições e usa os verbos no infinitivo). A Libras tem gramática própria. Uma evolução é usar um modelo de linguagem num servidor para gerar glosas mais naturais.
- **Vocabulário:** o app começa com cerca de 60 entradas no dicionário. Os sinais só ficam corretos depois de capturados dos vídeos da intérprete.
- **Reconhecimento:** o k-NN funciona bem para algumas dezenas de sinais treinados pelo próprio usuário. Para um vocabulário grande e independente de quem sinaliza, é preciso um conjunto de dados maior e um modelo sequencial (ex.: GRU/Transformer sobre os landmarks).
- **Modelo 3D:** trocar o modelo gerado por código por um `.vrm` profissional da Lia com *blendshapes* faciais (ARKit) para expressões mais ricas.
- **Direitos de imagem:** use a aparência da modelo (personagem e vídeos) somente com um **termo de autorização de uso de imagem** assinado. Imagem e voz são dados pessoais pela LGPD.
