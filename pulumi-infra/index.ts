import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as eks from "@pulumi/eks";

const config = new pulumi.Config();
const projectName = "chatbot";
const env = pulumi.getStack(); // dev, staging, prod

// ─────────────────────────────────────────
// VPC
// ─────────────────────────────────────────
const vpc = new awsx.ec2.Vpc(`${projectName}-vpc`, {
  cidrBlock: "10.0.0.0/16",
  numberOfAvailabilityZones: 2,
  natGateways: { strategy: "Single" },
  tags: { Name: `${projectName}-vpc-${env}`, Environment: env },
});

// ─────────────────────────────────────────
// ECR — um repositório por serviço
// ─────────────────────────────────────────
const services = [
  "chatbot-auth-service",
  "chatbot-bot-service",
  "chatbot-webhook-service",
  "chatbot-lambda-gateway",
  "chatbot-zapi-service",
];

const ecrRepos: Record<string, aws.ecr.Repository> = {};

for (const svc of services) {
  ecrRepos[svc] = new aws.ecr.Repository(`${svc}`, {
    name: `${projectName}/${svc}`,
    imageTagMutability: "MUTABLE",
    imageScanningConfiguration: { scanOnPush: true },
    forceDelete: true,
    tags: { Environment: env },
  });

  // Lifecycle policy: manter apenas as últimas 10 imagens
  new aws.ecr.LifecyclePolicy(`${svc}-lifecycle`, {
    repository: ecrRepos[svc].name,
    policy: JSON.stringify({
      rules: [{
        rulePriority: 1,
        description: "Keep last 10 images",
        selection: { tagStatus: "any", countType: "imageCountMoreThan", countNumber: 10 },
        action: { type: "expire" },
      }],
    }),
  });
}

// ─────────────────────────────────────────
// RDS — PostgreSQL
// ─────────────────────────────────────────
const dbSubnetGroup = new aws.rds.SubnetGroup(`${projectName}-db-subnet`, {
  subnetIds: vpc.privateSubnetIds,
  tags: { Name: `${projectName}-db-subnet-${env}` },
});

const dbSecurityGroup = new aws.ec2.SecurityGroup(`${projectName}-db-sg`, {
  vpcId: vpc.vpcId,
  ingress: [{
    protocol: "tcp",
    fromPort: 5432,
    toPort: 5432,
    cidrBlocks: ["10.0.0.0/16"], // apenas dentro da VPC
  }],
  egress: [{
    protocol: "-1",
    fromPort: 0,
    toPort: 0,
    cidrBlocks: ["0.0.0.0/0"],
  }],
  tags: { Name: `${projectName}-db-sg-${env}` },
});

const dbPassword = config.requireSecret("dbPassword");

const rds = new aws.rds.Instance(`${projectName}-postgres`, {
  engine: "postgres",
  engineVersion: "15.10",
  instanceClass: "db.t3.micro",
  allocatedStorage: 20,
  maxAllocatedStorage: 100,
  storageType: "gp2",
  dbName: "chatbot_manager",
  username: "chatbot",
  password: dbPassword,
  dbSubnetGroupName: dbSubnetGroup.name,
  vpcSecurityGroupIds: [dbSecurityGroup.id],
  multiAz: false,
  skipFinalSnapshot: env !== "prod",
  deletionProtection: env === "prod",
  backupRetentionPeriod: env === "prod" ? 7 : 1,
  tags: { Name: `${projectName}-postgres-${env}`, Environment: env },
});

// ─────────────────────────────────────────
// EKS
// ─────────────────────────────────────────
const cluster = new eks.Cluster(`${projectName}-eks`, {
  vpcId: vpc.vpcId,
  privateSubnetIds: vpc.privateSubnetIds,
  publicSubnetIds: vpc.publicSubnetIds,
  instanceType: "t3.medium",
  desiredCapacity: 2,
  minSize: 1,
  maxSize: 5,
  nodeAssociatePublicIpAddress: false,
  enabledClusterLogTypes: ["api", "audit", "authenticator"],
  tags: { Environment: env },
});

// ─────────────────────────────────────────
// Outputs
// ─────────────────────────────────────────
export const vpcId = vpc.vpcId;
export const kubeconfig = pulumi.secret(cluster.kubeconfig);
export const clusterName = cluster.core.cluster.name;
export const rdsEndpoint = rds.endpoint;
export const ecrUrls = Object.fromEntries(
  Object.entries(ecrRepos).map(([svc, repo]) => [svc, repo.repositoryUrl])
);
