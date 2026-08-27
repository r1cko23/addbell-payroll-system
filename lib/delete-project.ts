/** Legacy projects catalog delete — retired. */
export async function deleteProjectWithDependencies(
  _supabase: unknown,
  _projectId: string
): Promise<void> {
  throw new Error(
    "Project catalog delete is retired. Manage jobs from Operations → Projects."
  );
}
