import { z } from 'zod';

export const appSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
});
