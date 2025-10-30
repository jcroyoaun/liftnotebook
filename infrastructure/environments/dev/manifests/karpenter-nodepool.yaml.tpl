apiVersion: karpenter.sh/v1
kind: NodePool
metadata:
  name: general-amd64
spec:
  template:
    spec:
      nodeClassRef:
        group: karpenter.k8s.aws
        kind: EC2NodeClass
        name: general-amd64
      requirements:
        - key: karpenter.sh/capacity-type
          operator: In
          values: ["spot"]
        - key: karpenter.k8s.aws/instance-generation
          operator: Gt
          values: ["5"]
  limits:
    cpu: "100"
    memory: "100Gi"
  disruption:
    consolidationPolicy: WhenEmptyOrUnderutilized
    consolidateAfter: 1m
