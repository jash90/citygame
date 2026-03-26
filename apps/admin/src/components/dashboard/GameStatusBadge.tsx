import { GameStatus } from '@citygame/shared';

interface GameStatusBadgeProps {
  status: GameStatus;
}

const statusConfig: Record<GameStatus, { label: string; className: string }> = {
  [GameStatus.DRAFT]: {
    label: 'Szkic',
    className: 'bg-gray-100 text-gray-600',
  },
  [GameStatus.PUBLISHED]: {
    label: 'Opublikowana',
    className: 'bg-green-100 text-green-700',
  },
  [GameStatus.ARCHIVED]: {
    label: 'Archiwum',
    className: 'bg-yellow-100 text-yellow-700',
  },
};

export function GameStatusBadge({ status }: GameStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}
