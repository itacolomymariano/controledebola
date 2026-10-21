# Texto para WhatsApp — vistoria UX (item 2.1, Xaiana)

Copie o bloco abaixo (sem o título) para enviar no WhatsApp.

---

Oi, Xaiana!

Implementamos a vistoria de UX que você pediu no item 2.1: menos verbosidade, campos e textos mais claros, pontuação revisada e fluxos mais fáceis no dia a dia.

*O que mudou no app*

• *Entrar / senha:* em “Esqueci minha senha” ficou explícito que não é link — enviamos um *código de 6 dígitos* e você digita *no próprio app*. Depois de enviar, aparece um card com seu e-mail mascarado e o passo a passo na mesma tela.

• *Cadastro e montagem de perfil:* subtítulos e dicas mais curtos (apelido, CPF, intro do atleta).

• *Home e navegação:* ao entrar você cai na *Home* com as 4 portas (Peladas, Confrontos, Times, Usuários). O ícone *casa* no topo sempre volta para essa Home. A aba *Peladas* no rodapé abre direto a *lista* de peladas — o rodapé só destaca a aba quando você está de fato nela (sem “confundir” a tela).

• *Evento (organizador):* inscritos *confirmados* aparecem em card compacto (foto, apelido, perfil, posição, idade, média CB); chegada, ingresso e time ficam logo abaixo.

• *Votação no evento:* texto único no painel; cada pessoa pode dar no *máximo 2 notas 10* por evento, com contador na tela.

• *Mural do app:* aviso de *confiança* no ranking; no Craque, quando houver votos, mostra *quantas pessoas avaliaram* (precisa do backend mural atualizado no servidor).

• *Ajuda (?):* na pelada (e onde já existia o padrão) o balão tem *Ouvir* para o app ler o texto em voz alta.

*O que isso traz*

Menos leitura, menos erro na senha e na votação, lista de participantes mais rápida para quem organiza, e rankings mais transparentes.

*Como testar (5 min)*

Use o app na versão recente (ex. build 2026.10.20.0267 ou TestFlight 1.0.7+):

1. Login → Home: nenhuma aba do rodapé destacada; toque Peladas → lista com Peladas destacada; casa volta à Home.
2. Login → Esqueci senha → enviar código → ver card com e-mail mascarado.
3. Evento (admin) → Participantes → confirmado compacto.
4. Evento encerrado → votação → ver contador de notas 10.
5. Aba Mural → Geral → hint de confiança e craque com “X pessoas avaliaram”.
6. Pelada → ? → Ouvir.

Se algo ainda parecer longo ou confuso (caixa de entrada, detalhe da pelada), manda print ou áudio — temos backlog para a próxima rodada.

Beijo! Qualquer feedback ajuda muito.
