# Plano de resposta a incidentes de segurança

**Referências:** LGPD arts. 46 a 49; Resolução CD/ANPD nº 15/2024 (comunicação de incidente de segurança); Resolução CD/ANPD nº 2/2022 (agentes de pequeno porte).
**Equipe:** coordenação pelo **administrador geral** (resposta da instituição); atendimento aos titulares: **Victor Hugo (Secretário Setorial)**; nomes, telefones e substitutos: **PENDENTE DE DEFINIÇÃO** (Questionário H1/H2).

> Confira sempre o texto vigente das resoluções da ANPD. Os prazos abaixo refletem a Res. 15/2024: comunicação em **3 dias úteis** contados do conhecimento de que o incidente afetou dados pessoais. Agentes de pequeno porte têm **prazo em dobro** (Res. 2/2022), salvo exceções. O enquadramento da instituição está PENDENTE (B3).

## 1. Identificar
Sinais de alerta:
- login ou ações desconhecidas na **Auditoria** (Configurações → Auditoria);
- exclusões ou exportações não autorizadas;
- aviso de e-mail de troca de senha não solicitada;
- picos de fichas suspeitas;
- perda ou roubo de celular ou computador com acesso ao painel ou com exportações;
- vazamento de planilha.

## 2. Registrar (imediatamente)
Abra um registro do incidente com:
- data e hora da descoberta;
- quem descobriu;
- o que aconteceu;
- sistemas e dados envolvidos (quantidade aproximada de titulares, se há CPF, RG, fotos ou dados religiosos);
- medidas tomadas, com horários.

**Mantenha o registro por no mínimo 5 anos**, mesmo que o incidente não seja comunicado à ANPD (Res. 15/2024).

## 3. Conter (primeiras horas)
| Situação | Ação imediata |
|---|---|
| Invasão do painel / roubo de credenciais | 1. Supabase → Authentication → Users: **trocar a senha** ou **bloquear** o usuário; executar `select public.revogar_admin('email');` no SQL Editor. 2. Encerrar as sessões do usuário (excluir o usuário, se necessário). 3. Trocar as senhas de Gmail, GitHub, Cloudflare e Supabase e ativar 2FA |
| Vazamento de CPF ou planilha | Localizar e apagar cópias; identificar a origem pela auditoria (exportações registradas) |
| Exposição de fotografias | Confirmar que o bucket `fotos-cadastros` continua **privado**; rever as políticas de Storage |
| Acesso não autorizado ao banco | Supabase → Project Settings → API Keys: **gerar nova chave secreta** e revogar a antiga; atualizar `SUPABASE_SERVICE_ROLE_KEY` na Cloudflare e publicar de novo; trocar a senha do banco |
| Chave ou token vazado no GitHub | Revogar o token na origem (Supabase / Cloudflare / GitHub) e só depois remover do repositório |
| Exclusão indevida de cadastros | Ver a auditoria (quem, quando, qual protocolo); restaurar do backup mais recente, se existir |
| Ataque de robôs / spam | Desativar temporariamente: Configurações → "Receber novas fichas"; revisar o Turnstile e os limites |
| Suspeita sem certeza | Tratar como incidente até ser descartado |

## 4. Investigar
- Use a **auditoria** do painel (não contém dados pessoais), os logs do Supabase (Auth, API) e os logs da Cloudflare.
- Determine: causa; período; quais titulares; quais dados (sensíveis?); se houve cópia ou exfiltração; se o risco continua.

## 5. Avaliar o risco e comunicar
- Avalie se o incidente **pode acarretar risco ou dano relevante** aos titulares. Dados sensíveis (religiosos), CPF/RG e fotos tendem a indicar relevância.
- Se houver risco relevante:
  - **ANPD:** pelo formulário de comunicação de incidente no site gov.br/anpd, dentro do prazo;
  - **titulares:** em linguagem simples, informando o que ocorreu, quais dados, riscos, medidas tomadas, o que a pessoa pode fazer e o contato do encarregado.
- Se não for comunicar, **registre a justificativa**.

## 6. Recuperar e aprender
- Corrija a causa e teste.
- Revise permissões e senhas; ative MFA.
- Atualize este plano e o relatório de auditoria.

## 7. Contatos
| Função | Nome | Telefone | E-mail |
|---|---|---|---|
| Responsável legal | PENDENTE | PENDENTE | PENDENTE |
| Encarregado | PENDENTE | PENDENTE | PENDENTE |
| Responsável técnico | PENDENTE | PENDENTE | PENDENTE |
