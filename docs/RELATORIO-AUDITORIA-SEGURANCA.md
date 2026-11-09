# Relatório de Auditoria de Segurança e Privacidade

**Sistema:** Ficha Cadastral Digital – Igreja Evangélica Assembleia de Deus – Ministério do Belém – Setor 46
**Produção:** https://cadastro-setor46.pages.dev (Cloudflare Pages) · Supabase projeto `membrosadbelem` (região us-west-2)
**Data da auditoria:** 09/11/2026 · **Versão do código auditada:** commit `5093fcb` (correções em `1f79591`)

> Este relatório descreve testes efetivamente executados. Itens que não puderam ser testados estão marcados como **não verificável**. Nenhum sistema é "100% seguro": a aprovação abaixo vale para o escopo e a data desta auditoria.

---

## 1. Escopo e método

| Camada | O que foi analisado | Como |
|---|---|---|
| Código | Frontend (formulário, painel), Pages Functions, SQL, scripts | Revisão manual linha a linha + buscas dirigidas (XSS, segredos, logs) |
| Banco (Supabase) | Tabelas, RLS, GRANTs, funções `SECURITY DEFINER`, gatilhos, Storage | Consultas de catálogo em produção (somente leitura) + testes com papéis `anon`/`authenticated` |
| API pública do Supabase | REST, RPC, GraphQL, Storage, Auth | Requisições externas com a chave pública, como faria um atacante |
| Cloudflare | Cabeçalhos, CSP, CORS, arquivos expostos, cache, 404 | Requisições HTTP à produção |
| Fluxos | Login, sessão, logout, recuperação, upload, exclusão | 59 testes automatizados em **homologação local** (Supabase local + Pages local, dados fictícios) |
| Dependências | npm (produção e desenvolvimento) | `npm audit` |
| LGPD | Avisos, consentimento, direitos, retenção, fornecedores, incidentes | Análise documental + questionário à instituição |

**Regras seguidas:** nenhum dado real foi lido, alterado ou excluído (produção tinha 0 cadastros); nenhum teste de carga/indisponibilidade; testes destrutivos apenas em homologação.

---

## 2. Resumo executivo

- **Nenhum acesso público aos dados foi encontrado.** Sem login, a API do Supabase recusa leitura, escrita, alteração e exclusão em todas as tabelas, todas as funções administrativas e o bucket de fotos.
- **1 vulnerabilidade alta foi encontrada e corrigida:** o login não tinha proteção efetiva contra força bruta (40 tentativas seguidas sem bloqueio). Agora há CAPTCHA (Turnstile) obrigatório no login e na recuperação de senha.
- **1 vulnerabilidade média de privacidade foi confirmada e corrigida:** erros do banco podiam gravar a linha inteira do cadastro (CPF, nome, endereço) nos logs do servidor.
- Outras 9 falhas de severidade média, baixa ou informativa foram corrigidas, e todas têm testes automatizados.
- **Pendências relevantes:**
  - troca da senha do administrador, que foi exposta em captura de tela;
  - decisão sobre a região do banco (EUA → São Paulo);
  - MFA para administradores;
  - backups;
  - respostas institucionais do questionário LGPD.

**Situação técnica:** *aprovação condicionada* (seção 9). **Situação legal:** *não aprovada*, pois depende do questionário (seção 10).

---

## 3. Vulnerabilidades encontradas

Gravidade segundo CVSS 3.1 (estimado) e categoria OWASP Top 10 2021.

