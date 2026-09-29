# StudyFlow — versão final 1.0

Painel de estudos desenvolvido para organização de atividades, calendário, Pomodoro, música, configurações e integração com Supabase.

## Acabamento final
- Interface redesenhada com visual SaaS moderno e responsivo
- Notificações internas profissionais (toast), sem alerts do navegador
- Confirmação de exclusão com modal próprio
- Estados de carregamento em ações de autenticação
- Melhorias de acessibilidade, foco, feedback visual e responsividade
- Pequenas correções de fluxo e mensagens duplicadas
- Funcionalidades existentes preservadas

## Estrutura
- `index.html` — interface
- `css/style.css` — identidade visual e responsividade
- `js/app.js` — lógica da aplicação
- `js/config.js` — configuração do Supabase
- `supabase/` — schema e Edge Functions

## Observação
A integração Moodle continua disponível no projeto, mas pode permanecer desativada até que os dados/token fornecidos pela escola estejam disponíveis.

Esta versão foi preparada como uma versão estável de apresentação/TCC, sem adicionar novas funcionalidades grandes.
