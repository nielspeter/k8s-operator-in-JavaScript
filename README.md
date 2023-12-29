An Example K8s Operator written in TypeScript.

This cloned repro is a K8s version of the OpenShift version. [Developing OpenShift Operators in JavaScript/TypeScript](https://www.openshift.com/blog/developing-openshift-operators-in-javascript/typescript)

# Getting Started

To get started, start by creating all the K8s resources:

```bash
kubectl apply -k resources
```

This will create the `ts-operator` namespace and populate it with a Deployment running the operator.

It will also create the `Memcached` Custom Resource Definition and the `memcached-editor` Role.

Move to the `ts-operator` namespace:

```bash
kubectl config set-context --current --namespace=ts-operator
```

Tail the logs of the operator by running:

```bash
kubectl logs -f deployment/ts-operator
```

In a different terminal, create an instance of the CRD by running:

```bash
kubectl create -f resources/memcached-sample.yaml
```

You will see a new Deployment called `memcached-sample` with pods starting.

Now modify the size property in your Custom Resource:

```bash
kubectl edit memcached memcached-sample
```

Replace the size value from 2 to 4, then save. You will see the size of your deployment go from 2 to 4 and new pods starting.

# Cleaning up

You can delete all the resources created earlier by running:

```bash
kubectl delete -k resources
```
