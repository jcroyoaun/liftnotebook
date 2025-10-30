locals {
  region = "us-east-1"
  env    = "dev"

  # DNS configuration
  dns = {
    subdomain             = "liftnotebook"
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
      cevichedbsync = {
        image_tag_mutability = "MUTABLE"
        scan_on_push        = true
      }
    }
  }

  # VPC configuration
  vpc = {
    cidr           = "10.24.0.0/16"
    public_subnets = ["10.24.0.0/24", "10.24.1.0/24"]
    azs            = ["a", "b"]
    
    private_subnets = {
      private_1 = { cidr = "10.24.16.0/20", az = "a" }
      private_2 = { cidr = "10.24.32.0/20", az = "b" }
    }

    # Isolated subnets for databases
    create_isolated_subnets = true
    isolated_subnet_cidrs   = ["10.24.48.0/24", "10.24.49.0/24"]
  }

  # EKS configuration
  eks = {
    cluster_name       = "${local.env}-eks-cluster"
    kubernetes_version = "1.34"
    
    node_group = {
      name           = "initial"
      instance_types = ["t3a.medium","t3a.large"]
      capacity_type  = "SPOT"
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
      "aws-ebs-csi-driver"     = "v1.32.0-eksbuild.1"
    }
    
    helm_chart_versions = {
      aws_load_balancer_controller = "1.10.1"
      external_dns                 = "1.15.0"
    }

    # Karpenter configuration
    karpenter = {
      enabled   = true
      version   = "1.8.1"
      namespace = "kube-system"
    }

    helm_charts = {
      metrics_server = {
        repository     = "https://kubernetes-sigs.github.io/metrics-server"
        chart          = "metrics-server"
        version        = "3.12.2"
        namespace      = "kube-system"
        values_content = yamlencode({
          defaultArgs = [
            "--cert-dir=/tmp",
            "--kubelet-preferred-address-types=InternalIP,ExternalIP,Hostname",
            "--kubelet-use-node-status-port",
            "--metric-resolution=15s",
            "--secure-port=10250"
          ]
        })
      }
      
      kube_prometheus_stack = {
        repository     = "https://prometheus-community.github.io/helm-charts"
        chart          = "kube-prometheus-stack"
        version        = "67.4.0"
        namespace      = "monitoring"
        create_namespace = true
        values_content = yamlencode({
          prometheus = {
            prometheusSpec = {
              retention = "15d"
              storageSpec = {
                volumeClaimTemplate = {
                  spec = {
                    storageClassName = "gp3"
                    accessModes      = ["ReadWriteOnce"]
                    resources = {
                      requests = {
                        storage = "50Gi"
                      }
                    }
                  }
                }
              }
              resources = {
                requests = {
                  cpu    = "500m"
                  memory = "2Gi"
                }
                limits = {
                  cpu    = "1000m"
                  memory = "4Gi"
                }
              }
            }
          }
          
          grafana = {
            enabled = true
            adminPassword = "CHANGEME"  # TODO: Move to secrets
            
            ingress = {
              enabled = true
              ingressClassName = "alb"
              annotations = {
                "alb.ingress.kubernetes.io/scheme"                    = "internet-facing"
                "alb.ingress.kubernetes.io/target-type"               = "ip"
                "alb.ingress.kubernetes.io/listen-ports"              = jsonencode([{HTTPS = 443}])
                "external-dns.alpha.kubernetes.io/hostname"           = "grafana.liftnotebook.jcroyoaun.com"
              }
              hosts = ["grafana.liftnotebook.jcroyoaun.com"]
            }
            
            persistence = {
              enabled          = true
              storageClassName = "gp3"
              size             = "10Gi"
            }
            
            resources = {
              requests = {
                cpu    = "100m"
                memory = "256Mi"
              }
              limits = {
                cpu    = "200m"
                memory = "512Mi"
              }
            }
          }
          
          alertmanager = {
            enabled = false  # Enable later when you set up alerts
          }
          
          # Enable service monitors for your apps
          prometheus-node-exporter = {
            enabled = true
          }
          
          kube-state-metrics = {
            enabled = true
          }
        })
      }
    }
  }


  k8s_manifests = {
  storageclass_gp3 = { # <-- ADD THIS BLOCK
        file_path = "${path.module}/manifests/storageclass-gp3.yaml"
        vars      = {}
      }
    karpenter_nodepool = {
      file_path = "${path.module}/manifests/karpenter-nodepool.yaml.tpl"
      vars = {
        cluster_name = local.eks.cluster_name
      }
    }
    karpenter_ec2nodeclass = {
      file_path = "${path.module}/manifests/karpenter-ec2nodeclass.yaml.tpl"
      vars = {
        cluster_name   = local.eks.cluster_name
        karpenter_role = module.eks.karpenter_node_role_name
        discovery_tag  = local.eks.cluster_name
      }
    }
  }
}