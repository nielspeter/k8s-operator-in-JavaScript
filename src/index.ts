/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as k8s from "@kubernetes/client-node";
import * as fs from "fs";

//process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";
const MEMCACHED_GROUP = "cache.example.com";
const MEMCACHED_VERSION = "v1";
const MEMCACHED_PLURAL = "memcacheds";
interface MemcachedSpec {
  size: number;
}
interface MemcachedStatus {
  pods: string[];
}
interface Memcached {
  apiVersion: string;
  kind: string;
  metadata: k8s.V1ObjectMeta;
  spec?: MemcachedSpec;
  status?: MemcachedStatus;
}

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(k8s.AppsV1Api);
const k8sApiMC = kc.makeApiClient(k8s.CustomObjectsApi);
const k8sApiPods = kc.makeApiClient(k8s.CoreV1Api);

const namespace = "ts-operator";
const deploymentTemplate = fs.readFileSync("memcached-deployment.json", "utf-8");
const watch = new k8s.Watch(kc);

async function onEvent(phase: string, apiObj: any) {
  log(`Received event in phase ${phase}.`);
  if (phase == "ADDED") {
    reconcileInOneSecond(apiObj);
  } else if (phase == "MODIFIED") {
    reconcileInOneSecond(apiObj);
  } else if (phase == "DELETED") {
    await deleteResource(apiObj);
  } else {
    log(`Unknown event type: ${phase}`);
  }
}

async function deleteResource(obj: Memcached) {
  log(`Deleted ${obj.metadata.name}`);
  return k8sApi.deleteNamespacedDeployment(obj.metadata.name!, namespace);
}

function onDone(err: any) {
  log(`Connection closed. ${err}`);
  watchResource();
}

async function watchResource(): Promise<any> {
  log("Watching API");
  return watch.watch("/apis/cache.example.com/v1/memcacheds", {}, onEvent, onDone);
}

let reconcileScheduled = false;

function reconcileInOneSecond(obj: Memcached) {
  if (!reconcileScheduled) {
    setTimeout(reconcileNow, 1000, obj);
    reconcileScheduled = true;
  }
}

async function reconcileNow(obj: Memcached) {
  reconcileScheduled = false;
  const deploymentName: string = obj.metadata.name!;
  //check if deployment exists. Create it if it doesn't.
  try {
    const response = await k8sApi.readNamespacedDeployment(deploymentName, namespace);
    //patch the deployment
    const deployment: k8s.V1Deployment = response.body;
    deployment.spec!.replicas = obj.spec!.size;
    k8sApi.replaceNamespacedDeployment(deploymentName, namespace, deployment);
  } catch (err) {
    //Create the deployment
    const newDeployment: k8s.V1Deployment = JSON.parse(deploymentTemplate);
    newDeployment.metadata!.name = deploymentName;
    newDeployment.spec!.replicas = obj.spec!.size;
    newDeployment.spec!.selector!.matchLabels!["deployment"] = deploymentName;
    newDeployment.spec!.template!.metadata!.labels!["deployment"] = deploymentName;
    k8sApi.createNamespacedDeployment(namespace, newDeployment);
  }
  //set the status of our resource to the list of pod names.
  const status: Memcached = {
    apiVersion: obj.apiVersion,
    kind: obj.kind,
    metadata: {
      name: obj.metadata.name!,
      resourceVersion: obj.metadata.resourceVersion,
    },
    status: {
      pods: await getPodList(`deployment=${obj.metadata.name}`),
    },
  };

  k8sApiMC.replaceNamespacedCustomObjectStatus(
    MEMCACHED_GROUP,
    MEMCACHED_VERSION,
    namespace,
    MEMCACHED_PLURAL,
    obj.metadata.name!,
    status,
  );
}
async function getPodList(podSelector: string): Promise<string[]> {
  try {
    const podList = await k8sApiPods.listNamespacedPod(
      namespace,
      undefined,
      undefined,
      undefined,
      undefined,
      podSelector,
    );
    return podList.body.items.map((pod) => pod.metadata!.name!);
  } catch (err) {
    log(err);
  }
  return [];
}

async function main() {
  await watchResource();
}

function log(message: string) {
  console.log(`${new Date().toLocaleString()}: ${message}`);
}

main();