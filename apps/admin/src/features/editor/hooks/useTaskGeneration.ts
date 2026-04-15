'use client';

import { useMutation } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';

export interface AiTestResult {
  score: number;
  feedback: string;
  reasoning: string;
  passed: boolean;
}

export function useGenerateTaskContent(gameId: string) {
  return useMutation<{ content: string }, Error, {
    type: 'description' | 'hints' | 'prompt';
    title?: string;
    description?: string;
    taskType?: string;
  }>({
    mutationFn: (params) =>
      api.post(`/api/admin/games/${gameId}/generate-task-content`, params),
  });
}

export function useTestAiPrompt() {
  return useMutation<AiTestResult, Error, {
    prompt: string;
    testAnswer: string;
    threshold: number;
    taskType: string;
  }>({
    mutationFn: (params) =>
      api.post('/api/admin/ai/test-prompt', params),
  });
}