| ID | Vulnerabilidade | Local | Gravidade | Evidência | Risco | Correção | Situação |
|---|---|---|---|---|---|---|---|
| V01 | Sem proteção efetiva contra força bruta no login (A07 – Identification and Authentication Failures; CWE-307) | Supabase Auth `/auth/v1/token` | **Alta** (CVSS ≈ 7.4) | 40 tentativas seguidas de senha em produção: todas `400`, nenhuma `429` | Adivinhar a senha de um administrador e acessar todos os cadastros | CAPTCHA Turnstile obrigatório no login, recuperação e troca de senha; senha com letras e números; mínimo de 10 caracteres | **Corrigida** – após a correção: `captcha_failed: no captcha_token found` |
| V02 | Dados pessoais em logs do servidor (A09; CWE-532) | `functions/_lib/supabase.js` (`lerErro`) | **Média** (CVSS ≈ 5.3) | Em homologação, o log registrou `Failing row contains (… 😀😀, 1990-01-01 …)`, ou seja, a linha inteira do cadastro | Exposição de CPF, RG e endereço a quem acessar os logs da Cloudflare | Os logs passam a registrar apenas o status HTTP e o código técnico do erro | **Corrigida** – teste unitário garante que nem CPF nem nome chegam ao log |
| V03 | Divergência de validação: o JavaScript conta caracteres em UTF-16 e o banco em pontos de código (A04; CWE-1289) | `src/shared/campos.js` | Baixa | Nome `😀😀` passava no formulário e gerava erro 500 no banco (gatilho da V02) | Erro 500 e dados nos logs | Contagem por ponto de código e exigência de letras/números | **Corrigida** – agora retorna 422 (teste) |
| V04 | Limite de tamanho baseado só no cabeçalho `Content-Length` (A05; CWE-400) | `functions/api/submit.js` | Média | Corpo enviado em pedaços (*chunked*) não tinha limite real | Consumo de memória e CPU da função | Leitura em fluxo com corte em 4 MB | **Corrigida** – 6 MB *chunked* retorna 413 (teste) |
| V05 | JPEG "poliglota" (HTML/ZIP anexado após a imagem) era armazenado (CWE-434) | `functions/_lib/jpeg.js` | Baixa | Bytes após o marcador de fim (FFD9) eram copiados | Usar o armazenamento para hospedar conteúdo malicioso | Corte no marcador EOI; metadados EXIF/GPS já eram removidos | **Corrigida** – teste confirma ausência de `<script>` |
| V06 | Sem limite de resolução da foto (bomba de descompressão) | `functions/api/submit.js` | Baixa | JPEG de 3000×4000 era aceito | Travar o navegador de quem abre a ficha | Limite de 2400×3200 | **Corrigida** – teste retorna 400 |
| V07 | Token Turnstile sem conferência de domínio | `functions/api/submit.js` | Baixa | O `hostname` da resposta não era verificado | Reaproveitar token emitido em outro contexto | Exige `hostname` igual ao do site | **Corrigida** |
| V08 | CORS `*` nas respostas da API (inserido pela plataforma) (A05) | Cloudflare Pages `/api/*` | Baixa | `access-control-allow-origin: *` em `/api/form-config` | Outros sites lendo as respostas da API (dados públicos; o `submit` já exigia mesma origem) | Cabeçalhos próprios nas respostas da API | **Corrigida** – produção sem o cabeçalho |
| V09 | CSP ampla: qualquer `*.supabase.co`, `wss` e `127.0.0.1` | `public/_headers` | Baixa | Cabeçalho em produção | Em caso de XSS, enviar dados a outro projeto Supabase | Plugin de build grava só a origem exata do projeto | **Corrigida** – `connect-src 'self' https://obgacofeeusrawracbtx.supabase.co https://viacep.com.br` |
| V10 | Falso 404 (rotas inexistentes respondiam 200) | Cloudflare Pages | Informativa | `/nao-existe` retornava 200 | Confunde scanners e monitoramento | `public/404.html` | **Corrigida** – retorna 404 |
| V11 | `Referrer-Policy` duplicado no painel | `public/_headers` | Informativa | Dois cabeçalhos em `/admin/` | Comportamento ambíguo | Cabeçalho único `no-referrer` | **Corrigida** |
| V12 | Token de acesso (JWT) continua válido até expirar mesmo após o logout | Supabase Auth | Baixa | Comportamento padrão de JWT sem estado | Token roubado é usável por até 60 min | Validade reduzida para 30 min; logout revoga o *refresh token* (teste) | **Mitigada** |
| V13 | Sem autenticação em dois fatores (MFA) para administradores | Painel / Supabase Auth | Média | TOTP disponível no projeto, mas não usado | Senha vazada dá acesso total | Implementar TOTP com exigência de AAL2 no RLS | **Pendente** (recomendada) |
| V14 | Senha do administrador exposta em captura de tela na conversa de suporte | Conta `membrosadbelem@gmail.com` | **Alta** (credencial comprometida) | A senha aparece legível na imagem enviada | Acesso total ao painel | **Trocar a senha imediatamente** (Configurações → Minha senha) | **Pendente – ação do responsável** |
| V15 | Tokens de API de administração da conta (Supabase PAT e Cloudflare) com acesso amplo, salvos no ambiente de nuvem do assistente | Ambiente `cadastro-membros` (Claude) | Média | Necessários para a implantação | Quem controlar esse ambiente administra a conta | Revogar os tokens ao fim do trabalho, ou manter só pelo tempo necessário | **Pendente – ação do responsável** |
| V16 | Backups sem rotina verificada nem teste de restauração | Supabase (plano Free) | Média | Não há backup baixado nem restauração testada | Perda definitiva de dados em incidente | Rotina de exportação (seção 8) e/ou plano Pro com PITR | **Pendente / não verificável** |
| V17 | Transferência internacional: banco nos EUA (us-west-2) | Projeto Supabase | Média (legal, LGPD art. 33) | `region: us-west-2` | Exigência legal adicional; maior distância jurisdicional | Migrar para `sa-east-1` (São Paulo) **agora, com 0 cadastros**, ou formalizar a base do art. 33 | **Pendente – decisão** (já informada na Política) |
| V18 | Todo administrador vê todas as congregações | RLS de `cadastros` | Baixa (princípio da necessidade, art. 6º, III) | Não há escopo por congregação | Acesso maior que o necessário | Papel por congregação (requer alteração de banco) | **Pendente – decisão** |
| V19 | Consentimento de menores sem identificar o responsável | Formulário e tabela `cadastros` | Média (art. 14, §5º) | Só existe uma caixa de seleção | Dificuldade de comprovar quem consentiu | Texto corrigido; SQL proposto para registrar nome e parentesco do responsável (`docs/sql/PROPOSTA-001`) | **Parcial – SQL aguardando autorização** |
| V20 | Sem Política de Privacidade completa | Site público | Média (art. 9º) | Só havia o aviso resumido | Informação insuficiente ao titular | `privacidade.html`, com direitos, fornecedores, transferência internacional e versão | **Corrigida** (itens institucionais pendentes) |
| V21 | Chaves de produção em arquivo temporário da sessão de suporte | Pasta temporária do assistente | Baixa | Usadas na implantação | Vazamento se o ambiente fosse comprometido | Arquivos apagados ao fim da auditoria | **Corrigida** |

