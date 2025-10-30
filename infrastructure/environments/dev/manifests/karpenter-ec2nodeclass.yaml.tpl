apiVersion: karpenter.k8s.aws/v1
kind: EC2NodeClass
metadata:
  name: default-amd64
spec:
  amiFamily: AL2023
  role: ${karpenter_role}
  subnetSelectorTerms:
    - tags:
        karpenter.sh/discovery: ${discovery_tag}
  securityGroupSelectorTerms:
    - tags:
        karpenter.sh/discovery: ${discovery_tag}
