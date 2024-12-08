// params sent over RPC will be converted to string
type ParamsRPC = string | { [key: string]: ParamsRPC } | ParamsRPC[];
// cannot send classes with methods (?) over RPC, so must write substitute methods
export interface WorkflowRPC<T extends ParamsRPC = ParamsRPC, E = unknown> {
  fetch(request: Request, env?: E): Promise<Response>;
  create(
    options?: Omit<WorkflowInstanceCreateOptions, "params"> & { params?: T },
    env?: E,
  ): Promise<WorkflowInstance["id"]>;
  terminate(id: string, env?: E): Promise<void>;
  getInstanceStatus(id: string, env?: E): Promise<InstanceStatus>;
}

export function chunkArray<T>(array: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(array.length / size) }, (_, index) =>
    array.slice(index * size, (index + 1) * size),
  );
}

export function getApproximateSizeInBytes(obj: unknown) {
  return new TextEncoder().encode(JSON.stringify(obj)).length;
}