---

## 4. Verificações sem falha (com evidência)

### 4.1 Autenticação e sessão
| Verificação | Resultado | Evidência |
|---|---|---|
| Acessar o painel sem login | Bloqueado | O teste E2E "rotas protegidas" redireciona para o login; os dados exigem JWT válido de administrador (RLS) |
| Abrir URLs internas diretamente (`/admin/painel.html#/cadastros`) | Bloqueado | A página é estática e vazia; sem sessão de admin ativa, os dados não carregam e há redirecionamento |
| Criar conta pública | Bloqueado | `signup_disabled` em produção |
| Login anônimo | Bloqueado | `anonymous_provider_disabled` |
| Elevar privilégio (inserir em `admins`, chamar `promover_admin`, mudar o próprio papel) | Bloqueado | `42501` / 401 em produção e homologação, mesmo com token de administrador |
| Usuário logado sem papel de admin | Não vê nada | `count = 0` com papel `authenticated` simulado em produção; testes E2E de leitura, edição e fotos |
| Logout | Revoga o refresh token | Teste: reutilizar o refresh token após o logout retorna erro |
| Sessão após recarregar a página | Mantida apenas no `sessionStorage`; validada a cada navegação | Teste E2E; nada no `localStorage` |
| Expiração por inatividade | 30 min (painel) + JWT de 30 min | Código `painel.js`; configuração do Supabase |
| Recuperação de senha | Resposta neutra (não revela se o e-mail existe); link de uso único; 30 min; CAPTCHA | Teste E2E completo em homologação; configuração de produção |
| Tokens no navegador | Apenas a chave pública e o JWT do próprio usuário; nenhuma chave secreta | Varredura do build publicado e de todo o histórico Git |

