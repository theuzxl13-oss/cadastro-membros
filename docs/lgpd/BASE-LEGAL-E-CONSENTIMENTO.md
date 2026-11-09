# Base legal e termo de consentimento

> Análise técnica para apoiar a decisão da instituição. **Não substitui parecer jurídico.** Pontos que dependem da instituição estão marcados como PENDENTE DE DEFINIÇÃO (ver `QUESTIONARIO-LGPD.md`).

## 1. Natureza dos dados

- A ficha revela **convicção religiosa** (filiação à igreja, batismo, admissão, cargo, congregação, origem religiosa). Isso é **dado pessoal sensível** (art. 5º, II).
- Por estarem no contexto de uma ficha de membro, os demais dados (nome, CPF, RG, endereço, foto, família) passam a revelar, indiretamente, a convicção religiosa do titular. Por isso devem ser tratados com o **mesmo cuidado** dos dados sensíveis.
- Cônjuge e pais aparecem como **dados de terceiros**: devem ser limitados ao necessário, com nome e datas apenas.

## 2. Hipótese legal por finalidade

| Finalidade | Dados | Hipótese sugerida | Observações |
|---|---|---|---|
| Cadastro no rol de membros do Setor | Ficha completa e foto | **Art. 11, I – consentimento específico e destacado** | Já implementada no formulário (versão LGPD-2026-11) |
| Contato pastoral e administrativo | Telefone, e-mail, endereço | Art. 11, I (incluído no mesmo consentimento) | Comunicação em massa exige consentimento **separado e opcional** (PENDENTE C6) |
| Emissão de cartas e credenciais | Nome, foto, cargo, congregação, datas | Art. 11, I | — |
| Guarda mínima após revogação ou desligamento (histórico eclesiástico, defesa em processos) | Dados mínimos a definir | Art. 11, II, "d" – exercício regular de direitos – **somente se** houver necessidade concreta (estatuto, processos) | **PENDENTE C2/C3/D1**: não usar como justificativa genérica |
| Segurança e prevenção a abusos no formulário | IP anonimizado (hash) por 24 h, data e versão do aceite | Art. 7º, IX – legítimo interesse (dado não sensível, mínimo, retenção curta) / art. 11, II, "g" | Registrar o teste de balanceamento no registro de operações |
| Auditoria de acesso (art. 37) | Ação, autor (e-mail do administrador), protocolo | Art. 7º, II/IX e art. 37 | Sem valores pessoais |
| Menores de 18 anos | Ficha completa | Art. 14 e art. 11, I: consentimento específico de **pelo menos um dos pais ou responsável legal** | Melhor interesse; verificar o responsável (PENDENTE F) |

**Por que não basta "marcar uma caixa":** o consentimento só é válido se for **livre** (não condicionado a algo que não dependa dele), **informado** (aviso claro, que o formulário e a política fornecem), **inequívoco**, **específico** (finalidades listadas) e **destacado**, separado de outros termos. A recusa não pode gerar prejuízo indevido. Por exemplo: a pessoa pode pedir o cadastro em papel ou presencial, se a instituição assim decidir (PENDENTE).

## 3. Texto do termo de consentimento (vigente no formulário — versão LGPD-2026-11-2)

> **Consentimento específico (LGPD, art. 11, I):** li o aviso de privacidade e **autorizo** a Igreja Evangélica Assembleia de Deus – Ministério do Belém – Setor 46 a tratar os dados desta ficha — inclusive os **dados sensíveis sobre minha convicção religiosa** (batismo, admissão, cargo, congregação) e minha **fotografia** — exclusivamente para controle interno de membros, atualização dos dados cadastrais, organização das congregações e registro de obreiros do Setor 46, com armazenamento nos fornecedores indicados. Sei que posso revogar esta autorização a qualquer momento.

Para menores de 18 anos, há uma segunda marcação obrigatória:

> O titular é **menor de 18 anos**. Declaro que sou o pai, a mãe ou o responsável legal e dou o consentimento em seu nome.

**Registro de prova:** cada ficha guarda `consentimento_lgpd = true`, a data e hora (`consentimento_em`), a versão do texto (`consentimento_versao`) e se o consentimento foi dado pelo responsável (`consentimento_responsavel`). Esses campos não podem ser alterados pelo painel (gatilho no banco).

**Melhoria proposta (PENDENTE F2):** registrar nome e parentesco do responsável. O SQL está em `docs/sql/PROPOSTA-001-responsavel-legal.sql`.

## 4. Revogação

- O titular pede a revogação pelo canal da seção 7 da Política de Privacidade.
- A secretaria segue `PROCEDIMENTO-DIREITOS-TITULARES.md`: confirma a identidade e **exclui a ficha e a foto** pelo botão "Excluir cadastro" (exclusão definitiva), salvo guarda mínima decidida em C3.
- A auditoria mantém apenas protocolo, data e autor da exclusão (art. 37), sem dados pessoais.
