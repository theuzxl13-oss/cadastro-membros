# Registro das operações de tratamento (LGPD, art. 37)

| Campo | Conteúdo |
|---|---|
| Controlador | AD Belém – Setor 46 (Igreja Evangélica Assembleia de Deus – Ministério do Belém – Setor 46), CNPJ 62.769.500/0328-58. Razão social a conferir no Cartão CNPJ |
| Encarregado / atendimento ao titular | Victor Hugo (Secretário Setorial); contato público PENDENTE |
| Operação | Cadastro digital de membros (Ficha de Cadastro Setorial) |
| Titulares | Membros e obreiros; cônjuges e pais (dados de terceiros); menores de idade (via responsável) |
| Categorias de dados | Identificação (nome, CPF, RG, nascimento, filiação, foto), contato (endereço, telefones, e-mail), socioeconômicos (escolaridade, profissão), **sensíveis**: convicção religiosa (origem, batismo, admissão, cargo, congregação) |
| Finalidades | Controle interno de membros; atualização de dados; organização das congregações; registro de obreiros |
| Base legal | Art. 11, I (consentimento específico e destacado); art. 14 para menores; guarda mínima: PENDENTE (C3) |
| Coleta | Formulário web via QR Code, sem conta de usuário |
| Acesso | Administrador geral (*admin*) e secretários autorizados (*secretaria*), com login individual e CAPTCHA; uso exclusivo da igreja, sem compartilhamento |
| Operadores | Supabase Inc. (banco de dados, autenticação e fotos; região us-west-2, EUA); Cloudflare Inc. (hospedagem, anti-robô, rede global) |
| Transferência internacional | Sim (EUA). Base do art. 33: PENDENTE (G2) |
| Retenção | Enquanto durar o vínculo ou até pedido de exclusão; prazos após desligamento: PENDENTE (D1/D2) |
| Controle anti-abuso | Hash de IP (SHA-256 com sal), retido 24 h |
| Medidas de segurança | RLS, privilégio mínimo, HTTPS/HSTS, CSP, CAPTCHA, validação no servidor, fotos privadas sem metadados, auditoria sem dados pessoais, logs sem dados pessoais, testes automatizados (ver relatório) |
| Registro de atividades | Tabela `auditoria`: recebimento, edição (somente nomes de campos), aprovação, exclusão, exportação, impressão, login e logout |
| Data da última revisão | 09/11/2026 |