### 4.2 Supabase (produção, consultas de catálogo)
- **RLS ativo** em todas as 6 tabelas. Há 9 políticas de tabela e 4 de Storage.
- **Privilégios do papel `anon`:** nenhum, em nenhuma tabela.
- **Privilégios do papel `authenticated`:** apenas os necessários (SELECT; UPDATE em cadastros e configurações; INSERT em congregações). Nenhum DELETE.
- **Funções `SECURITY DEFINER`:** todas têm `search_path=""`. Nenhuma é executável por `anon`. `promover_admin`, `revogar_admin`, `_registrar_auditoria` e `registrar_tentativa_envio` também não são executáveis por usuários logados.
- **Exclusão:** só pela função `admin_excluir_cadastro`, que verifica o papel `admin` no próprio banco. Não há permissão de DELETE direto.
- **Campos imutáveis:** `id`, `protocolo`, `created_at` e os campos de consentimento são protegidos por gatilho (teste: o admin não consegue alterá-los).
- **Status inicial:** sempre PENDENTE, forçado por gatilho (teste: o envio público com `status: APROVADO` é ignorado).
- **GraphQL** desativado; **OpenAPI** sem tabelas; **Realtime** sem tabelas publicadas.

### 4.3 Fotografias
| Teste | Resultado |
|---|---|
| Bucket público? | `public = false` |
| URL pública | `Bucket not found` |
| Listar arquivos anonimamente | Lista vazia |
| URL assinada sem login | Negada (`Object not found`, que não revela se o arquivo existe) |
| Upload anônimo | `row-level security policy` |
| Path traversal | 404; nomes de arquivo gerados pelo servidor (UUID) |
| Conteúdo real e não extensão | Verificação de assinatura e estrutura JPEG; PNG, arquivo truncado e "poliglota" recusados ou limpos |
| EXIF/GPS | Removidos (teste com foto contendo GPS) |
| Tamanho | Até 3 MB por foto; 4 MB por requisição; bucket limitado a 3 MB e `image/jpeg` |
| Validade das URLs temporárias | Não são usadas: o painel baixa a foto autenticado e exibe como `blob:` local |
| Exclusão | O arquivo é removido do Storage antes do registro (teste confirma que o objeto deixa de existir) |

### 4.4 OWASP / injeções
- **SQL Injection:** sem SQL dinâmico. PostgREST usa parâmetros. Teste com `%' or 1=1 --` retorna lista vazia.
- **XSS:** toda a interface usa `textContent`. Teste com `<img onerror>` e `<script>` gravados direto no banco: exibidos como texto, sem execução. Há CSP sem `unsafe-inline` para scripts.
- **CSRF:** a API pública verifica a origem (teste: origem estranha retorna 403). O painel não usa cookies, só token em cabeçalho, então não há CSRF clássico.
- **IDOR:** as fichas são acessíveis apenas a administradores (por desenho). Usuário comum vê 0.
- **Manipulação de parâmetros:** o backend reconstrói o objeto a partir da lista fechada de campos (sem *mass assignment*). O status é forçado pelo banco.
- **CSV/Excel injection:** valores iniciados por `= + - @` recebem prefixo; no XLSX, todas as células são texto.
- **Dependências:** `npm audit` aponta **0 vulnerabilidades** (produção e desenvolvimento).
- **Segredos:** nenhum no build publicado nem em nenhum commit do repositório (que é público).

### 4.5 Cloudflare
| Item | Resultado |
|---|---|
| HTTPS | O domínio `.dev` está na lista de pré-carga HSTS dos navegadores (HTTPS obrigatório) + `Strict-Transport-Security: max-age=31536000` |
| Arquivos sensíveis (`.env`, `.dev.vars`, `package.json`, `.git/config`, `supabase/…`, `functions/…`) | Não servidos: só o conteúdo de `dist/` é publicado |
| Cache de páginas privadas | `/admin/*` e `/api/*` com `Cache-Control: no-store`; os dados nunca ficam em HTML |
| Cabeçalhos | CSP, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP |
| Indexação | `noindex` no painel e na API; `robots.txt` bloqueia `/admin/` e `/api/` |
| Anti-robô | Turnstile no formulário (servidor exige token) e no login |

---

## 5. Proteção contra abuso do formulário público

