// 兼容层：保留旧导入路径，新的实例传输入口请使用 ./instanceTransport
export {
  requestViaInstance as requestWithInstance,
  type InstanceRequestOptions as ApiRequestOptions,
} from "./instanceRequestRouter";
