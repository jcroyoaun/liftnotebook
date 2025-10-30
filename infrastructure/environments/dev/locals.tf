locals {
  region = "us-east-1"
  env    = "production"

  # DNS configuration
  dns = {
    subdomain             = "liftnotebook"  # or whatever subdomain you want
    parent_domain         = "jcroyoaun.com"
    parent_hosted_zone_id = "Z0018433153XTHTE2Z3K1"
  }

  # ECR repositories
  ecr = {
    repositories = {
      exerciselib = {
        image_tag_mutability = "MUTABLE"
        scan_on_push        = true
      }
      frontend = {
        image_tag_mutability = "MUTABLE"
        scan_on_push        = true
      }
    }
  }

  # VPC configuration
  vpc = {
    cidr           = "10.0.0.0/16"
    public_subnets = ["10.0.0.0/24", "10.0.1.0/24"]
    azs            = ["a", "b"]
    
    private_subnets = {
      private_1 = { cidr = "10.0.16.0/20", az = "a" }
      private_2 = { cidr = "10.0.32.0/20", az = "b" }
    }

    # Isolated subnets for databases
    create_isolated_subnets = true
    isolated_subnet_cidrs   = ["10.0.128.0/24", "10.0.129.0/24"]
  }

  # EKS configuration
  eks = {
    cluster_name       = "${local.env}-liftnotebook-cluster"
    kubernetes_version = "1.33"
    
    node_group = {
      name           = "initial"
      instance_types = ["t3.medium"]  # Adjust as needed
      capacity_type  = "ON_DEMAND"    # or SPOT for cheaper
      scaling_config = {
        desired_size = 2
        max_size     = 4
        min_size     = 1
      }
      disk_size = 50
    }
    
    cluster_admin_arns = [
      "arn:aws:iam::443311183770:user/iamadmin",
      "arn:aws:iam::443311183770:role/Github-Actions-Runner-OIDC"
    ]
    
    addon_versions = {
      "coredns"                = "v1.11.4-eksbuild.2"
      "vpc-cni"                = "v1.19.2-eksbuild.1"
      "kube-proxy"             = "v1.32.0-eksbuild.2"
      "eks-pod-identity-agent" = "v1.3.4-eksbuild.1"
    }
    
    helm_chart_versions = {
      aws_load_balancer_controller = "1.10.1"
      external_dns                 = "1.15.0"
    }
  }
}
