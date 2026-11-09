# Sistema de Cadastro Digital Setorial

**Igreja Evangélica Assembleia de Deus – Ministério do Belém – Setor 46 – Embu-Guaçu/SP**

Substitui a ficha de papel (*Ficha de Cadastro Setorial*) por um formulário digital acessado via QR Code. O membro preenche todos os campos da ficha no celular, envia a foto 3x4 e submete **sem criar conta**. A secretaria confere, edita, aprova, imprime, exporta e, quando necessário, exclui definitivamente as fichas em um painel privado.

| Camada | Tecnologia (planos gratuitos) |
|---|---|
| Site público e painel | Cloudflare Pages (HTML/CSS/JS com Vite, sem framework) |
| Backend do envio público | Cloudflare Pages Functions (`/functions`) |
| Banco de dados | Supabase PostgreSQL com RLS em todas as tabelas |
| Login do painel | Supabase Auth (e-mail e senha, sem cadastro público) |
| Fotos 3x4 | Supabase Storage (bucket **privado**, URLs temporárias) |
| Anti-robô | Cloudflare Turnstile + honeypot + tempo mínimo + limite por IP |

---

## Prévia de demonstração (GitHub Pages)

Para visualizar o sistema **antes** de configurar Supabase e Cloudflare existe um modo demonstração:

- Endereço: **https://theuzxl13-oss.github.io/cadastro-membros/** (formulário) e **…/cadastro-membros/admin/** (painel).
- Login do painel: botões *Entrar como Administrador* / *Entrar como Secretaria* (senha `demo1234`).
- Usa **dados fictícios** salvos apenas no navegador de quem visualiza (faixa amarela no topo; botão *Restaurar dados de exemplo*). Nada é enviado a lugar nenhum. Uma ficha enviada pelo formulário aparece no painel **do mesmo navegador**.
- Publicado automaticamente pelo workflow `.github/workflows/demo-pages.yml` a cada push. Para gerar localmente: `npm run build:demo` (saída em `dist-demo/`).
- O código da demonstração fica em `src/demo/` e é **removido do build de produção** (`npm run build`) pela constante de compilação `__DEMO__`.
- **Não use a demonstração com dados reais.**

