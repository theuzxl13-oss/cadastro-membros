# Registro das operações de tratamento (LGPD, art. 37)

| Campo | Conteúdo |
|---|---|
| Controlador | Igreja Evangélica Assembleia de Deus – Ministério do Belém – Setor 46 (razão social/CNPJ: PENDENTE DE DEFINIÇÃO) |
| Encarregado | PENDENTE DE DEFINIÇÃO |
| Operação | Cadastro digital de membros (Ficha de Cadastro Setorial) |
| Titulares | Membros e obreiros; cônjuges e pais (dados de terceiros); menores de idade (via responsável) |
| Categorias de dados | Identificação (nome, CPF, RG, nascimento, filiação, foto), contato (endereço, telefones, e-mail), socioeconômicos (escolaridade, profissão), **sensíveis**: convicção religiosa (origem, batismo, admissão, cargo, congregação) |
| Finalidades | Rol de membros; contato pastoral e administrativo; documentos eclesiásticos |
| Base legal | Art. 11, I (consentimento específico e destacado); art. 14 para menores; guarda mínima: PENDENTE (C3) |
| Coleta | Formulário web via QR Code, sem conta de usuário |
| Acesso | Papéis *admin* (total) e *secretaria* (sem exclusão), com login individual e CAPTCHA |
| Operadores | Supabase Inc. (banco de dados, autenticação e fotos; região us-west-2, EUA); Cloudflare Inc. (hospedagem, anti-robô, rede global) |
| Transferência internacional | Sim (EUA). Base do art. 33: PENDENTE (G2) |
| Retenção | Enquanto durar o vínculo ou até pedido de exclusão; prazos após desligamento: PENDENTE (D1/D2) |
| Controle anti-abuso | Hash de IP (SHA-256 com sal), retido 24 h |
| Medidas de segurança | RLS, privilégio mínimo, HTTPS/HSTS, CSP, CAPTCHA, validação no servidor, fotos privadas sem metadados, auditoria sem dados pessoais, logs sem dados pessoais, testes automatizados (ver relatório) |
| Registro de atividades | Tabela `auditoria`: recebimento, edição (somente nomes de campos), aprovação, exclusão, exportação, impressão, login e logout |
| Data da última revisão | 09/11/2026 |
