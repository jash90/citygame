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

interface TaskTypeSelectorProps {
  value: TaskType | null;
  onChange: (type: TaskType) => void;
}

interface TypeOption {
  type: TaskType;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const typeOptions: TypeOption[] = [
  {
    type: TaskType.QR_SCAN,
    label: 'Skan QR',
    description: 'Zeskanuj kod QR',
    icon: <QrCode size={20} />,
  },
  {
    type: TaskType.GPS_REACH,
    label: 'GPS',
    description: 'Dotrzyj na miejsce',
    icon: <MapPin size={20} />,
  },
  {
    type: TaskType.PHOTO_AI,
    label: 'Zdjęcie AI',
    description: 'Zrób zdjęcie (AI)',
    icon: <Camera size={20} />,
  },
  {
    type: TaskType.AUDIO_AI,
    label: 'Audio AI',
    description: 'Nagraj dźwięk (AI)',
    icon: <Mic size={20} />,
  },
  {
    type: TaskType.TEXT_EXACT,
    label: 'Tekst',
    description: 'Dokładna odpowiedź',
    icon: <Type size={20} />,
  },
  {
    type: TaskType.TEXT_AI,
    label: 'Tekst AI',
    description: 'Odpowiedź AI',
    icon: <Brain size={20} />,
  },
  {
    type: TaskType.CIPHER,
    label: 'Szyfr',
    description: 'Rozwiąż szyfr',
    icon: <Lock size={20} />,
  },
  {
    type: TaskType.MIXED,
    label: 'Mix',
    description: 'Kilka kroków',
    icon: <Layers size={20} />,
  },
];

export function TaskTypeSelector({ value, onChange }: TaskTypeSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {typeOptions.map((option) => {
        const isSelected = value === option.type;
        return (
          <button
            key={option.type}
            type="button"
            onClick={() => onChange(option.type)}
            className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-center ${
              isSelected
                ? 'border-[#FF6B35] bg-orange-50 text-[#FF6B35]'
                : 'border-gray-200 bg-white text-gray-600 hover:border-orange-200 hover:bg-orange-50/50'
            }`}
          >
            <span>{option.icon}</span>
            <span className="text-xs font-semibold">{option.label}</span>
            <span className="text-xs text-gray-400 leading-tight">{option.description}</span>
          </button>
        );
      })}
    </div>
  );
}
