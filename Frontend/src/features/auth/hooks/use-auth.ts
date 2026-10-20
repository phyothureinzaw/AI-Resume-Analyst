import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCurrentUser, login, logout, register } from '../api/auth';
import type { LoginForm, RegisterForm } from '../schemas';
export const authQueryKey = ['auth', 'me'];
export function useCurrentUser() { return useQuery({ queryKey: authQueryKey, queryFn: ({ signal }) => getCurrentUser(signal), retry: false, staleTime: 60_000, refetchOnMount: false, refetchOnWindowFocus: false, refetchOnReconnect: false }); }
export function useAuthMutations() { const queryClient = useQueryClient(); const signIn = useMutation({ mutationFn: (input: LoginForm) => login(input), onSuccess: (data) => { queryClient.setQueryData(authQueryKey, data); } }); const signUp = useMutation({ mutationFn: (input: RegisterForm) => register({ fullName: input.fullName, email: input.email, password: input.password }) }); const signOut = useMutation({ mutationFn: logout, onSuccess: async () => { await queryClient.cancelQueries({ queryKey: authQueryKey }); queryClient.removeQueries({ queryKey: authQueryKey }); } }); return { signIn, signUp, signOut }; }
