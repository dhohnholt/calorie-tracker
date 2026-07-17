import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import { daysAgoISO, todayISO, eachDateInRange, timeGreeting } from "./dates";
import { proteinGoalGrams } from "./bodyMetrics";
import QuickAddFood from "./components/QuickAddFood";
import TodaySummary from "./components/TodaySummary";
import WeeklyTrend from "./components/WeeklyTrend";
import CaloriesChart from "./components/CaloriesChart";
import MealBreakdown from "./components/MealBreakdown";
import WeightChart from "./components/WeightChart";
import SettingsModal from "./components/SettingsModal";
import Toast from "./components/Toast";
import LoadingSkeleton from "./components/LoadingSkeleton";
import MealPlanPage from "./components/MealPlanPage";
import "./App.css";

const CHART_DAYS = 20;

export default function App() {
  const [view, setView] = useState("dashboard");
  const [settings, setSettings] = useState(null);
  const [dailySummary, setDailySummary] = useState([]);
  const [weightEntries, setWeightEntries] = useState([]);
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [selectedDateEntries, setSelectedDateEntries] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const toastTimeout = useRef(null);

  function showToast(message, type = "success") {
    clearTimeout(toastTimeout.current);
    setToast({ message, type });
    toastTimeout.current = setTimeout(() => setToast(null), 2500);
  }

  const rangeStart = daysAgoISO(CHART_DAYS - 1);
  const rangeEnd = todayISO();

  async function loadAll() {
    const [settingsRes, summaryRes, weightRes] = await Promise.all([
      api.getSettings(),
      api.getDailySummary(rangeStart, rangeEnd),
      api.getWeightEntries({ start: daysAgoISO(89), end: rangeEnd }),
    ]);
    setSettings(settingsRes);
    setDailySummary(summaryRes);
    setWeightEntries(weightRes);
    setLoading(false);
  }

  async function loadSelectedDateEntries(date) {
    const entries = await api.getFoodEntries({ date });
    setSelectedDateEntries(entries);
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    loadSelectedDateEntries(selectedDate);
  }, [selectedDate]);

  const chartData = useMemo(() => {
    const byDate = Object.fromEntries(dailySummary.map((d) => [d.date, d]));
    return eachDateInRange(rangeStart, rangeEnd).map((date) => ({
      date,
      calories: byDate[date]?.calories || 0,
      protein_g: byDate[date]?.protein_g || 0,
      carbs_g: byDate[date]?.carbs_g || 0,
      fat_g: byDate[date]?.fat_g || 0,
      fiber_g: byDate[date]?.fiber_g || 0,
      sugar_g: byDate[date]?.sugar_g || 0,
      sodium_mg: byDate[date]?.sodium_mg || 0,
    }));
  }, [dailySummary, rangeStart, rangeEnd]);

  const todayTotals = useMemo(
    () => chartData.find((d) => d.date === todayISO()),
    [chartData]
  );

  async function handleDeleteFoodEntry(id) {
    await api.deleteFoodEntry(id);
    await loadSelectedDateEntries(selectedDate);
    const summaryRes = await api.getDailySummary(rangeStart, rangeEnd);
    setDailySummary(summaryRes);
    showToast("Entry deleted");
  }

  async function handleUpdateFoodEntry(id, fields) {
    await api.updateFoodEntry(id, fields);
    const summaryRes = await api.getDailySummary(rangeStart, rangeEnd);
    setDailySummary(summaryRes);
    if (fields.date && fields.date !== selectedDate) {
      setSelectedDate(fields.date);
    } else {
      await loadSelectedDateEntries(selectedDate);
    }
    showToast("Entry updated");
  }

  async function handleFoodAdded(date) {
    const summaryRes = await api.getDailySummary(rangeStart, rangeEnd);
    setDailySummary(summaryRes);
    if (date === selectedDate) {
      await loadSelectedDateEntries(date);
    } else {
      setSelectedDate(date);
    }
    showToast("Added to log");
  }

  async function handleAddWeight(entry) {
    await api.createWeightEntry(entry);
    const weightRes = await api.getWeightEntries({ start: daysAgoISO(89), end: rangeEnd });
    setWeightEntries(weightRes);
    showToast("Weight logged");
  }

  async function handleSaveSettings(newSettings) {
    const saved = await api.updateSettings(newSettings);
    setSettings(saved);
    setShowSettings(false);
    showToast("Settings saved");
  }

  if (loading || !settings) {
    return <LoadingSkeleton />;
  }

  const calorieGoal = Number(settings.calorie_goal);
  const goalWeight = Number(settings.goal_weight);
  const weightUnit = settings.weight_unit;
  const profileName = settings.profile_name?.trim();
  const heightCm = settings.height_cm ? Number(settings.height_cm) : null;
  const proteinGoal = proteinGoalGrams(goalWeight, weightUnit);

  return (
    <div className="app">
      <header className="app-header">
        <h1>{profileName ? `${timeGreeting()}, ${profileName}` : "Calorie Tracker"}</h1>
        <nav className="app-nav">
          <button
            className={view === "dashboard" ? "app-nav__tab app-nav__tab--active" : "app-nav__tab"}
            onClick={() => setView("dashboard")}
          >
            Dashboard
          </button>
          <button
            className={view === "meal-plan" ? "app-nav__tab app-nav__tab--active" : "app-nav__tab"}
            onClick={() => setView("meal-plan")}
          >
            Meal Plan
          </button>
        </nav>
        <button
          className="icon-button icon-button--settings"
          onClick={() => setShowSettings(true)}
          title="Settings"
        >
          ⚙
        </button>
      </header>

      {view === "dashboard" ? (
        <main className="app-grid">
          <TodaySummary totals={todayTotals} goal={calorieGoal} proteinGoal={proteinGoal} />

          <WeeklyTrend data={chartData} goal={calorieGoal} />

          <CaloriesChart
            data={chartData}
            goal={calorieGoal}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />

          <MealBreakdown
            date={selectedDate}
            entries={selectedDateEntries}
            onUpdate={handleUpdateFoodEntry}
            onDelete={handleDeleteFoodEntry}
          />

          <WeightChart
            data={weightEntries}
            goalWeight={goalWeight}
            unit={weightUnit}
            heightCm={heightCm}
            onAdd={handleAddWeight}
          />

          <QuickAddFood onAdded={handleFoodAdded} />
        </main>
      ) : (
        <MealPlanPage proteinGoal={proteinGoal} todayProtein={todayTotals?.protein_g || 0} />
      )}

      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      <Toast toast={toast} />
    </div>
  );
}
