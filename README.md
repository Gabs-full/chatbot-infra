# Chatbot Infrastructure

Infraestrutura completa para os microserviços do Chatbot Manager na AWS.

## Estrutura

```
chatbot-k8s/
├── .github/
│   └── workflows/
│       └── ci-cd.yaml          # GitHub Actions CI/CD
├── argocd/
│   └── applications.yaml       # ArgoCD Applications
├── dockerfiles/
│   └── Dockerfile              # Dockerfile base para serviços Python
├── manifests/
│   ├── namespace-secrets.yaml  # Namespace + Secrets
│   ├── ingress.yaml            # Ingress Controller
│   ├── chatbot-auth-service.yaml
│   ├── chatbot-bot-service.yaml
│   ├── chatbot-webhook-service.yaml
│   ├── chatbot-lambda-gateway.yaml
│   └── chatbot-zapi-service.yaml
pulumi-infra/
├── index.ts                    # Infra AWS (VPC, EKS, ECR, RDS)
├── package.json
├── tsconfig.json
├── Pulumi.yaml
└── Pulumi.dev.yaml
```

## Ordem de Setup

### 1. Subir infra com Pulumi
```bash
cd pulumi-infra
npm install
pulumi config set --secret dbPassword SUA_SENHA
pulumi stack init dev
pulumi up
```

### 2. Configurar kubectl
```bash
pulumi stack output kubeconfig --show-secrets > ~/.kube/config
```

### 3. Instalar ArgoCD no cluster
```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

### 4. Instalar Headlamp
```bash
helm repo add headlamp https://headlamp-k8s.github.io/headlamp/
helm install headlamp headlamp/headlamp -n headlamp --create-namespace
```

### 5. Instalar NGINX Ingress
```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install ingress-nginx ingress-nginx/ingress-nginx -n ingress-nginx --create-namespace
```

### 6. Aplicar manifests
```bash
# Preencher namespace-secrets.yaml com os valores reais antes!
kubectl apply -f manifests/namespace-secrets.yaml
kubectl apply -f manifests/
```

### 7. Aplicar ArgoCD Applications
```bash
# Alterar SEU_ORG no applications.yaml antes!
kubectl apply -f argocd/applications.yaml
```

### 8. Configurar GitHub Actions Secrets
No repositório do GitHub, adicionar:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_ACCOUNT_ID`

## Fluxo GitOps

```
Push no GitHub
  → GitHub Actions builda a imagem Docker
  → Push no ECR com tag do commit
  → Atualiza o manifest com a nova tag
  → ArgoCD detecta a mudança no Git
  → ArgoCD faz o deploy automático no EKS
  → Headlamp para visualizar o cluster
```

## Acessar o ArgoCD
```bash
kubectl port-forward svc/argocd-server -n argocd 8080:443
# Senha inicial:
kubectl get secret argocd-initial-admin-secret -n argocd -o jsonpath="{.data.password}" | base64 -d
```

## Acessar o Headlamp
```bash
kubectl port-forward svc/headlamp -n headlamp 4466:80
# Acesse: http://localhost:4466
```
