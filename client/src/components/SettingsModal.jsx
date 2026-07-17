import { useState } from "react";
import { cmToIn, inToCm } from "../bodyMetrics";

export default function SettingsModal({ settings, onSave, onClose }) {
  const [profileName, setProfileName] = useState(settings.profile_name || "");
  const [calorieGoal, setCalorieGoal] = useState(settings.calorie_goal);
  const [goalWeight, setGoalWeight] = useState(settings.goal_weight);
  const [weightUnit, setWeightUnit] = useState(settings.weight_unit);
  const [heightCm, setHeightCm] = useState(
    settings.height_cm ? Number(settings.height_cm) : ""
  );

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
      profile_name: profileName,
      calorie_goal: calorieGoal,
      goal_weight: goalWeight,
      weight_unit: weightUnit,
      height_cm: heightCm,
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>
        <form onSubmit={handleSubmit} className="settings-form">
          <label>
            Your name
            <input
              type="text"
              placeholder="e.g. David"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
            />
          </label>
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
