# Insta Unfollow

Interface em tela cheia que abre por cima do Instagram, no navegador do computador. Você vê todas as contas que segue em cartões, clica em quem vai sair e manda remover em lote, com pausas automáticas.

- Roda só no seu navegador, usando o login que já está aberto. Não pede nem guarda senha.
- Nada é instalado. O que você marcou, quem já saiu e a contagem do dia ficam salvos no próprio navegador, então dá para fechar e continuar outro dia.
- Quer ver antes de usar? Abra a demonstração com contas fictícias: https://claude.ai/artifact/L5ckZAz98uJ2joLTyf6E8T

## Como usar

1. No computador (Chrome, Edge, Firefox ou Brave), abra **https://www.instagram.com** e confira que está logado.
2. Abra o arquivo `insta-unfollow.js`, selecione tudo e copie.
3. Na aba do Instagram, aperte **F12** (no Mac: `Cmd + Option + J`) e vá na aba **Console**.
4. Cole e aperte **Enter**.
   - O Chrome pode avisar que não deixa colar. Digite `allow pasting` (ou `permitir colar`), Enter, e cole de novo.
5. A tela do Insta Unfollow abre. Clique em **Carregar quem eu sigo**.
6. Clique no filtro **Não te seguem** (ele pede para carregar seus seguidores na primeira vez).
7. Escolha quem sai:
   - clique no cartão para marcar (fica vermelho e riscado); clique de novo para manter;
   - **Shift + clique** marca todo o intervalo entre dois cartões;
   - **Marcar todas** marca tudo o que está no filtro ou na busca atual;
   - **Marcar por lista** aceita vários @ ou links de perfil colados;
   - o ícone no canto do cartão abre o perfil em outra aba, para conferir.
8. Guarde no **cofre** quem você não quer perder (veja abaixo).
9. Confira a **Fila de remoção** à direita (o × tira alguém da fila) e clique em **Começar a remover**. Deixe a aba aberta. O círculo mostra a contagem até a próxima, e **Pausar** para quando quiser.

Para testar sem remover ninguém, ligue **Modo teste** na engrenagem (Ritmo e limites). O botão `–` esconde a tela; o botão azul no canto traz de volta. Se recarregar a página, é só colar o script de novo: a seleção continua lá.

**Exportar CSV** baixa uma planilha com todas as contas que você segue, dizendo se é pessoa ou página, se está no cofre, quem te segue de volta, quem está marcado e quem já foi removido.

## Pessoas ou páginas

Cada cartão tem uma etiqueta **pessoa** ou **página** (empresas, marcas, lojas, perfis de memes, notícias etc.). Os filtros **Pessoas**, **Páginas** e **Sem certeza** separam as duas coisas.

- A etiqueta começa como um **palpite** pelo @ e pelo nome (por exemplo "loja", "oficial", "cafe", "_br", ou um nome de pessoa como "Ana Souza"). O palpite erra às vezes.
- **Conferir tipo** pergunta ao Instagram, conta por conta, se o perfil é uma conta comercial, e mostra a categoria (ex.: "Loja de roupas"). Faz uma consulta a cada 3 a 5 segundos, então 300 contas levam uns 20 minutos. Use num filtro (ex.: "Sem certeza" ou "Pessoas") em vez de todas de uma vez. Criadores de conteúdo que não são conta comercial aparecem como pessoa.
- Clique na etiqueta para corrigir na mão. A sua correção sempre vence.

## Cofre

O cofre guarda as contas que você quer manter. Conta no cofre **nunca entra na fila de remoção**, nem quando você usa "Marcar todas" para tirar todo mundo.

- Clique no **escudo** no canto de um cartão para guardar ou tirar do cofre. O cartão fica verde.
- **Guardar no cofre** guarda todas as contas do filtro atual (por exemplo, filtre **Pessoas** e guarde todas de uma vez).
- O botão **Cofre** no topo mostra a lista, com link para cada perfil. Contas que você deixou de seguir por outro caminho continuam lá, marcadas como "você não segue mais", para você poder seguir de novo.
- Para **tirar do cofre** várias de uma vez: num filtro (ex.: **No cofre** com uma busca, ou **Páginas**) use **Tirar do cofre**; dentro do botão **Cofre**, busque e use **Tirar estas contas do cofre**, ou **Esvaziar cofre** (pede um segundo clique para confirmar). Uma por uma: o escudo no cartão ou o × na lista.
- **Baixe uma cópia** (arquivo .json) de vez em quando. O cofre fica salvo no navegador, e limpar os dados do navegador ou trocar de computador apaga essa memória. **Importar cópia** traz o cofre de volta. Também aceita um .txt com um @ por linha.

Um jeito de "excluir todo mundo e manter só os amigos": filtro **Pessoas** → confira a lista → **Guardar no cofre** → filtro **Todos** → **Marcar todas** → **Começar a remover**.

## Ritmo

Na engrenagem dá para escolher entre dois ritmos prontos ou definir os números:

| Ajuste | Cauteloso | Normal (padrão) |
|---|---|---|
| Espera entre um unfollow e outro | 60 a 120 s | 40 a 90 s |
| Pausa longa | 10 a 20 min a cada 8 | 5 a 10 min a cada 10 |
| Limite por dia | 60 | 150 |

No ritmo normal, 150 contas levam umas 3 horas. Se você tem 1.000 para remover, conte com uma semana. É devagar de propósito.

## Riscos (leia antes)

- **Automação vai contra os Termos de Uso do Instagram.** Ele pode bloquear a ação de deixar de seguir por algumas horas ou dias e, em casos repetidos, restringir a conta. Use por sua conta e risco.
- O Instagram não publica um limite oficial. Na prática, ficar abaixo de ~150 a 200 unfollows por dia, espaçados, costuma ser seguro. Contas novas ou que acabaram de trocar senha/aparelho têm limites menores. Comece com 50 a 100 nos primeiros dias.
- Se aparecer **"O Instagram bloqueou a ação temporariamente"** ou **"Muitas requisições"**, o painel para sozinho. Espere pelo menos 24 horas e reduza o limite diário antes de voltar.
- Não use outros apps de "unfollow" ao mesmo tempo, e evite seguir/deixar de seguir muita gente pelo celular no mesmo dia.
- Nunca cole no console códigos de outras pessoas que você não entende. Este é curto e legível. Ele só conversa com instagram.com.

## Problemas comuns

- **"Erro 404" em todos os unfollows**: era a rota antiga, que o Instagram desligou em outubro de 2026. A versão atual usa o mesmo pedido do botão do site. Cole o script novo e clique em **Atualizar lista** antes de remover.

- **"Não encontrei sua sessão"**: você não está logado nessa aba, ou abriu outro site. Entre em instagram.com e tente de novo.
- **"Sessão expirada"**: recarregue a página, faça login, cole o script de novo.
- **Lista para no meio**: o Instagram pediu calma. O painel espera e tenta de novo sozinho. Se falhar, espere alguns minutos e clique em "Carregar" outra vez.
- **Uma conta não sai** ("Não consegui remover… Pulando"): ela pode ter sido apagada ou já não ser seguida. As outras continuam.
- **O Instagram mudou o site e parou de funcionar**: ele muda a API interna de vez em quando. Avise aqui que eu ajusto.
