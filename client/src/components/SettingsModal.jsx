import { useState } from "react";
import { api } from "../api";
import { cmToIn, inToCm, proteinGoalGrams } from "../bodyMetrics";
import { daysAgoISO, todayISO } from "../dates";
import { buildFoodLogReport } from "../foodLogExport";

export default function SettingsModal({ settings, onSave, onClose }) {
  const [calorieGoal, setCalorieGoal] = useState(settings.calorie_goal);
  const [goalWeight, setGoalWeight] = useState(settings.goal_weight);
  const [weightUnit, setWeightUnit] = useState(settings.weight_unit);
  const [heightCm, setHeightCm] = useState(
    settings.height_cm ? Number(settings.height_cm) : ""
  );

  const [exportReport, setExportReport] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [copyMsg, setCopyMsg] = useState(null);

  const heightDisplayValue =
    heightCm === "" ? "" : weightUnit === "kg" ? heightCm : Math.round(cmToIn(heightCm) * 10) / 10;

  function handleHeightChange(value) {
    if (value === "") {
      setHeightCm("");
      return;
    }
    const num = Number(value);
    setHeightCm(weightUnit === "kg" ? num : inToCm(num));
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSave({
      calorie_goal: calorieGoal,
      goal_weight: goalWeight,
      weight_unit: weightUnit,
      height_cm: heightCm,
    });
  }

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    setCopyMsg(null);
    try {
      const start = daysAgoISO(6);
      const end = todayISO();
      const entries = await api.getFoodEntries({ start, end });
      const report = buildFoodLogReport({
        entries,
        start,
        end,
        calorieGoal: calorieGoal ? Number(calorieGoal) : null,
        proteinGoal: proteinGoalGrams(Number(goalWeight) || 0, weightUnit) || null,
      });
      setExportReport(report);
    } catch (err) {
      setExportError(err.message);
    } finally {
      setExporting(false);
    }
  }

  async function handleCopyExport() {
    try {
      await navigator.clipboard.writeText(exportReport);
      setCopyMsg("Copied to clipboard");
    } catch {
      setCopyMsg("Couldn't copy automatically — select the text above and copy manually");
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={exportReport ? "modal modal--wide" : "modal"} onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>
        <form onSubmit={handleSubmit} className="settings-form">
          <label>
            Daily calorie goal
            <input
              type="number"
              value={calorieGoal}
              onChange={(e) => setCalorieGoal(e.target.value)}
            />
          </label>
          <label>
            Goal weight
            <input
              type="number"
              step="0.1"
              value={goalWeight}
              onChange={(e) => setGoalWeight(e.target.value)}
            />
          </label>
          <label>
            Height ({weightUnit === "kg" ? "cm" : "in"})
            <input
              type="number"
              step={weightUnit === "kg" ? "1" : "0.1"}
              placeholder={weightUnit === "kg" ? "e.g. 178" : "e.g. 70"}
              value={heightDisplayValue}
              onChange={(e) => handleHeightChange(e.target.value)}
            />
          </label>
          <label>
            Weight unit
            <select value={weightUnit} onChange={(e) => setWeightUnit(e.target.value)}>
              <option value="lbs">lbs</option>
              <option value="kg">kg</option>
            </select>
          </label>
          <a
            href="https://console.anthropic.com/settings/billing"
            target="_blank"
            rel="noreferrer"
            className="settings-form__billing-link"
          >
            Check AI usage &amp; billing (Anthropic Console) ↗
          </a>

          <div className="settings-export">
            <div className="settings-export__header">
              <span className="settings-export__label">Export food log</span>
              <button type="button" className="button-secondary" onClick={handleExport} disabled={exporting}>
                {exporting ? "Building…" : "Copy last 7 days"}
              </button>
            </div>
            {exportError && <p className="auth-screen__error">{exportError}</p>}
            {exportReport && (
              <>
                <textarea
                  className="settings-export__report"
                  readOnly
                  value={exportReport}
                  onFocus={(e) => e.target.select()}
                />
                <div className="settings-export__actions">
                  <button type="button" className="button-primary" onClick={handleCopyExport}>
                    Copy to clipboard
                  </button>
                  {copyMsg && <span className="settings-export__copy-msg">{copyMsg}</span>}
                </div>
              </>
            )}
          </div>

          <div className="modal-actions">
            <button type="button" className="button-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button-primary">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
