# Deploy no Servidor i5 (Docker Swarm single-node)

## 1. Proteção do SSD — rotação de logs (OBRIGATÓRIO antes do primeiro deploy)

O disco de **128GB** enche rápido com logs ilimitados. Configure o Docker globalmente:

```bash
# Linux (servidor)
sudo mkdir -p /etc/docker
sudo cp daemon.json /etc/docker/daemon.json
sudo systemctl restart docker
```

Efeito: cada container fica limitado a 3 arquivos de 10MB (~30MB por serviço, máximo).

## 2. Subir a stack

```bash
docker swarm init                      # se ainda não inicializado
cp .env.production.example .env.production   # edite com JWT_SECRET etc.
docker stack deploy -c docker-stack.yml chef
```

Para adicionar um segundo notebook ao cluster no futuro:

```bash
# No novo nó:
docker swarm join --token <token> <IP-DO-I5>:2377
# Depois: docker service scale chef_api=2  (requer volume compartilhado/NFS ou PG)
```

## 3. Mídia (fotos do cardápio)

**Proibido salvar imagens no SSD local.** Produtos usam `foto_url` (link externo).
Hospede em Cloudflare R2 / S3 e cole a URL pública no cadastro do produto.
Aparece apenas no cardápio digital do cliente; garçom/PDV continuam com emoji.

## 4. Upsell Offline-First

1. Super Admin → Restaurantes → **Chaves de Ativação** → informe o nó (ex: `NOTEBOOK-I5`) → Gerar.
2. Cliente usa a chave no cadastro (`CC-OFF-NOTEBO-a1b2c3d4e5`).
3. O restaurante nasce com `offline_habilitado=1` e `servidor_node` gravados.
4. Dispositivos desse cliente salvam pedidos no IndexedDB sem internet e sincronizam sozinhos.

## 5. Otimizações ativas no servidor (sem ação necessária)

| Ajuste | Efeito |
|---|---|
| `pingInterval: 15000` / `pingTimeout: 10000` | Conexões mortas liberadas em ~25s (RAM) |
| `perMessageDeflate: { threshold: 1024 }` | JSONs grandes encolhem ~70–90% no fio |
| Evento `mesa_delta` | Só a mesa alterada trafega a cada pedido, não a lista inteira |
