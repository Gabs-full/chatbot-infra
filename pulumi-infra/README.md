# Chatbot Infra — Pulumi

## Pré-requisitos
- [Pulumi CLI](https://www.pulumi.com/docs/install/)
- [AWS CLI](https://aws.amazon.com/cli/) configurado
- Node.js 18+

## Setup inicial

```bash
# Instalar dependências
npm install

# Login no Pulumi (ou use pulumi login --local para local)
pulumi login

# Configurar secret da senha do banco
pulumi config set --secret dbPassword SUA_SENHA_AQUI

# Criar o stack dev
pulumi stack init dev
```

## Subir a infra

```bash
# Preview do que vai ser criado
pulumi preview

# Aplicar
pulumi up
```

## Outputs após o deploy

| Output | Descrição |
|--------|-----------|
| `vpcId` | ID da VPC |
| `clusterName` | Nome do cluster EKS |
| `kubeconfig` | Kubeconfig para acessar o cluster |
| `rdsEndpoint` | Endpoint do PostgreSQL |
| `ecrUrls` | URLs dos repositórios ECR por serviço |

## Pegar o kubeconfig

```bash
pulumi stack output kubeconfig --show-secrets > ~/.kube/config
```

## Destruir a infra

```bash
pulumi destroy
```

## Stacks

- `dev` — ambiente de desenvolvimento
- `staging` — homologação
- `prod` — produção (com deletion protection no RDS)
