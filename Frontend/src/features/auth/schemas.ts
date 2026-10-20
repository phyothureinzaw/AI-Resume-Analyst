import { z } from 'zod';
export const registerFormSchema = z.object({ fullName: z.string().trim().min(1, 'Enter your full name.').max(120, 'Use 120 characters or fewer.'), email: z.string().trim().email('Enter a valid email address.').max(254, 'Use 254 characters or fewer.'), password: z.string().min(12, 'Use at least 12 characters.').max(128, 'Use 128 characters or fewer.'), confirmPassword: z.string() }).refine((data) => data.password === data.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match.' });
export const loginFormSchema = z.object({ email: z.string().trim().email('Enter a valid email address.').max(254, 'Use 254 characters or fewer.'), password: z.string().min(1, 'Enter your password.') });
export type RegisterForm = z.infer<typeof registerFormSchema>;
export type LoginForm = z.infer<typeof loginFormSchema>;
