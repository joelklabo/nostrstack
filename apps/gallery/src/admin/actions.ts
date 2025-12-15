import { appSchema } from './schema';

// Mock Server Action
export async function upsertAppAction(
  prevState: { success: boolean; error?: string } | null,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const result = appSchema.safeParse({
    name: formData.get('name'),
  });

  if (!result.success) {
    return { success: false, error: result.error.errors[0].message };
  }

  // Simulate "after" task (non-blocking logging)
  setTimeout(() => {
    console.log('[Telemetry] App updated:', result.data.name);
  }, 0);

  // Simulate success
  return { success: true };
}
