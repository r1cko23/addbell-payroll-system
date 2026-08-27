/** Legacy projects catalog delete — retired. */
export async function deleteProject(_projectId: string): Promise<void> {
  throw new Error(
    "Project catalog delete is retired. Manage jobs from Operations → Projects."
  );
}
