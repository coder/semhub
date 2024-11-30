export type TypedWorkflow<T> = Omit<Workflow, "create"> & {
  create(
    options?: Omit<WorkflowInstanceCreateOptions, "params"> & { params?: T },
  ): Promise<WorkflowInstance>;
};
