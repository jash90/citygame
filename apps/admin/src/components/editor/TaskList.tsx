import {
  QrCode,
  MapPin,
  Camera,
  Mic,
  Type,
  Brain,
  Lock,
  Layers,
} from 'lucide-react';
import { TaskType } from '@citygame/shared';
import type { Task } from '@citygame/shared';

interface TaskListProps {
  tasks: Task[];
  selectedTaskId: string | null;
  onSelect: (task: Task) => void;
}

const taskTypeIcon: Record<TaskType, React.ReactNode> = {
  [TaskType.QR_SCAN]: <QrCode size={14} />,
  [TaskType.GPS_REACH]: <MapPin size={14} />,
  [TaskType.PHOTO_AI]: <Camera size={14} />,
  [TaskType.AUDIO_AI]: <Mic size={14} />,
  [TaskType.TEXT_EXACT]: <Type size={14} />,
  [TaskType.TEXT_AI]: <Brain size={14} />,
  [TaskType.CIPHER]: <Lock size={14} />,
  [TaskType.MIXED]: <Layers size={14} />,
};

const taskTypeLabel: Record<TaskType, string> = {
  [TaskType.QR_SCAN]: 'QR',
  [TaskType.GPS_REACH]: 'GPS',
  [TaskType.PHOTO_AI]: 'Foto AI',
  [TaskType.AUDIO_AI]: 'Audio AI',
  [TaskType.TEXT_EXACT]: 'Tekst',
  [TaskType.TEXT_AI]: 'Tekst AI',
  [TaskType.CIPHER]: 'Szyfr',
  [TaskType.MIXED]: 'Mix',
};

interface TaskRowProps {
  task: Task;
  isSelected: boolean;
  onSelect: () => void;
}

function TaskRow({ task, isSelected, onSelect }: TaskRowProps) {
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
        isSelected
          ? 'bg-orange-50 border-l-2 border-[#FF6B35]'
          : 'hover:bg-gray-50 border-l-2 border-transparent'
      }`}
    >
      {/* Order number */}
      <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 text-xs font-bold">
        {task.orderIndex + 1}
      </span>

      {/* Title */}
      <span className="flex-1 text-sm font-medium text-gray-800 truncate">
        {task.title}
      </span>

      {/* Type badge */}
      <span className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs">
        {taskTypeIcon[task.type]}
        {taskTypeLabel[task.type]}
      </span>
    </button>
  );
}

export function TaskList({ tasks, selectedTaskId, onSelect }: TaskListProps) {
  const sorted = [...tasks].sort((a, b) => a.orderIndex - b.orderIndex);

  if (!sorted.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 text-gray-400">
        <Layers size={32} className="mb-3 opacity-50" />
        <p className="text-sm">Brak zadań. Dodaj pierwsze.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-gray-100">
      {sorted.map((task) => (
        <li key={task.id}>
          <TaskRow
            task={task}
            isSelected={selectedTaskId === task.id}
            onSelect={() => onSelect(task)}
          />
        </li>
      ))}
    </ul>
  );
}
