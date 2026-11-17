import { useMapApp } from "../../app/MapAppProvider";
import { useAppPage } from "../../app/useAppPage";

export default function SwipeControl() {
  const { state, patch } = useMapApp();
  const page = useAppPage();
  const result = state.result;

  if (!result || page !== "map" || !state.slider) return null;

  return (
    <div className="tune-swipe">
      <div className="tune-swipe-line" style={{ left: `${state.split}%` }}>
        <span>↔</span>
      </div>
      <input
        type="range"
        aria-label="División temporal"
        min="0"
        max="100"
        value={state.split}
        onChange={(e) => patch({ split: +e.target.value })}
      />
      <div className="tune-swipe-label left">Antes</div>
      <div className="tune-swipe-label right">Después</div>
    </div>
  );
}
