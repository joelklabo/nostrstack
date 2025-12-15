// Mock Server Action
export async function upsertAppAction(
  prevState: { success: boolean; error?: string } | null,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const name = formData.get('name');
  if (!name || typeof name !== 'string' || name.length < 3) {
    return { success: false, error: 'Name must be at least 3 characters' };
  }

  // Simulate success
  return { success: true };
}
