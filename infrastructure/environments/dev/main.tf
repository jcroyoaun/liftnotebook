data "aws_caller_identity" "current" {}

# DNS Module
module "dns" {
  source = "git::https://github.com/jcroyoaun/terraform-aws-modules.git//modules/dns?ref=v1.0.0"

  subdomain             = local.dns.subdomain
  parent_domain         = local.dns.parent_domain
  parent_hosted_zone_id = local.dns.parent_hosted_zone_id
  env                   = local.env
}

# ECR Module
module "ecr" {
  source = "git::https://github.com/jcroyoaun/terraform-aws-modules.git//modules/ecr?ref=v1.0.0"

  env          = local.env
  repositories = local.ecr.repositories
}

# VPC Module
module "vpc" {
  source = "git::https://github.com/jcroyoaun/terraform-aws-modules.git//modules/vpc?ref=v1.0.0"

  region                  = local.region
  vpc_cidr                = local.vpc.cidr
  env                     = local.env
  azs                     = local.vpc.azs
  public_subnets          = local.vpc.public_subnets
  private_subnets         = local.vpc.private_subnets
  create_isolated_subnets = local.vpc.create_isolated_subnets
  isolated_subnet_cidrs   = local.vpc.isolated_subnet_cidrs
  cluster_name            = local.eks.cluster_name
}

# EKS Module
module "eks" {
  source = "git::https://github.com/jcroyoaun/terraform-aws-modules.git//modules/eks?ref=v1.0.4"

  region              = local.region
  env                 = local.env
  cluster_name        = local.eks.cluster_name
  vpc_id              = module.vpc.vpc_id
  private_subnet_ids  = module.vpc.private_subnet_ids
  public_subnet_ids   = module.vpc.public_subnet_ids
  kubernetes_version  = local.eks.kubernetes_version
  
  node_group_name     = local.eks.node_group.name
  node_instance_types = local.eks.node_group.instance_types
  node_capacity_type  = local.eks.node_group.capacity_type
  node_scaling_config = local.eks.node_group.scaling_config
  node_disk_size      = local.eks.node_group.disk_size
  
  cluster_admin_arns  = local.eks.cluster_admin_arns
  addon_versions      = local.eks.addon_versions
  helm_chart_versions = local.eks.helm_chart_versions
  
  external_dns_domain_filters   = [module.dns.external_dns_domain_filter]
  external_dns_hosted_zone_arns = [module.dns.external_dns_hosted_zone_arn]

  enable_karpenter    = local.eks.karpenter.enabled
  karpenter_version   = local.eks.karpenter.version
  karpenter_namespace = local.eks.karpenter.namespace

}

module "k8s_manifests" {
  source = "git::https://github.com/jcroyoaun/terraform-aws-modules.git//modules/k8s-manifests?ref=v1.0.5"

  manifests = local.k8s_manifests

  cluster_ready_dependency = [
    module.eks.cluster_id,
    module.eks.karpenter_node_role_arn
  ]
}
