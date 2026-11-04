# Guia de gravação dos sinais (intérprete-modelo)

Os vídeos gravados pela intérprete são convertidos em animações 3D da Teté pelo
**Estúdio de captura** (`captura.html`). Quanto melhor o vídeo, mais fiel e
fluido o sinal da Teté.

## Antes de começar

- [ ] **Termo de autorização de uso de imagem** assinado pela modelo, cobrindo a
      personagem 3D baseada na aparência dela e os vídeos (LGPD).
- [ ] Revisão dos sinais por uma pessoa surda ou intérprete certificada
      (variações regionais: defina a variante usada, ex.: São Paulo).

## Montagem

| Item | Recomendação |
|---|---|
| Câmera | celular na horizontal ou vertical, **fixo num tripé**, na altura do peito |
| Distância | ~1,5 m. Enquadre da cintura até um palmo acima da cabeça, com os cotovelos sempre dentro do quadro |
| Luz | de frente e difusa (janela ou ring light), sem sombras fortes nas mãos |
| Fundo | liso, contrastando com a pele (cinza, azul ou verde) |
| Roupa | lisa, sem estampas e com cor diferente da pele (a blusa terracota da referência é ótima) |
| Acessórios | evitar pulseiras e relógios grandes. Óculos podem ficar |
| Vídeo | 30 fps ou mais, 720p ou 1080p |

## Como gravar cada sinal

1. Comece com as mãos em **repouso** (braços relaxados ao lado do corpo), olhando para a câmera.
2. Faça o sinal em **velocidade natural**, com a **expressão facial** correspondente (ela também é capturada).
3. Volte ao repouso e espere ~1 segundo.
4. **Um sinal por vídeo.** Nomeie o arquivo com a glosa: `OBRIGADO.mp4`, `BOM-DIA.mp4`.
5. Se uma mão esconder a outra por muito tempo, grave de novo com um leve ângulo (~15°).

## Ordem sugerida

1. **Alfabeto manual** (`LETRA-A` … `LETRA-Z`, `LETRA-Ç`). Substitui o alfabeto gerado por código, usado sempre que a Teté soletra.
2. **Números** de 0 a 10.
3. **Saudações e cortesia:** OI, TCHAU, BOM-DIA, BOA-TARDE, BOA-NOITE, TUDO-BEM, OBRIGADO, DESCULPA, POR-FAVOR.
4. **Comunicação:** EU, VOCÊ, NOME, SURDO, OUVINTE, LIBRAS, ENTENDER, REPETIR, DEVAGAR, ESCREVER, ESPERAR.
5. **Perguntas:** ONDE, COMO, QUANTO, QUANDO, O-QUE, POR-QUE.
6. **Necessidades e emergência:** AJUDAR, BANHEIRO, ÁGUA, COMER, BEBER, DOR, MÉDICO, HOSPITAL, REMÉDIO, POLÍCIA.
7. As demais entradas de `dados/dicionario.json`.

## Processar no Estúdio

1. Abra `captura.html` → **Escolher vídeo**.
2. **Glosa**: o nome do arquivo (ex.: `OBRIGADO`). **Palavras**: as formas em português que devem ativar o sinal (`obrigado, obrigada, valeu`).
3. **Gerar animação 3D** e compare a Teté com o vídeo, lado a lado.
4. Se estiver bom: **Salvar neste aparelho** (teste no app) e **Baixar .json** (para publicar).
5. Publicar: copie o `.json` para `dados/sinais/` e adicione `"animacao": "dados/sinais/obrigado.json"` na entrada do dicionário.

## Problemas comuns

| Sintoma na Teté | Causa provável | Solução |
|---|---|---|
| Mão “tremendo” | pouca luz ou desfoque de movimento | mais luz, 60 fps |
| Dedos errados por alguns quadros | mão de perfil ou uma mão cobrindo a outra | gire o corpo uns 15° ou grave de novo |
| Braço “pula” | cotovelo saiu do quadro | afaste a câmera |
| Mão trocada (esquerda ↔ direita) | vídeo espelhado (câmera frontal) | grave com a câmera traseira ou desative o espelhamento |