## Sumário
1. [Arquitetura e segurança](#1-arquitetura-e-segurança)
2. [Estrutura do projeto](#2-estrutura-do-projeto)
3. [Implantação passo a passo](#3-implantação-passo-a-passo)
4. [Administradores (primeiro acesso)](#4-administradores)
5. [Variáveis de ambiente](#5-variáveis-de-ambiente)
6. [Desenvolvimento local e testes](#6-desenvolvimento-local-e-testes)
7. [Checklist de testes](#7-checklist-de-testes)
8. [Pendências manuais](#8-pendências-manuais)
9. [LGPD – orientações de uso](#9-lgpd--orientações-de-uso)

---

## 1. Arquitetura e segurança

```
Celular (QR Code) ──► Cloudflare Pages ──► /api/form-config ─┐
                         │                  /api/submit ──────┼──► Supabase (chave secreta, só no servidor)
                         │                                    │      • valida tudo de novo
                         │                                    │      • grava foto (sem EXIF/GPS)
                         │                                    │      • grava ficha como PENDENTE
Painel /admin ───────────┴──► Supabase Auth + PostgREST + Storage (chave pública + RLS)
```

- **Nenhuma consulta pública aos cadastros.** O papel `anon` não tem permissão em nenhuma tabela; o papel `authenticated` só enxerga dados se o usuário estiver na tabela `admins` e ativo (`is_admin()`).
- **Envio público controlado:** o banco **não aceita INSERT** do navegador. A ficha passa por `/api/submit`, que valida origem, tamanho, honeypot, tempo de preenchimento, Turnstile, consentimento LGPD, limite por IP (hash, retido 24 h), todos os campos (mesmas regras do formulário em `src/shared/campos.js`) e a foto (JPEG real, proporção 3x4, metadados EXIF/GPS removidos).
- **Todo novo cadastro começa PENDENTE**, garantido por gatilho no banco (não depende do frontend).
- **Papéis:** `admin` (acesso total, inclusive exclusão, configurações e auditoria) e `secretaria` (consulta, edita e aprova; **não exclui**).
- **Exclusão definitiva:** a foto é removida do Storage e o registro é apagado do PostgreSQL pela função `admin_excluir_cadastro` (só papel `admin`). A auditoria guarda apenas ação, autor, data e **protocolo** — nenhum dado pessoal.
- **Fotos privadas:** bucket `fotos-cadastros` sem acesso público; o painel baixa a imagem autenticado e exibe como `blob:` local.
- **A chave secreta (`service_role`/`sb_secret_`) nunca vai ao navegador.** Ela existe apenas como *Secret* das Pages Functions. Há teste automatizado verificando isso no build.
- **Cabeçalhos de segurança** (`public/_headers`): CSP restritiva, `frame-ancestors 'none'`, HSTS, `noindex` no painel.
- **Sessão do painel** guardada em `sessionStorage` (fecha o navegador = sai), encerramento automático após 30 min sem uso, revalidação a cada navegação e botão **Sair**.

## 2. Estrutura do projeto

```
index.html                    Formulário público (6 etapas)
admin/index.html              Login + recuperação de senha
admin/redefinir-senha.html    Nova senha (link do e-mail)
admin/painel.html             Painel (SPA com rotas #/...)
src/shared/campos.js          Campos da ficha + validação (navegador E servidor)
src/ui/                       Renderização de campos, recorte da foto 3x4
src/public/formulario.js      Lógica do formulário público
src/admin/                    Painel: login, rotas, telas, impressão
src/styles/                   Estilos (base, formulário, painel, impressão A4)
functions/api/form-config.js  GET  – congregações ativas e configurações públicas
functions/api/submit.js       POST – recebimento validado da ficha
functions/_lib/               Cliente Supabase do servidor, JPEG, respostas
supabase/migrations/          SQL completo: tabelas, funções, gatilhos, RLS, Storage
scripts/criar-admin.mjs       Criação segura de administrador (terminal)
public/                       Logo, ícones, _headers, robots.txt
tests/                        Testes unitários e E2E (Playwright)
```

## 3. Implantação passo a passo

### 3.1 Supabase
1. Crie um projeto em <https://supabase.com> (plano Free). Região sugerida: **South America (São Paulo)**.
2. **SQL Editor → New query**: cole todo o conteúdo de `supabase/migrations/20251101000000_schema_inicial.sql` e clique em **Run**. Isso cria tabelas, funções, gatilhos, políticas RLS e o bucket privado `fotos-cadastros`.
   - Alternativa via CLI: `npx supabase link --project-ref SEU_REF && npx supabase db push`.
3. **Authentication → Sign In / Providers → Email**:
   - **Desative “Allow new users to sign up”** (impede criação pública de contas).
   - Mantenha “Confirm email” ativo.
4. **Authentication → URL Configuration**:
   - *Site URL*: `https://SEU-DOMINIO/admin/`
   - *Redirect URLs*: `https://SEU-DOMINIO/admin/redefinir-senha.html`
5. **Authentication → Emails (SMTP)**: o envio padrão do Supabase é limitado (poucos e-mails/hora). Para recuperação de senha confiável, configure um SMTP próprio (ex.: Brevo/Resend, com plano gratuito).
6. **Storage**: confira que o bucket `fotos-cadastros` está como **Private**.
7. **Project Settings → API Keys**: anote a *URL*, a chave **publishable/anon** (pública) e a chave **secret/service_role** (secreta).

### 3.2 Cloudflare Turnstile (anti-robô, recomendado)
Cloudflare Dashboard → **Turnstile → Add widget** → domínio do site → modo *Managed*. Anote *Site Key* e *Secret Key*.

### 3.3 Cloudflare Pages
1. Envie este repositório ao GitHub.
2. Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git** → selecione o repositório.
3. Build:
   - *Framework preset*: **None**
   - *Build command*: `npm run build`
   - *Build output directory*: `dist`
   - A pasta `functions/` é detectada automaticamente.
4. **Settings → Variables and Secrets** (Production **e** Preview) — veja a [tabela abaixo](#5-variáveis-de-ambiente). Marque como **Secret** as chaves secretas.
5. **Deploy**. O link público fica `https://NOME-DO-PROJETO.pages.dev/` (ou o domínio próprio em *Custom domains*).
6. Após o deploy, ajuste no Supabase a *Site URL* e *Redirect URLs* (passo 3.1.4) com o domínio final.

### 3.4 Primeiros passos no painel
1. Crie o primeiro administrador ([seção 4](#4-administradores)).
2. Acesse `https://SEU-DOMINIO/admin/` e entre.
3. **Congregações → Nova congregação**: cadastre as congregações do setor (o formulário só funciona com pelo menos uma ativa).
4. **Configurações**: informe a **URL pública de produção**, confira endereço da sede/pastor setorial e preencha o **encarregado de dados (LGPD)**.
5. **QR Code**: baixe o PNG/PDF ou imprima o cartaz.

## 4. Administradores

Não existe tela pública de cadastro de administradores. Use **uma** das opções:

**Opção A – Painel do Supabase + SQL (sem instalar nada)**
1. Supabase → **Authentication → Users → Add user → Create new user**: e-mail, senha forte, marque *Auto Confirm User*.
2. **SQL Editor**:
   ```sql
   select public.promover_admin('email@dominio.com', 'Nome Completo', 'admin');
   -- papel 'secretaria' para quem não deve excluir fichas
   ```

**Opção B – Script no terminal (a senha é digitada oculta)**
```bash
SUPABASE_URL=https://SEU-PROJETO.supabase.co SUPABASE_SERVICE_ROLE_KEY=CHAVE_SECRETA node scripts/criar-admin.mjs email@dominio.com "Nome Completo" admin
```

**Revogar acesso:** `select public.revogar_admin('email@dominio.com');` (e, se quiser, apague o usuário em *Authentication → Users*).

As funções `promover_admin`/`revogar_admin` não podem ser chamadas pela API — somente pelo SQL Editor (dono do banco).

## 5. Variáveis de ambiente

| Variável | Onde | Tipo | Descrição |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Cloudflare Pages | Texto (build) | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Cloudflare Pages | Texto (build) | Chave **pública** (anon ou `sb_publishable_…`) |
| `SUPABASE_URL` | Cloudflare Pages | Texto | Mesma URL, para as Functions |
| `SUPABASE_SERVICE_ROLE_KEY` | Cloudflare Pages | **Secret** | Chave secreta (service_role ou `sb_secret_…`) |
| `IP_HASH_SALT` | Cloudflare Pages | **Secret** | Texto aleatório longo (anonimiza IPs) |
| `TURNSTILE_SITE_KEY` | Cloudflare Pages | Texto | Site key do Turnstile |
| `TURNSTILE_SECRET_KEY` | Cloudflare Pages | **Secret** | Secret key do Turnstile |
| `LIMITE_ENVIOS_POR_HORA` | opcional | Texto | Padrão 5 por IP/hora |
| `LIMITE_ENVIOS_POR_DIA` | opcional | Texto | Padrão 400 no total/24 h |

Modelo completo em `.env.example`. **Nunca** use prefixo `VITE_` para chaves secretas (tudo com `VITE_` vai para o navegador). Se o Turnstile não for configurado, as demais proteções continuam ativas, mas o recomendado é configurá-lo.

## 6. Desenvolvimento local e testes

Requisitos: Node 20+, Docker (para o Supabase local).

```bash
npm install
```
```bash
npm run db:local
```
Crie `.env.local` (frontend) e `.dev.vars` (Functions) com os valores exibidos por `npx supabase status` (veja `.env.example`). Depois:
```bash
npm run build && npm run preview
```
Formulário em <http://127.0.0.1:8788/>, painel em <http://127.0.0.1:8788/admin/>, e-mails de teste em <http://127.0.0.1:54324/>.

Testes:
```bash
npm run test:unit
```
```bash
npm run test:e2e
```
Os E2E usam o Supabase local, criam seus próprios usuários/fichas de teste e apagam o que criaram. **Não rode contra produção.**

### Simulador iOS (macOS)
O sistema é web, então no iPhone ele roda no Safari: não há app nativo, Xcode build nem CocoaPods. Em um Mac com Xcode e Docker:
```bash
scripts/ios-simulador.sh
```
O script confere Xcode/runtime iOS/Docker, sobe o Supabase local e o servidor, liga um iPhone no Simulador e abre o formulário. Para outra tela: `scripts/ios-simulador.sh abrir /admin/`; para screenshot: `scripts/ios-simulador.sh print`. Logs e inspeção: Safari do Mac → menu **Desenvolvedor → Simulator**.

## 7. Checklist de testes

Resultado da última execução: **9 testes unitários + 36 testes E2E aprovados** (Supabase local + Cloudflare Pages local).

| Área | Verificação | Automatizado |
|---|---|---|
| Formulário (celular) | 6 etapas, progresso, logo sem distorção, sem rolagem horizontal | ✅ |
| Validação | obrigatórios, CPF, datas, e-mail, UF, telefone, condicionais (cônjuge, obreiro, outros credos) | ✅ |
| Máscaras | CPF, CEP, telefone/celular | ✅ |
| Foto | obrigatória, upload, pré-visualização, recorte 3x4, zoom, troca, remoção, PNG→JPEG | ✅ |
| Revisão e envio | resumo, “Corrigir”, consentimento LGPD, menor exige responsável, protocolo | ✅ |
| Banco | ficha gravada como PENDENTE, foto no Storage privado sem EXIF/GPS | ✅ |
| Anti-spam | honeypot, tempo mínimo, CSRF/origem, limite por IP | ✅ |
| Login | senha errada, mostrar senha, usuário sem papel barrado, logout | ✅ |
| Recuperação de senha | e-mail recebido, link, nova senha, novo login | ✅ |
| Rotas protegidas | painel sem login redireciona; RLS bloqueia anon e não-admin | ✅ |
| Dashboard | total, pendentes, aprovados, mês, por congregação | ✅ |
| Filtros | nome, CPF, congregação, cargo, status, período | ✅ |
| Edição | dados, validação, substituição de foto, auditoria sem valores | ✅ |
| Aprovação | aprovar / voltar a pendente | ✅ |
| Exclusão | confirmação por protocolo, registro e foto apagados, auditoria sem dados pessoais, secretaria não exclui | ✅ |
| Impressão | ficha A4 em 1 página com logo, campos e foto | ✅ |
| Exportação | CSV (UTF-8, `;`, proteção contra fórmulas) e XLSX respeitando filtros | ✅ |
| Congregações | adicionar, editar, desativar/reativar refletindo no formulário | ✅ |
| QR Code | visualizar, copiar link, PNG, PDF, imprimir, URL de produção | ✅ |
| Segurança | chave secreta ausente do frontend, campos imutáveis, CSP sem violações | ✅ |

**Testes manuais recomendados após o deploy:** escanear o QR com um iPhone e um Android reais; tirar foto pela câmera; imprimir uma ficha numa impressora real; receber o e-mail de recuperação no domínio final.

## 8. Pendências manuais

- [ ] Criar o projeto Supabase e rodar o SQL (3.1).
- [ ] **Desativar cadastro público** no Supabase Auth (3.1.3).
- [ ] Configurar Site URL e Redirect URL com o domínio final (3.1.4).
- [ ] (Recomendado) SMTP próprio para os e-mails de recuperação (3.1.5).
- [ ] Criar o widget Turnstile (3.2).
- [ ] Conectar o repositório no Cloudflare Pages e cadastrar as variáveis (3.3).
- [ ] Criar o primeiro administrador (4).
- [ ] Cadastrar as congregações, a URL pública e o encarregado LGPD (3.4).
- [ ] Revisar o texto do aviso de privacidade (`index.html`) com a liderança/jurídico da igreja.
- [ ] Ativar 2FA nas contas do GitHub, Cloudflare e Supabase de quem administra.
- [ ] Opcional: Cloudflare Access na rota `/admin/*` como camada extra.
- [ ] Opcional: backups — no plano gratuito do Supabase faça exportações periódicas (Database → Backups / `pg_dump`).

## 9. LGPD – orientações de uso

- A ficha contém **dado sensível** (convicção religiosa) e dados como CPF, RG, endereço e foto. O formulário coleta **consentimento específico e destacado** (art. 11, I) e, para menores, o consentimento do responsável (art. 14). Data e versão do consentimento ficam registradas na ficha.
- Acesso restrito por login, com papéis e trilha de auditoria **sem dados pessoais**.
- Atenda pedidos do titular (acesso, correção, exclusão) pelo painel: **Editar** ou **Excluir cadastro** (exclusão definitiva, inclusive da foto).
- Arquivos exportados (CSV/Excel) e fichas impressas são de uso interno: guarde com segurança e descarte quando não forem mais necessários.
- O controle anti-spam guarda somente um hash irreversível do IP por 24 horas.