| Ameaça | Controle | Situação |
|---|---|---|
| Milhares de envios automáticos / bots | Turnstile obrigatório (validado no servidor), honeypot, tempo mínimo de 5 s | Implementado |
| Envios repetidos | 5 por hora por IP (hash) + 400 por dia no total | Implementado (teste do limitador) |
| Arquivos gigantes | 4 MB por requisição (leitura em fluxo), 3 MB por foto, limite de resolução | Implementado |
| Conteúdo malicioso | Validação de todos os campos no servidor; HTML recusado; JPEG reconstruído | Implementado |
| Manipular status de aprovação | Gatilho força PENDENTE | Implementado |
| Sobrecarga do banco | Consultas só após Turnstile; limite global | Implementado |
| Monitoramento | Logs da Cloudflare (sem dados pessoais) + auditoria no banco | Parcial: recomenda-se revisar a auditoria semanalmente |

---

## 6. Correções implementadas (commit `1f79591` + configuração)

1. Logs sem dados pessoais (V02).
2. Validação igual à do banco (V03).
3. Limite real do corpo da requisição (V04).
4. JPEG sem dados anexados e com limite de resolução (V05, V06).
5. Turnstile: domínio verificado (V07); widget no login, recuperação e troca de senha (V01).
6. Supabase Auth em produção:
   - CAPTCHA obrigatório;
   - senha com letras e números (mínimo de 10);
   - JWT de 30 min;
   - link de recuperação de 30 min.
7. Cabeçalhos: CSP exata, sem CORS na API, 404 real, Referrer-Policy único (V08–V11).
8. Política de Privacidade pública e consentimento específico, nova versão `LGPD-2026-11` (V20).
9. Remoção de código não utilizado.
10. 11 novos testes de ataque e regressão.

**Nenhuma alteração estrutural foi feita no banco de produção.** A única proposta está em `docs/sql/PROPOSTA-001-responsavel-legal.sql` e aguarda autorização.

---

## 7. Evidências dos testes automatizados (homologação)

```
npm run test:unit   → 12 aprovados, 0 falhas
npm run test:e2e    → 47 aprovados, 0 falhas
  [celular]  5  – formulário, máscaras, validação, foto, revisão, envio, menor de idade, formulário fechado
  [api]     23  – RLS, Storage, escalada de privilégio, injeção, CORS, upload malicioso, logout
  [desktop] 19  – login, rotas, filtros, edição, foto, aprovação, impressão, exportação,
                  congregações, QR Code, exclusão + auditoria, XSS armazenado, sessão, recuperação
```

Testes em **produção** (somente leitura ou requisições recusadas): seção 4 deste relatório.

**Não verificáveis** a partir do ambiente da auditoria:
- exibição do widget Turnstile em produção (o domínio `challenges.cloudflare.com` estava bloqueado na rede da auditoria): **o responsável deve confirmar o login**;
- redirecionamento HTTP→HTTPS (rede da auditoria só permite HTTPS; o domínio `.dev` é HSTS por padrão);
- conteúdo real dos logs da Cloudflare em produção;
- entrega de e-mails de recuperação;
- existência e restauração de backups do Supabase.

---

## 8. Pendências técnicas (em ordem de prioridade)

1. **Trocar a senha do administrador** (V14), em Configurações → Minha senha.
2. **Confirmar o login com o Turnstile** em produção. Se falhar, o CAPTCHA pode ser revertido em minutos.
3. **Região do banco (V17):** com 0 cadastros, migrar agora para São Paulo é simples (novo projeto `sa-east-1` + mesmo SQL + trocar as variáveis). Depois de receber dados reais, a migração fica mais trabalhosa.
4. **MFA (TOTP) para administradores (V13):** recomendado antes de cadastrar mais administradores.
5. **Backups (V16):** exportação semanal (CSV/Excel do painel + fotos) guardada com criptografia, ou plano Pro com PITR. Testar uma restauração.
6. **SMTP próprio** para os e-mails de recuperação. O padrão do Supabase entrega só para a equipe do projeto e tem limite de 2 e-mails por hora.
7. **Revogar os tokens de API** usados na implantação (V15) quando não forem mais necessários: Supabase → Account → Access Tokens; Cloudflare → My Profile → API Tokens.
8. **Escopo por congregação (V18)** e **responsável legal (V19):** dependem de decisão institucional.

