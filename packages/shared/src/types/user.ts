export enum UserRole {
  PLAYER = 'PLAYER',
  ADMIN = 'ADMIN',
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  role: UserRole;
  pushToken?: string;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  displayName: string;
}

export interface UserListItem {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  role: UserRole;
  createdAt: string;
}

export interface UpdateUserRoleDto {
  role: UserRole;
}
