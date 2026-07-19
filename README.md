# CEB Par — Gestão de Projetos de Energia

Aplicação interna multiusuário para gestão do portfólio de projetos de energia. A solução usa Cloudflare Workers e banco D1, com autenticação própria, perfis de acesso, histórico de alterações, exclusão lógica e bloqueio otimista de edições simultâneas.

## Segurança

- Senhas derivadas com PBKDF2-SHA-256 e salt individual (100 mil iterações, limite máximo aceito pelo Cloudflare Workers).
- Sessão em cookie `HttpOnly`, `Secure` e `SameSite=Strict`, com duração de 8 horas.
- Perfis Administrador, Editor e Visualizador aplicados também na API.
- Exclusões são arquivadas; o histórico registra valores anteriores e posteriores.
- `version` impede que uma edição antiga sobrescreva alterações recentes sem aviso.
- Não armazene credenciais, documentos ou dados pessoais no repositório GitHub.

## Implantação

1. Crie uma conta gratuita na Cloudflare.
2. No terminal: `npm install` e `npx wrangler login`.
3. Crie o banco: `npx wrangler d1 create cebpar-db`.
4. Copie o `database_id` retornado para `wrangler.jsonc`.
5. Execute: `npm run db:migrate`.
6. Publique: `npm run deploy`.
7. Na primeira abertura, cadastre o administrador.

O endereço inicial será um subdomínio gratuito `*.workers.dev`. Um domínio próprio pode ser conectado futuramente.

## Desenvolvimento

```bash
npm install
npm run db:migrate:local
npm run dev
```
