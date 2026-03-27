export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
}

export interface PresignedUrlResponse {
  uploadUrl: string;
  fileUrl: string;
  key: string;
}

export interface SystemInfo {
  userCount: number;
  gameCount: number;
  sessionCount: number;
  activeSessionCount: number;
  dbHealthy: boolean;
  version: string;
}
