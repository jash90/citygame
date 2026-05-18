'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import NextImage from 'next/image';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  ArrowLeft,
  Check,
  Image as ImageIcon,
  Loader2,
  Mic,
  Video as VideoIcon,
  ClipboardCheck,
} from 'lucide-react';
import { mentorApi } from '@/shared/lib/admin-api';

interface PendingAttempt {
  id: string;
  userId: string;
  taskId: string;
  createdAt: string;
  submission: Record<string, unknown>;
  user: { id: string; displayName: string; email: string };
  task: {
    id: string;
    title: string;
    description: string;
    type: string;
    maxPoints: number;
    verifyConfig: Record<string, unknown>;
    orderIndex: number;
  };
}

function SubmissionPreview({ task, submission }: { task: PendingAttempt['task']; submission: Record<string, unknown> }) {
  switch (task.type) {
    case 'AUDIO':
      return submission.audioUrl ? (
        <audio controls src={String(submission.audioUrl)} className="w-full" />
      ) : (
        <p className="text-xs text-gray-400">Brak audio</p>
      );
    case 'PHOTO':
      return submission.imageUrl ? (
        <NextImage
          src={String(submission.imageUrl)}
          alt="Zgłoszenie"
          width={500}
          height={500}
          unoptimized
          className="max-h-64 rounded-lg border border-gray-200"
          style={{ width: 'auto', height: 'auto' }}
        />
      ) : (
        <p className="text-xs text-gray-400">Brak zdjęcia</p>
      );
    case 'VIDEO':
      return submission.videoUrl ? (
        <video controls src={String(submission.videoUrl)} className="max-h-64 w-full rounded-lg" />
      ) : (
        <p className="text-xs text-gray-400">Brak wideo</p>
      );
    case 'PRACTICAL': {
      const requestedAt =
        typeof submission.requestedAt === 'string'
          ? submission.requestedAt
          : null;
      return (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center gap-2">
          <ClipboardCheck size={16} className="text-[#FF6B35]" />
          <p className="text-sm text-orange-900">
            Gracz wysłał prośbę o zatwierdzenie wykonania zadania
            {requestedAt
              ? ` (${new Date(requestedAt).toLocaleString('pl-PL')})`
              : ''}
            .
          </p>
        </div>
      );
    }
    default:
      return (
        <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-auto">
          {JSON.stringify(submission, null, 2)}
        </pre>
      );
  }
}

function TaskTypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'AUDIO': return <Mic size={14} className="text-gray-400" />;
    case 'PHOTO': return <ImageIcon size={14} className="text-gray-400" />;
    case 'VIDEO': return <VideoIcon size={14} className="text-gray-400" />;
    case 'PRACTICAL': return <ClipboardCheck size={14} className="text-gray-400" />;
    default: return null;
  }
}

function ReviewForm({ attempt, onSubmit, isPending }: {
  attempt: PendingAttempt;
  onSubmit: (data: { score: number; feedback: string }) => void;
  isPending: boolean;
}) {
  const [score, setScore] = useState(100);
  const [feedback, setFeedback] = useState('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ score, feedback });
      }}
      className="flex flex-col gap-3 pt-3 border-t border-gray-100"
    >
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1 block">
          Ocena: <span className="text-[#FF6B35]">{score}%</span>
          {' '}
          <span className="text-gray-400 font-normal">
            ({Math.round((score / 100) * attempt.task.maxPoints)} / {attempt.task.maxPoints} pkt)
          </span>
        </label>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={score}
          onChange={(e) => setScore(Number(e.target.value))}
          className="w-full accent-[#FF6B35]"
        />
        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
          <span>0% — odrzuć</span>
          <span>50% — częściowo</span>
          <span>100% — pełne</span>
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1 block">
          Feedback dla gracza
        </label>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={3}
          required
          placeholder="Krótkie uzasadnienie oceny (max 2000 znaków)…"
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35]"
        />
      </div>
      <button
        type="submit"
        disabled={isPending || feedback.trim().length === 0}
        className="self-start flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[#FF6B35] text-white rounded-lg hover:bg-[#e55a26] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Check size={14} />
        )}
        Wyślij ocenę
      </button>
    </form>
  );
}

export default function MentorQueuePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const queryClient = useQueryClient();

  const { data: attempts, isLoading, error } = useQuery({
    queryKey: ['mentor-pending', gameId],
    queryFn: () => mentorApi.getPendingAttempts(gameId),
    staleTime: 15_000,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ attemptId, score, feedback }: {
      attemptId: string;
      score: number;
      feedback: string;
    }) => mentorApi.reviewAttempt(attemptId, { score, feedback }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mentor-pending', gameId] });
      queryClient.invalidateQueries({ queryKey: ['mentor-games'] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500">
        <Loader2 size={24} className="animate-spin mr-2" />
        Ładowanie…
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-red-600 text-sm text-center">
        Nie udało się załadować kolejki recenzji.
      </div>
    );
  }

  const safeAttempts = (attempts ?? []) as PendingAttempt[];

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/mentor/dashboard"
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 mb-1 w-fit"
          >
            <ArrowLeft size={12} />
            Wszystkie gry
          </Link>
          <h2 className="text-xl font-bold text-gray-900">
            Kolejka recenzji
          </h2>
          <p className="text-sm text-gray-500">
            {safeAttempts.length === 0
              ? 'Brak zgłoszeń oczekujących na ocenę.'
              : `${safeAttempts.length} zgłoszeń do oceny`}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {safeAttempts.map((attempt) => {
          const criteria =
            typeof attempt.task.verifyConfig?.criteria === 'string'
              ? attempt.task.verifyConfig.criteria
              : null;

          return (
            <div
              key={attempt.id}
              className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                    <TaskTypeIcon type={attempt.task.type} />
                    <span>{attempt.task.type}</span>
                    <span>·</span>
                    <span>max {attempt.task.maxPoints} pkt</span>
                  </div>
                  <h3 className="text-base font-semibold text-gray-900">
                    {attempt.task.title}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Gracz:{' '}
                    <span className="font-medium text-gray-700">
                      {attempt.user.displayName}
                    </span>
                  </p>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(attempt.createdAt).toLocaleString('pl-PL')}
                </span>
              </div>

              {criteria && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                  <p className="text-xs font-semibold text-blue-800 mb-1">
                    Kryteria oceny
                  </p>
                  <p className="text-sm text-blue-900 whitespace-pre-wrap">
                    {criteria}
                  </p>
                </div>
              )}

              <SubmissionPreview task={attempt.task} submission={attempt.submission} />

              <ReviewForm
                attempt={attempt}
                isPending={reviewMutation.isPending}
                onSubmit={(data) =>
                  reviewMutation.mutate({
                    attemptId: attempt.id,
                    score: data.score,
                    feedback: data.feedback,
                  })
                }
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