---

## 9. Critérios de aprovação técnica

| Critério | Situação |
|---|---|
| Sem vulnerabilidades críticas/altas sem tratamento | ⚠️ V01 corrigida; **V14 (senha exposta) depende da troca de senha** |
| Sem acesso público indevido aos cadastros | ✅ Verificado em produção |
| Políticas RLS verificadas | ✅ |
| Painel protegido | ✅ (falta confirmar o login com CAPTCHA) |
| Fotos protegidas | ✅ |
| Operações administrativas autorizadas no banco | ✅ |
| Dados fora de logs e arquivos públicos | ✅ (V02 corrigida) |
| Medidas documentadas | ✅ Este relatório e a pasta `docs/lgpd/` |
| Testes com evidência | ✅ |

**Resultado:** **APROVAÇÃO TÉCNICA CONDICIONADA.** Passa a ser aprovada quando (1) a senha do administrador for trocada e (2) o login com Turnstile for confirmado em produção.

**Atualização 09/11/2026:** a instituição respondeu ao questionário resumido. Controlador (CNPJ), finalidades, acesso, compartilhamento e responsável pelo atendimento foram incorporados. Continuam pendentes: prazo de guarda, contato público do encarregado, região do banco, responsável legal de menores (PROPOSTA-001), papel do secretário para excluir e contatos de incidente.

**Conformidade legal (LGPD):** **NÃO APROVADA nesta data.** Depende das respostas do `docs/lgpd/QUESTIONARIO-LGPD.md` (controlador, encarregado, retenção, base legal para guarda após revogação, decisão sobre transferência internacional, contratos com fornecedores). A avaliação legal é separada da técnica e deve ser validada por profissional jurídico.

---

## 10. Documentos entregues

| Documento | Arquivo |
|---|---|
| Política de Privacidade (pública) | `privacidade.html` → https://cadastro-setor46.pages.dev/privacidade |
| Base legal e termo de consentimento | `docs/lgpd/BASE-LEGAL-E-CONSENTIMENTO.md` |
| Procedimento de direitos dos titulares | `docs/lgpd/PROCEDIMENTO-DIREITOS-TITULARES.md` |
| Plano de resposta a incidentes | `docs/lgpd/PLANO-RESPOSTA-INCIDENTES.md` |
| Registro das operações de tratamento (art. 37) | `docs/lgpd/REGISTRO-OPERACOES-TRATAMENTO.md` |
| Questionário de conformidade | `docs/lgpd/QUESTIONARIO-LGPD.md` |
| Proposta SQL (não aplicada) | `docs/sql/PROPOSTA-001-responsavel-legal.sql` |
| Checklist final | Seção 11 |

---

## 11. Checklist final

**Segurança**
- [x] RLS em todas as tabelas, verificado em produção
- [x] Anônimo sem acesso a tabelas, funções e fotos
- [x] Usuário sem papel não vê dados
- [x] Secretaria não exclui; ninguém cria administrador pela API
- [x] Chave secreta só no backend; nenhum segredo no Git ou no build
- [x] CAPTCHA no formulário e no login
- [x] Validação no servidor, limites de upload, JPEG limpo
- [x] Cabeçalhos de segurança, CSP exata, sem CORS aberto
- [x] Logs sem dados pessoais
- [x] Auditoria de alterações, aprovações, exportações e exclusões
- [ ] Senha do administrador trocada
- [ ] Login com Turnstile confirmado em produção
- [ ] MFA para administradores
- [ ] Backup testado
- [ ] SMTP próprio
- [ ] Tokens de implantação revogados

**Privacidade (LGPD)**
- [x] Aviso resumido no formulário e Política de Privacidade completa
- [x] Consentimento específico e destacado, com versão registrada
- [x] Regra para menores (consentimento do responsável)
- [x] Exclusão definitiva de registro e foto
- [x] Transferência internacional informada
- [ ] Encarregado nomeado e contato publicado (Configurações do painel)
- [ ] Prazo de retenção definido
- [ ] Questionário respondido e documentos ajustados
- [ ] Decisão sobre região do banco
- [ ] Revisão jurídica
