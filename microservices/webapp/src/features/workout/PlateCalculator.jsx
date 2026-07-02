import { useState } from 'react'
import BottomSheet from '../../components/ui/BottomSheet'
import NumberStepper from '../../components/ui/NumberStepper'
import { plateBreakdown, DEFAULT_BAR_KG } from './plates'

export default function PlateCalculator({ open, onClose, initialWeight = 60 }) {
  const [weight, setWeight] = useState(initialWeight)
  const [bar, setBar] = useState(DEFAULT_BAR_KG)

  const { perSide, loadable, exact } = plateBreakdown(weight, bar)

  return (
    <BottomSheet open={open} onClose={onClose} title="Plate calculator">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <NumberStepper label="Target weight (kg)" value={weight} onChange={setWeight} step={2.5} min={0} />
          <NumberStepper label="Bar (kg)" value={bar} onChange={setBar} step={5} min={0} />
        </div>

        {!exact && (
          <div className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2">
            {weight <= bar
              ? 'Target is at or below the bar weight.'
              : `Not loadable exactly — closest is ${loadable} kg.`}
          </div>
        )}

        <div>
          <div className="text-xs text-slate-500 mb-2">Per side</div>
          {perSide.length === 0 ? (
            <div className="text-sm text-slate-400">Empty bar</div>
          ) : (
            <div className="flex items-end gap-1 flex-wrap">
              {perSide.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center justify-center rounded bg-blue-600 text-white text-xs font-semibold"
                  style={{ height: `${36 + Math.min(p, 25) * 1.6}px`, minWidth: '2.4rem' }}
                >
                  {p}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
  )
}
