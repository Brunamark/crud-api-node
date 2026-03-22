## Análise de Performance
Esta API implementa a arquitetura cliente-servidor tradicional, onde um único processo centraliza o estado e processa as requisições sequencialmente.

### Pontos fortes observados
- **Latência baixa para operações simples:** SQLite opera em memória e no mesmo processo do servidor, eliminando a latência de rede de um banco externo. Operações de leitura simples respondem tipicamente em menos de 5ms em ambiente local.
- **Rate limiting protege contra sobrecarga:** O express-rate-limit bloqueia IPs que excedem 1000 requisições em 15 minutos, protegendo o servidor de picos súbitos de tráfego.
- **Overhead mínimo por requisição:** A cadeia de middlewares (helmet → cors → bodyParser → auth) adiciona menos de 1ms por requisição em condições normais.
### Gargalos identificados
- **SQLite não suporta conexões concorrentes:** O SQLite usa lock em nível de arquivo. Em escritas simultâneas, as requisições enfileiram, aumentando a latência conforme o número de usuários cresce.
- **Processamento síncrono bloqueante:** Embora o Node.js seja assíncrono, operações pesadas de CPU (como bcrypt com fator 12) bloqueiam o event loop. Um login com hash bcrypt demora ~100-300ms, impedindo outras requisições nesse intervalo.
- **Sem cache:** Cada requisição vai ao banco, mesmo para dados que raramente mudam (ex: perfil do usuário). Em 100 usuários simultâneos lendo o mesmo recurso, são 100 queries idênticas.

## Limitações Arquiteturais
1. **Ponto único de falha (Single Point of Failure)**: Se o processo Node.js cair, toda a aplicação fica indisponível. Não há redundância. Em produção, isso seria mitigado com múltiplas instâncias e um load balancer, mas a arquitetura atual não suporta isso (SQLite não é compartilhável entre processos).
2. **Escalabilidade apenas vertical**: Para suportar mais usuários, a única opção é aumentar o hardware da máquina (mais CPU, mais RAM). Não é possível distribuir a carga entre múltiplos servidores, pois o estado (banco SQLite) fica preso em um único arquivo local.
3. **Estado centralizado**: Toda a lógica e todos os dados ficam em um único servidor. Isso simplifica o desenvolvimento mas cria acoplamento forte pois qualquer mudança no banco exige redeployar o servidor inteiro.
4. **Tokens JWT sem revogação**: Uma vez emitido, o token JWT é válido até expirar (24h). Não há mecanismo de logout real — se o token vazar, não é possível invalidá-lo antes da expiração. 
5. **Sem paginação**: O endpoint `GET /api/tasks` retorna todas as tarefas do usuário sem limite. Com muitas tarefas, isso pode retornar payloads grandes e sobrecarregar tanto o servidor quanto o cliente. A solução seria adicionar ?page=1&limit=20.
##
1. **Escalabilidade** — 1000 usuários simultâneos
O SQLite trava em escritas concorrentes múltiplos usuários criando tarefas ao mesmo tempo causariam fila de espera. O Node.js single-thread agravaria isso em operações pesadas como bcrypt. A arquitetura não escala horizontalmente, não é possível subir duas instâncias do servidor compartilhando o mesmo SQLite.
1. **Disponibilidade** — se o processo Node.js cair, tudo para. O arquivo tasks.db do SQLite fica no disco local — sem backup automático, uma falha de disco perde todos os dados. Não há retry, circuit breaker nem fallback implementado.
2. **Performance** — O bcrypt com fator 12 bloqueia o event loop por ~200ms a cada login. O `GET /api/tasks` sem paginação pode retornar milhares de registros de uma vez. Nenhuma query tem índice além da primary key, buscas por userId em tabelas grandes seriam lentas.
3. **Manutenção** — Qualquer deploy derruba o servidor completamente. Migrações de banco precisariam ser feitas manualmente no arquivo SQLite. Não há separação entre ambiente de dev e produção além das variáveis de ambiente.
4. **Evolução** — Seria necessário trocar SQLite por um banco com replicação (PostgreSQL, MySQL). Adicionar um load balancer na frente de múltiplas instâncias. Implementar sessões distribuídas ou manter JWT stateless como está. O maior obstáculo é o estado centralizado no arquivo SQLite.