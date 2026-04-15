'use client';

import { MapPin } from 'lucide-react';
import { inputClass, Field } from './taskEditor.utils';

interface LocationSectionProps {
  register: any;
  errors: any;
}

export function LocationSection({ register, errors }: LocationSectionProps) {
  return (
    <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
      <div className="flex items-center gap-2">
        <MapPin size={14} className="text-[#FF6B35]" />
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Lokalizacja</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Szerokość (lat)" error={errors.latitude?.message} hint="np. 52.229676">
          <input {...register('latitude')} type="number" step="0.000001" placeholder="52.229676" className={inputClass(errors.latitude?.message)} />
        </Field>
        <Field label="Długość (lon)" error={errors.longitude?.message} hint="np. 21.012229">
          <input {...register('longitude')} type="number" step="0.000001" placeholder="21.012229" className={inputClass(errors.longitude?.message)} />
        </Field>
      </div>
      <p className="text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
        Format DD.DDDDDD (stopnie dziesiętne). Przykład: 52.229676, 21.012229 (Warszawa).
        Kopiuj ze strony: maps.google.com → kliknij prawym → „Co to jest?"
      </p>
    </div>
  );
}
