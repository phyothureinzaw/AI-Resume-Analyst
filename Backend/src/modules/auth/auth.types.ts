export type UserRow = {
  id: string;
  full_name: string;
  email: string;
  password_hash: string;
  created_at: Date;
};

export type SafeUser = {
  id: string;
  fullName: string;
  email: string;
  createdAt: string;
};

export type AuthRepository = {
  findUserByEmail: (email: string) => Promise<UserRow | null>;
  createUser: (fullName: string, email: string, passwordHash: string) => Promise<UserRow>;
  createSession: (userId: string, tokenHash: string, expiresAt: Date) => Promise<void>;
  findUserBySessionHash: (tokenHash: string) => Promise<UserRow | null>;
  revokeSession: (tokenHash: string) => Promise<void>;
};
