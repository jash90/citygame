'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Loader2 } from 'lucide-react';
import { api } from '@/shared/lib/api';
import type { Task, CreateTaskDto } from '@citygame/shared';
import { TaskList } from '@/features/editor/components/TaskList';
import { TaskEditorForm } from '@/features/editor/components/TaskEditorForm';

type EditorMode = 'select' | 'create' | 'edit';

export default function TasksPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const queryClient = useQueryClient();

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [mode, setMode] = useState<EditorMode>('select');

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ['tasks', gameId],
    queryFn: () => api.get<Task[]>(`/api/admin/games/${gameId}/tasks`),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateTaskDto) =>
      api.post<Task>(`/api/admin/games/${gameId}/tasks`, data),
    onSuccess: (newTask) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', gameId] });
      setSelectedTask(newTask);
      setMode('edit');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<CreateTaskDto>) =>
      api.patch<Task>(`/api/admin/games/${gameId}/tasks/${selectedTask!.id}`, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', gameId] });
      setSelectedTask(updated);
    },
  });

  const handleSubmit = (data: CreateTaskDto) => {
    if (mode === 'create') {
      createMutation.mutate(data);
    } else if (mode === 'edit' && selectedTask) {
      updateMutation.mutate(data);
    }
  };

  const handleSelectTask = (task: Task) => {
    setSelectedTask(task);
    setMode('edit');
  };

  const handleNew = () => {
    setSelectedTask(null);
    setMode('create');
  };

  const handleCancel = () => {
    setMode(selectedTask ? 'edit' : 'select');
    if (mode === 'create') setSelectedTask(null);
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/games/${gameId}`}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft size={16} />
            Wróć do gry
          </Link>
          <span className="text-gray-300">/</span>
          <h2 className="text-lg font-bold text-gray-900">Edytor zadań</h2>
        </div>

        <button
          onClick={handleNew}
          className="flex items-center gap-2 px-4 py-2 bg-[#FF6B35] text-white text-sm font-semibold rounded-lg hover:bg-[#e55a26] transition-colors shadow-sm"
        >
          <Plus size={16} />
          Nowe zadanie
        </button>
      </div>

      {/* Split view */}
      <div className="flex flex-1 gap-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden min-h-[600px]">
        {/* Left: task list */}
        <div className="w-80 flex-shrink-0 border-r border-gray-200 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">
              Zadania ({tasks.length})
            </span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center flex-1 text-gray-400">
              <Loader2 size={20} className="animate-spin mr-2" />
              Ładowanie...
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <TaskList
                tasks={tasks}
                selectedTaskId={selectedTask?.id ?? null}
                onSelect={handleSelectTask}
              />
            </div>
          )}
        </div>

        {/* Right: editor */}
        <div className="flex-1 overflow-hidden">
          {mode === 'select' ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
              <p className="text-sm">Wybierz zadanie z listy lub utwórz nowe</p>
              <button
                onClick={handleNew}
                className="flex items-center gap-2 px-4 py-2 text-sm border-2 border-dashed border-gray-300 rounded-lg hover:border-[#FF6B35] hover:text-[#FF6B35] transition-colors"
              >
                <Plus size={16} />
                Dodaj pierwsze zadanie
              </button>
            </div>
          ) : (
            <TaskEditorForm
              key={selectedTask?.id ?? 'new'}
              task={mode === 'edit' ? selectedTask : null}
              gameId={gameId}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              isSubmitting={isSubmitting}
            />
          )}
        </div>
      </div>
    </div>
  );
}
