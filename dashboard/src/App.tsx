import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  Flame,
  Calendar,
  UploadCloud,
  X,
  Sliders,
  Award,
  Heart,
  Info,
  Moon,
  Sun,
  Zap,
  BarChart2,
  Dumbbell,
  Sparkles,
  Footprints,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  ZAxis
} from 'recharts';
import './App.css';

// Interface definitions
interface Workout {
  id: string;
  date: string;
  name: string;
  type: string;
  duration_min: number;
  distance_km: number;
  elevation_m: number;
  avg_hr: number | null;
  max_hr: number | null;
  kudos: number;
  year: number;
  month: string; // "Jan", "Feb", etc.
  dayOfWeek: string; // "Mon", "Tue", etc.
}

// (MonthlyData interface removed since it is unused)

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Standard CSV parser that handles double quotes and commas
function parseCSVText(text: string, defaultYear: number): Workout[] {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  if (lines.length === 0) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
  
  return lines.slice(1).map((line, idx) => {
    const values: string[] = [];
    let currentVal = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(currentVal.trim().replace(/^["']|["']$/g, ''));
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
    values.push(currentVal.trim().replace(/^["']|["']$/g, ''));
    
    const row: any = {};
    headers.forEach((header, index) => {
      let val: any = values[index] !== undefined ? values[index] : '';
      if (val === '') {
        val = null;
      } else if (!isNaN(val as any)) {
        val = Number(val);
      }
      row[header] = val;
    });
    
    // Parse date elements safely
    const dateStr = row.date || '';
    let parsedYear = defaultYear;
    let monthName = 'Jan';
    let dayOfWeekName = 'Mon';
    
    if (dateStr) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        parsedYear = parseInt(parts[0], 10);
        const monthNum = parseInt(parts[1], 10);
        if (monthNum >= 1 && monthNum <= 12) {
          monthName = MONTHS[monthNum - 1];
        }
        
        // Find day of week without timezone shifting
        const dateObj = new Date(parsedYear, monthNum - 1, parseInt(parts[2], 10));
        dayOfWeekName = DAYS[dateObj.getDay()];
      }
    }
    
    return {
      id: `${parsedYear}_${idx}_${row.date || ''}`,
      date: row.date || '',
      name: row.name || 'Workout',
      type: row.type || 'Other',
      duration_min: typeof row.duration_min === 'number' ? row.duration_min : 0,
      distance_km: typeof row.distance_km === 'number' ? row.distance_km : 0,
      elevation_m: typeof row.elevation_m === 'number' ? row.elevation_m : 0,
      avg_hr: typeof row.avg_hr === 'number' ? row.avg_hr : null,
      max_hr: typeof row.max_hr === 'number' ? row.max_hr : null,
      kudos: typeof row.kudos === 'number' ? row.kudos : 0,
      year: parsedYear,
      month: monthName,
      dayOfWeek: dayOfWeekName
    };
  });
}

// Activity display name map
const ACTIVITY_NAMES: Record<string, string> = {
  HighIntensityIntervalTraining: 'HIIT',
  WeightTraining: 'Strength',
  Pilates: 'Pilates',
  Yoga: 'Yoga',
  Run: 'Run',
  Walk: 'Walk',
  Hike: 'Hike'
};

const ACTIVITY_COLORS: Record<string, string> = {
  Run: 'var(--accent-strava)',
  HighIntensityIntervalTraining: 'var(--accent-red)',
  Yoga: 'var(--accent-purple)',
  Walk: 'var(--accent-cyan)',
  Pilates: '#10b981', // emerald
  WeightTraining: 'var(--accent-yellow)',
  Hike: '#a3e635' // lime
};

export default function App() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all'); // all, 2025, 2026
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [isDropzoneOpen, setIsDropzoneOpen] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  // Simulator states
  const [simWeeklyRuns, setSimWeeklyRuns] = useState<number>(2);
  const [simWeeklyHIIT, setSimWeeklyHIIT] = useState<number>(3);
  const [simWeeklyYoga, setSimWeeklyYoga] = useState<number>(1);
  
  // Load default CSV logs
  useEffect(() => {
    const loadDefaultLogs = async () => {
      try {
        const res2025 = await fetch('/data/2025.csv');
        const res2026 = await fetch('/data/2026.csv');
        
        let data2025: Workout[] = [];
        let data2026: Workout[] = [];
        
        if (res2025.ok) {
          const text = await res2025.text();
          data2025 = parseCSVText(text, 2025);
        } else {
          console.warn('Could not find /data/2025.csv');
        }
        
        if (res2026.ok) {
          const text = await res2026.text();
          data2026 = parseCSVText(text, 2026);
        } else {
          console.warn('Could not find /data/2026.csv');
        }
        
        const combined = [...data2025, ...data2026];
        if (combined.length === 0) {
          setLoadError("No default logs found. Please upload workout CSV logs using the 'Upload logs' button.");
        } else {
          setWorkouts(combined);
        }
      } catch (err: any) {
        console.error('Error loading default logs:', err);
        setLoadError('Failed to load local logs. You can drag and drop your workout logs to analyze them.');
      }
    };
    
    loadDefaultLogs();
  }, []);

  // Theme effect
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Handle manual file upload / drop
  const handleCSVUpload = (text: string, fileName: string) => {
    let year = 2026;
    if (fileName.includes('2025')) year = 2025;
    
    try {
      const newWorkouts = parseCSVText(text, year);
      if (newWorkouts.length === 0) {
        alert("The file content is empty or invalid.");
        return;
      }
      
      // Merge by overwriting overlaps or simply combining with unique IDs
      setWorkouts(prev => {
        // filter out existing workouts from the same year to overwrite, or keep all
        const filtered = prev.filter(w => w.year !== year);
        const combined = [...filtered, ...newWorkouts];
        // Sort by date descending
        return combined.sort((a, b) => b.date.localeCompare(a.date));
      });
      setIsDropzoneOpen(false);
      setLoadError(null);
    } catch (e) {
      alert("Error parsing CSV file. Please make sure it matches the export format.");
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target && typeof event.target.result === 'string') {
          handleCSVUpload(event.target.result, file.name);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target && typeof event.target.result === 'string') {
          handleCSVUpload(event.target.result, file.name);
        }
      };
      reader.readAsText(file);
    }
  };

  // Filtered workouts based on year and search query
  const filteredWorkouts = useMemo(() => {
    return workouts.filter(w => {
      const matchesYear = selectedYear === 'all' || w.year === selectedYear;
      const matchesSearch = searchQuery === '' || 
        w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ACTIVITY_NAMES[w.type] || w.type).toLowerCase().includes(searchQuery.toLowerCase());
      return matchesYear && matchesSearch;
    });
  }, [workouts, selectedYear, searchQuery]);

  // 1. KPI Calculations (2025 vs 2026 comparisons)
  const stats = useMemo(() => {
    const workouts2025 = workouts.filter(w => w.year === 2025);
    const workouts2026 = workouts.filter(w => w.year === 2026);

    const calcYearStats = (list: Workout[]) => {
      const totalCount = list.length;
      const totalDuration = list.reduce((sum, w) => sum + w.duration_min, 0);
      const totalDistance = list.reduce((sum, w) => sum + w.distance_km, 0);
      const totalElevation = list.reduce((sum, w) => sum + w.elevation_m, 0);
      
      const runs = list.filter(w => w.type === 'Run');
      const totalRunDistance = runs.reduce((sum, r) => sum + r.distance_km, 0);
      const totalRunDuration = runs.reduce((sum, r) => sum + r.duration_min, 0);
      const avgPace = totalRunDistance > 0 ? (totalRunDuration / totalRunDistance) : 0;
      
      const listWithHr = list.filter(w => w.avg_hr !== null && w.avg_hr > 0);
      const avgHr = listWithHr.length > 0 
        ? listWithHr.reduce((sum, w) => sum + (w.avg_hr || 0), 0) / listWithHr.length 
        : 0;

      return {
        totalCount,
        totalDuration,
        totalDistance,
        totalElevation,
        avgPace,
        avgHr
      };
    };

    const s2025 = calcYearStats(workouts2025);
    const s2026 = calcYearStats(workouts2026);

    const percentChange = (current: number, previous: number) => {
      if (previous === 0) return 0;
      return ((current - previous) / previous) * 100;
    };

    return {
      2025: s2025,
      2026: s2026,
      changes: {
        workoutsCount: percentChange(s2026.totalCount, s2025.totalCount),
        duration: percentChange(s2026.totalDuration, s2025.totalDuration),
        distance: percentChange(s2026.totalDistance, s2025.totalDistance),
        elevation: percentChange(s2026.totalElevation, s2025.totalElevation),
        avgPace: s2025.avgPace > 0 && s2026.avgPace > 0 ? percentChange(s2026.avgPace, s2025.avgPace) : 0
      }
    };
  }, [workouts]);

  // Selected state stats (changes depending on year toggle)
  const currentStats = useMemo(() => {
    const list = filteredWorkouts;
    const totalCount = list.length;
    const totalDuration = list.reduce((sum, w) => sum + w.duration_min, 0);
    const totalDistance = list.reduce((sum, w) => sum + w.distance_km, 0);
    const totalElevation = list.reduce((sum, w) => sum + w.elevation_m, 0);
    
    const runs = list.filter(w => w.type === 'Run');
    const totalRunDistance = runs.reduce((sum, r) => sum + r.distance_km, 0);
    const totalRunDuration = runs.reduce((sum, r) => sum + r.duration_min, 0);
    const avgPace = totalRunDistance > 0 ? (totalRunDuration / totalRunDistance) : 0;

    const hrs = list.filter(w => w.avg_hr !== null && w.avg_hr > 0);
    const avgHr = hrs.length > 0 ? hrs.reduce((sum, w) => sum + (w.avg_hr || 0), 0) / hrs.length : 0;
    const maxHr = hrs.length > 0 ? Math.max(...hrs.map(w => w.max_hr || 0)) : 0;

    return {
      totalCount,
      totalDuration,
      totalDistance,
      totalElevation,
      avgPace,
      avgHr,
      maxHr
    };
  }, [filteredWorkouts]);

  // Format decimal pace (e.g. 5.5) to "5:30" min/km
  const formatPace = (decimalPace: number) => {
    if (!decimalPace || isNaN(decimalPace)) return '--:--';
    const mins = Math.floor(decimalPace);
    const secs = Math.round((decimalPace - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 2. Chart Aggregations - Month over Month (Jan to Jun)
  const monthlyChartData = useMemo(() => {
    const dataMap: Record<string, { '2025_count': number, '2026_count': number, '2025_duration': number, '2026_duration': number }> = {};
    
    // Initialize Jan-Jun
    MONTHS.slice(0, 6).forEach(m => {
      dataMap[m] = { '2025_count': 0, '2026_count': 0, '2025_duration': 0, '2026_duration': 0 };
    });

    workouts.forEach(w => {
      const m = w.month;
      if (dataMap[m]) {
        if (w.year === 2025) {
          dataMap[m]['2025_count'] += 1;
          dataMap[m]['2025_duration'] += w.duration_min;
        } else if (w.year === 2026) {
          dataMap[m]['2026_count'] += 1;
          dataMap[m]['2026_duration'] += w.duration_min;
        }
      }
    });

    return MONTHS.slice(0, 6).map(m => ({
      month: m,
      '2025 Workouts': dataMap[m]['2025_count'],
      '2026 Workouts': dataMap[m]['2026_count'],
      '2025 Minutes': Math.round(dataMap[m]['2025_duration']),
      '2026 Minutes': Math.round(dataMap[m]['2026_duration'])
    }));
  }, [workouts]);

  // 3. Activity breakdown (Pie chart)
  const activityPieData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredWorkouts.forEach(w => {
      const typeLabel = ACTIVITY_NAMES[w.type] || w.type;
      counts[typeLabel] = (counts[typeLabel] || 0) + 1;
    });

    return Object.keys(counts).map(key => ({
      name: key,
      value: counts[key]
    })).sort((a, b) => b.value - a.value);
  }, [filteredWorkouts]);

  // Activity type split comparison
  const activityCompareData = useMemo(() => {
    const dataMap: Record<string, { '2025': number, '2026': number }> = {};
    
    workouts.forEach(w => {
      const typeLabel = ACTIVITY_NAMES[w.type] || w.type;
      if (!dataMap[typeLabel]) {
        dataMap[typeLabel] = { '2025': 0, '2026': 0 };
      }
      if (w.year === 2025) dataMap[typeLabel]['2025'] += 1;
      if (w.year === 2026) dataMap[typeLabel]['2026'] += 1;
    });

    return Object.keys(dataMap).map(key => ({
      name: key,
      '2025': dataMap[key]['2025'],
      '2026': dataMap[key]['2026']
    })).sort((a, b) => (b['2026'] + b['2025']) - (a['2026'] + a['2025']));
  }, [workouts]);

  // 4. Day of week distribution
  const dayOfWeekData = useMemo(() => {
    const dataMap: Record<string, { '2025': number, '2026': number }> = {};
    DAYS.forEach(d => {
      dataMap[d] = { '2025': 0, '2026': 0 };
    });

    workouts.forEach(w => {
      if (dataMap[w.dayOfWeek]) {
        if (w.year === 2025) dataMap[w.dayOfWeek]['2025'] += 1;
        if (w.year === 2026) dataMap[w.dayOfWeek]['2026'] += 1;
      }
    });

    return DAYS.map(d => ({
      day: d,
      '2025 Workouts': dataMap[d]['2025'],
      '2026 Workouts': dataMap[d]['2026']
    }));
  }, [workouts]);

  // 5. Run Cardio pace deep dive
  const runningData = useMemo(() => {
    return workouts
      .filter(w => w.type === 'Run')
      .map(w => {
        const pace = w.distance_km > 0 ? (w.duration_min / w.distance_km) : 0;
        return {
          ...w,
          paceDecimal: parseFloat(pace.toFixed(2)),
          paceFormatted: formatPace(pace),
          speedKmh: w.duration_min > 0 ? parseFloat(((w.distance_km / w.duration_min) * 60).toFixed(1)) : 0
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [workouts]);

  // 6. Heart Rate Zone classification (2026 data only)
  const hrZonesData = useMemo(() => {
    // Zone 1: Recovery <120 bpm
    // Zone 2: Aerobic 120-140 bpm
    // Zone 3: Tempo 140-160 bpm
    // Zone 4: Threshold 160-180 bpm
    // Zone 5: Anaerobic >180 bpm
    const list = workouts.filter(w => w.year === 2026 && w.avg_hr !== null && w.avg_hr > 0);
    const zones = [
      { name: 'Zone 1: Active Recovery', range: '< 120 bpm', count: 0, color: 'var(--accent-cyan)', rgb: '0, 245, 212' },
      { name: 'Zone 2: Aerobic Base', range: '120 - 140 bpm', count: 0, color: '#10b981', rgb: '16, 185, 129' },
      { name: 'Zone 3: Tempo / Cardio', range: '140 - 160 bpm', count: 0, color: 'var(--accent-yellow)', rgb: '245, 158, 11' },
      { name: 'Zone 4: Threshold / Stamina', range: '160 - 180 bpm', count: 0, color: 'var(--accent-strava)', rgb: '252, 82, 0' },
      { name: 'Zone 5: Anaerobic / Peak', range: '> 180 bpm', count: 0, color: 'var(--accent-red)', rgb: '239, 68, 68' }
    ];

    list.forEach(w => {
      const hr = w.avg_hr || 0;
      if (hr < 120) zones[0].count++;
      else if (hr >= 120 && hr < 140) zones[1].count++;
      else if (hr >= 140 && hr < 160) zones[2].count++;
      else if (hr >= 160 && hr < 180) zones[3].count++;
      else zones[4].count++;
    });

    return zones;
  }, [workouts]);

  // Average HR by activity type
  const hrByActivityType = useMemo(() => {
    const list = workouts.filter(w => w.year === 2026 && w.avg_hr !== null && w.avg_hr > 0);
    const sums: Record<string, { total: number, count: number }> = {};
    
    list.forEach(w => {
      const typeLabel = ACTIVITY_NAMES[w.type] || w.type;
      if (!sums[typeLabel]) {
        sums[typeLabel] = { total: 0, count: 0 };
      }
      sums[typeLabel].total += w.avg_hr || 0;
      sums[typeLabel].count += 1;
    });

    return Object.keys(sums).map(key => ({
      activity: key,
      'Average Heart Rate': Math.round(sums[key].total / sums[key].count),
      count: sums[key].count
    })).sort((a, b) => b['Average Heart Rate'] - a['Average Heart Rate']);
  }, [workouts]);

  // 7. What-If Simulator results calculation
  const simulatorResults = useMemo(() => {
    // Current averages per week (based on ~21 active weeks in Jan-May/Jun)
    const weeksCount = 21; // roughly 5 months of active tracking
    const currentRuns = workouts.filter(w => w.year === 2026 && w.type === 'Run').length;
    const currentHIIT = workouts.filter(w => w.year === 2026 && w.type === 'HighIntensityIntervalTraining').length;
    const currentYoga = workouts.filter(w => w.year === 2026 && w.type === 'Yoga').length;

    const avgRunDuration = 35.8; // average run time in 2026
    const avgRunDistance = 4.8; // average run distance
    const avgHIITDuration = 55.4; // average HIIT time
    const avgYogaDuration = 45.4; // average Yoga time

    const currentWeeklyWorkouts = (currentRuns + currentHIIT + currentYoga) / weeksCount;
    const currentWeeklyDuration = ((currentRuns * avgRunDuration) + (currentHIIT * avgHIITDuration) + (currentYoga * avgYogaDuration)) / weeksCount;
    
    const simulatedWeeklyWorkouts = simWeeklyRuns + simWeeklyHIIT + simWeeklyYoga;
    const simulatedWeeklyDuration = (simWeeklyRuns * avgRunDuration) + (simWeeklyHIIT * avgHIITDuration) + (simWeeklyYoga * avgYogaDuration);
    const simulatedWeeklyDistance = simWeeklyRuns * avgRunDistance;

    // Monthly estimations
    const simulatedMonthlyWorkouts = simulatedWeeklyWorkouts * 4.3;
    const simulatedMonthlyDuration = simulatedWeeklyDuration * 4.3;
    const simulatedMonthlyDistance = simulatedWeeklyDistance * 4.3;

    return {
      currentWeeklyWorkouts: currentWeeklyWorkouts.toFixed(1),
      simulatedWeeklyWorkouts: simulatedWeeklyWorkouts.toFixed(1),
      currentWeeklyDuration: Math.round(currentWeeklyDuration),
      simulatedWeeklyDuration: Math.round(simulatedWeeklyDuration),
      simulatedWeeklyDistance: simulatedWeeklyDistance.toFixed(1),
      simulatedMonthlyWorkouts: Math.round(simulatedMonthlyWorkouts),
      simulatedMonthlyDuration: Math.round(simulatedMonthlyDuration),
      simulatedMonthlyDistance: Math.round(simulatedMonthlyDistance)
    };
  }, [workouts, simWeeklyRuns, simWeeklyHIIT, simWeeklyYoga]);

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="brand-section">
          <div className="logo-container">
            <Activity size={24} />
          </div>
          <div>
            <div className="brand-title">
              <h1>ActiveLife</h1>
            </div>
            <div className="brand-subtitle">Workout Analytics & Insights</div>
          </div>
        </div>
        
        <div className="header-controls">
          <div className="year-selector">
            <button 
              className={`year-tab ${selectedYear === 'all' ? 'active year-compare' : ''}`}
              onClick={() => setSelectedYear('all')}
            >
              Compare Years
            </button>
            <button 
              className={`year-tab ${selectedYear === 2025 ? 'active' : ''}`}
              onClick={() => setSelectedYear(2025)}
            >
              2025
            </button>
            <button 
              className={`year-tab ${selectedYear === 2026 ? 'active' : ''}`}
              onClick={() => setSelectedYear(2026)}
            >
              2026
            </button>
          </div>

          <button className="upload-btn" onClick={() => setIsDropzoneOpen(true)}>
            <UploadCloud size={16} />
            <span>Upload CSV</span>
          </button>

          <button 
            className="theme-toggle" 
            onClick={() => setIsDarkMode(!isDarkMode)}
            aria-label="Toggle theme"
          >
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      {/* Tabs navigation */}
      <nav className="tabs-bar">
        <button 
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <BarChart2 size={16} /> Overview
        </button>
        <button 
          className={`tab-button ${activeTab === 'comparison' ? 'active' : ''}`}
          onClick={() => setActiveTab('comparison')}
        >
          <Sliders size={16} /> Year-over-Year
        </button>
        <button 
          className={`tab-button ${activeTab === 'running' ? 'active' : ''}`}
          onClick={() => setActiveTab('running')}
        >
          <Footprints size={16} /> Running Analysis
        </button>
        <button 
          className={`tab-button ${activeTab === 'heartrate' ? 'active' : ''}`}
          onClick={() => setActiveTab('heartrate')}
        >
          <Heart size={16} /> Cardio Intensity
        </button>
        <button 
          className={`tab-button ${activeTab === 'coach' ? 'active' : ''}`}
          onClick={() => setActiveTab('coach')}
        >
          <Sparkles size={16} /> AI Coach & Simulator
        </button>
        <button 
          className={`tab-button ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          <Calendar size={16} /> Workouts Log
        </button>
      </nav>

      {loadError && (
        <div className="glass-card" style={{ margin: '16px 24px 0', padding: '16px', borderLeft: '4px solid var(--accent-red)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AlertTriangle color="var(--accent-red)" size={20} />
          <div>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Loading Error</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{loadError}</div>
          </div>
        </div>
      )}

      {/* KPI Stats Row */}
      <div className="metrics-row">
        <div className="glass-card kpi-card" style={{ '--card-accent': 'var(--accent-strava)' } as React.CSSProperties}>
          <div className="kpi-header">
            <span className="kpi-title">Total Workouts</span>
            <div className="kpi-icon-wrapper"><Flame size={16} /></div>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-value">{currentStats.totalCount}</span>
            <span className="kpi-unit">sessions</span>
          </div>
          {selectedYear === 'all' && (
            <div className={`kpi-trend ${stats.changes.workoutsCount >= 0 ? 'positive' : 'negative'}`}>
              {stats.changes.workoutsCount >= 0 ? <Zap size={12} /> : <AlertTriangle size={12} />}
              <span>{stats.changes.workoutsCount.toFixed(1)}% YoY</span>
            </div>
          )}
        </div>

        <div className="glass-card kpi-card" style={{ '--card-accent': 'var(--accent-cyan)' } as React.CSSProperties}>
          <div className="kpi-header">
            <span className="kpi-title">Active Time</span>
            <div className="kpi-icon-wrapper"><Activity size={16} /></div>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-value">{Math.round(currentStats.totalDuration)}</span>
            <span className="kpi-unit">mins</span>
          </div>
          {selectedYear === 'all' && (
            <div className={`kpi-trend ${stats.changes.duration >= 0 ? 'positive' : 'negative'}`}>
              {stats.changes.duration >= 0 ? <Zap size={12} /> : <AlertTriangle size={12} />}
              <span>{stats.changes.duration.toFixed(1)}% YoY</span>
            </div>
          )}
        </div>

        <div className="glass-card kpi-card" style={{ '--card-accent': 'var(--accent-purple)' } as React.CSSProperties}>
          <div className="kpi-header">
            <span className="kpi-title">Total Distance</span>
            <div className="kpi-icon-wrapper"><Footprints size={16} /></div>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-value">{currentStats.totalDistance.toFixed(1)}</span>
            <span className="kpi-unit">km</span>
          </div>
          {selectedYear === 'all' && (
            <div className={`kpi-trend ${stats.changes.distance >= 0 ? 'positive' : 'negative'}`}>
              {stats.changes.distance >= 0 ? <Zap size={12} /> : <AlertTriangle size={12} />}
              <span>{stats.changes.distance.toFixed(1)}% YoY</span>
            </div>
          )}
        </div>

        <div className="glass-card kpi-card" style={{ '--card-accent': 'var(--accent-yellow)' } as React.CSSProperties}>
          <div className="kpi-header">
            <span className="kpi-title">Average Pace</span>
            <div className="kpi-icon-wrapper"><Zap size={16} /></div>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-value">{formatPace(currentStats.avgPace)}</span>
            <span className="kpi-unit">/km</span>
          </div>
          {selectedYear === 'all' && (
            <div className={`kpi-trend ${stats.changes.avgPace <= 0 ? 'positive' : 'negative'}`}>
              {stats.changes.avgPace <= 0 ? <Zap size={12} /> : <AlertTriangle size={12} />}
              {/* Pace negative change means faster pace! */}
              <span>{stats.changes.avgPace !== 0 ? `${Math.abs(stats.changes.avgPace).toFixed(1)}% ${stats.changes.avgPace <= 0 ? 'faster' : 'slower'}` : '0.0%'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Dashboard Views */}
      <main className="dashboard-content">
        
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="dashboard-grid">
            
            {/* MoM Workouts Volume Chart */}
            <div className="glass-card chart-card card-col-8">
              <h3 className="section-title"><Activity size={18} color="var(--accent-strava)" /> Monthly Activity Volume (Jan-Jun)</h3>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart data={monthlyChartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis dataKey="month" stroke="var(--text-secondary)" />
                    <YAxis stroke="var(--text-secondary)" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px' }} 
                      labelStyle={{ color: 'var(--text-primary)', fontWeight: 'bold' }}
                    />
                    <Legend />
                    <Bar dataKey="2025 Workouts" fill="rgba(148, 163, 184, 0.4)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="2026 Workouts" fill="var(--accent-strava)" radius={[4, 4, 0, 0]} />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Activity Mix Pie Chart */}
            <div className="glass-card chart-card card-col-4">
              <h3 className="section-title"><Dumbbell size={18} color="var(--accent-cyan)" /> Workout Type Split</h3>
              {activityPieData.length > 0 ? (
                <div className="chart-container" style={{ position: 'relative' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={activityPieData}
                        cx="50%"
                        cy="45%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {activityPieData.map((entry, index) => {
                          // Find original type key for coloring
                          const originalType = Object.keys(ACTIVITY_NAMES).find(key => ACTIVITY_NAMES[key] === entry.name) || entry.name;
                          const color = ACTIVITY_COLORS[originalType] || '#94a3b8';
                          return <Cell key={`cell-${index}`} fill={color} />;
                        })}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px' }}
                      />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                  
                  {/* Legend below */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '-10px' }}>
                    {activityPieData.map((entry) => {
                      const originalType = Object.keys(ACTIVITY_NAMES).find(key => ACTIVITY_NAMES[key] === entry.name) || entry.name;
                      const color = ACTIVITY_COLORS[originalType] || '#94a3b8';
                      return (
                        <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color }}></span>
                          <span>{entry.name} ({entry.value})</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="empty-state">No data available</div>
              )}
            </div>

            {/* Active Minutes Chart */}
            <div className="glass-card chart-card card-col-8">
              <h3 className="section-title"><Zap size={18} color="var(--accent-cyan)" /> Active Training Duration (Minutes)</h3>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart data={monthlyChartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis dataKey="month" stroke="var(--text-secondary)" />
                    <YAxis stroke="var(--text-secondary)" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px' }}
                      labelStyle={{ color: 'var(--text-primary)', fontWeight: 'bold' }}
                    />
                    <Legend />
                    <Bar dataKey="2025 Minutes" fill="rgba(148, 163, 184, 0.4)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="2026 Minutes" fill="var(--accent-cyan)" radius={[4, 4, 0, 0]} />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Day of Week Consistency Chart */}
            <div className="glass-card chart-card card-col-4">
              <h3 className="section-title"><Calendar size={18} color="var(--accent-purple)" /> Weekly Workouts Pattern</h3>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart data={dayOfWeekData} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis dataKey="day" stroke="var(--text-secondary)" style={{ fontSize: '11px' }} />
                    <YAxis stroke="var(--text-secondary)" style={{ fontSize: '11px' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px' }}
                    />
                    <Bar dataKey="2025 Workouts" fill="rgba(148, 163, 184, 0.3)" />
                    <Bar dataKey="2026 Workouts" fill="var(--accent-purple)" />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        )}

        {/* YEAR OVER YEAR COMPARISON TAB */}
        {activeTab === 'comparison' && (
          <div className="dashboard-grid">
            <div className="glass-card card-col-12 table-card">
              <h3 className="section-title"><Sliders size={18} color="var(--accent-strava)" /> 2025 vs 2026 Side-by-Side Statistics</h3>
              
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th>Jan - Jun 2025</th>
                      <th>Jan - Jun 2026</th>
                      <th>Year-over-Year Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="table-row-name">Workout Sessions</td>
                      <td>{stats[2025].totalCount} workouts</td>
                      <td>{stats[2026].totalCount} workouts</td>
                      <td>
                        <span className={`kpi-trend ${stats.changes.workoutsCount >= 0 ? 'positive' : 'negative'}`} style={{ display: 'inline-flex', marginTop: 0 }}>
                          {stats.changes.workoutsCount.toFixed(1)}% {stats.changes.workoutsCount >= 0 ? 'increase' : 'decrease'}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="table-row-name">Total Training Time</td>
                      <td>{Math.round(stats[2025].totalDuration)} minutes</td>
                      <td>{Math.round(stats[2026].totalDuration)} minutes</td>
                      <td>
                        <span className={`kpi-trend ${stats.changes.duration >= 0 ? 'positive' : 'negative'}`} style={{ display: 'inline-flex', marginTop: 0 }}>
                          {stats.changes.duration.toFixed(1)}% {stats.changes.duration >= 0 ? 'increase' : 'decrease'}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="table-row-name">Average Session Duration</td>
                      <td>{stats[2025].totalCount > 0 ? (stats[2025].totalDuration / stats[2025].totalCount).toFixed(1) : 0} mins</td>
                      <td>{stats[2026].totalCount > 0 ? (stats[2026].totalDuration / stats[2026].totalCount).toFixed(1) : 0} mins</td>
                      <td>
                        <span className="kpi-trend neutral" style={{ display: 'inline-flex', marginTop: 0 }}>
                          {(((stats[2026].totalDuration / stats[2026].totalCount) - (stats[2025].totalDuration / stats[2025].totalCount)) / (stats[2025].totalDuration / stats[2025].totalCount) * 100).toFixed(1)}% change
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="table-row-name">Total Cardio Distance</td>
                      <td>{stats[2025].totalDistance.toFixed(1)} km</td>
                      <td>{stats[2026].totalDistance.toFixed(1)} km</td>
                      <td>
                        <span className={`kpi-trend ${stats.changes.distance >= 0 ? 'positive' : 'negative'}`} style={{ display: 'inline-flex', marginTop: 0 }}>
                          {stats.changes.distance.toFixed(1)}% {stats.changes.distance >= 0 ? 'increase' : 'decrease'}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="table-row-name">Total Elevation Gained</td>
                      <td>{stats[2025].totalElevation} m</td>
                      <td>{stats[2026].totalElevation} m</td>
                      <td>
                        <span className={`kpi-trend ${stats.changes.elevation >= 0 ? 'positive' : 'negative'}`} style={{ display: 'inline-flex', marginTop: 0 }}>
                          {stats.changes.elevation.toFixed(1)}% {stats.changes.elevation >= 0 ? 'increase' : 'decrease'}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="table-row-name">Average Running Pace</td>
                      <td>{formatPace(stats[2025].avgPace)} /km</td>
                      <td>{formatPace(stats[2026].avgPace)} /km</td>
                      <td>
                        <span className={`kpi-trend ${stats.changes.avgPace <= 0 ? 'positive' : 'negative'}`} style={{ display: 'inline-flex', marginTop: 0 }}>
                          {stats.changes.avgPace !== 0 ? `${Math.abs(stats.changes.avgPace).toFixed(1)}% ${stats.changes.avgPace <= 0 ? 'faster' : 'slower'}` : '0.0%'}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="table-row-name">Heart Rate Tracking</td>
                      <td style={{ color: 'var(--text-muted)' }}>Not Tracked (0% coverage)</td>
                      <td>Tracked ({((workouts.filter(w => w.year === 2026 && w.avg_hr !== null).length / stats[2026].totalCount) * 100).toFixed(0)}% coverage)</td>
                      <td>
                        <span className="kpi-trend positive" style={{ display: 'inline-flex', marginTop: 0 }}>
                          Newly Adopted in 2026!
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* side by side activity type comparison */}
            <div className="glass-card chart-card card-col-12">
              <h3 className="section-title"><Dumbbell size={18} color="var(--accent-purple)" /> Workout Frequency Comparison by Type</h3>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart data={activityCompareData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis dataKey="name" stroke="var(--text-secondary)" />
                    <YAxis stroke="var(--text-secondary)" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px' }}
                    />
                    <Legend />
                    <Bar dataKey="2025" fill="rgba(148, 163, 184, 0.4)" name="2025 Frequency" />
                    <Bar dataKey="2026" fill="var(--accent-purple)" name="2026 Frequency" />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* RUNNING AND CARDIO DEEP DIVE */}
        {activeTab === 'running' && (
          <div className="dashboard-grid">
            
            {/* Running Pace Trend */}
            <div className="glass-card chart-card card-col-8">
              <h3 className="section-title"><Footprints size={18} color="var(--accent-strava)" /> Running Performance Trend</h3>
              {runningData.length > 0 ? (
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={runningData} margin={{ top: 20, right: 30, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                      <XAxis dataKey="date" stroke="var(--text-secondary)" style={{ fontSize: '11px' }} />
                      <YAxis yAxisId="left" stroke="var(--accent-strava)" label={{ value: 'Distance (km)', angle: -90, position: 'insideLeft', fill: 'var(--accent-strava)' }} />
                      <YAxis yAxisId="right" orientation="right" stroke="var(--accent-cyan)" domain={[3, 8]} reversed label={{ value: 'Pace (min/km)', angle: 90, position: 'insideRight', fill: 'var(--accent-cyan)' }} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload as Workout & { paceFormatted: string, speedKmh: number };
                            return (
                              <div className="custom-tooltip">
                                <div className="tooltip-title">{data.name}</div>
                                <div className="tooltip-line">Date: {data.date}</div>
                                <div className="tooltip-line" style={{ color: 'var(--accent-strava)' }}>Distance: {data.distance_km} km</div>
                                <div className="tooltip-line">Duration: {data.duration_min} min</div>
                                <div className="tooltip-line" style={{ color: 'var(--accent-cyan)' }}>Pace: {data.paceFormatted} min/km</div>
                                <div className="tooltip-line">Speed: {data.speedKmh} km/h</div>
                                {data.avg_hr && <div className="tooltip-line" style={{ color: 'var(--accent-red)' }}>Avg HR: {data.avg_hr} bpm</div>}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="distance_km" stroke="var(--accent-strava)" strokeWidth={2} dot={{ r: 4 }} name="Run Distance (km)" />
                      <Line yAxisId="right" type="monotone" dataKey="paceDecimal" stroke="var(--accent-cyan)" strokeWidth={2} dot={{ r: 4 }} name="Pace (min/km)" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="empty-state">No running data found</div>
              )}
            </div>

            {/* Run Stats card */}
            <div className="glass-card chart-card card-col-4" style={{ minHeight: 'auto' }}>
              <h3 className="section-title"><Award size={18} color="var(--accent-yellow)" /> Running Highlights</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
                <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Longest Distance</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--accent-strava)' }}>
                    {runningData.length > 0 ? Math.max(...runningData.map(r => r.distance_km)).toFixed(2) : '0.00'} <span style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--text-muted)' }}>km</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {runningData.length > 0 ? `Achieved on ${runningData.sort((a,b) => b.distance_km - a.distance_km)[0].date}` : ''}
                  </div>
                </div>

                <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Best Running Pace</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                    {runningData.length > 0 ? formatPace(Math.min(...runningData.filter(r => r.distance_km > 0.5).map(r => r.paceDecimal))) : '--:--'} <span style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--text-muted)' }}>/km</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {runningData.length > 0 ? `Achieved on ${runningData.filter(r => r.distance_km > 0.5).sort((a,b) => a.paceDecimal - b.paceDecimal)[0].date}` : ''}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total Run Elevation</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--accent-purple)' }}>
                    {runningData.reduce((sum, r) => sum + r.elevation_m, 0)} <span style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--text-muted)' }}>meters</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Gained across {runningData.length} running sessions
                  </div>
                </div>
              </div>
            </div>

            {/* Run Pace vs Heart Rate Scatter Plot (2026) */}
            <div className="glass-card chart-card card-col-12">
              <h3 className="section-title"><Heart size={18} color="var(--accent-red)" /> Running Pace vs. Average Heart Rate (2026)</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Analyzing the relationship between running pace (slower pace on the right) and average cardiovascular stress.
              </p>
              {runningData.filter(r => r.year === 2026 && r.avg_hr !== null).length > 0 ? (
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 0 }}>
                      <CartesianGrid stroke="var(--border-color)" />
                      <XAxis type="number" dataKey="paceDecimal" name="Pace" unit=" min/km" stroke="var(--text-secondary)" domain={[4, 8.5]} />
                      <YAxis type="number" dataKey="avg_hr" name="Average HR" unit=" bpm" stroke="var(--text-secondary)" domain={[150, 195]} />
                      <ZAxis type="number" dataKey="distance_km" range={[40, 400]} name="Distance" unit=" km" />
                      <Tooltip 
                        cursor={{ strokeDasharray: '3 3' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload as Workout & { paceFormatted: string };
                            return (
                              <div className="custom-tooltip">
                                <div className="tooltip-title">{data.name}</div>
                                <div className="tooltip-line">Date: {data.date}</div>
                                <div className="tooltip-line" style={{ color: 'var(--accent-cyan)' }}>Pace: {data.paceFormatted} min/km</div>
                                <div className="tooltip-line" style={{ color: 'var(--accent-red)' }}>Avg HR: {data.avg_hr} bpm</div>
                                <div className="tooltip-line">Distance: {data.distance_km} km</div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend />
                      <Scatter name="Running Activities" data={runningData.filter(r => r.year === 2026 && r.avg_hr !== null)} fill="var(--accent-strava)" />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="empty-state">No heart rate tracked runs available.</div>
              )}
            </div>

          </div>
        )}

        {/* CARDIO INTENSITY & HEART RATE TAB */}
        {activeTab === 'heartrate' && (
          <div className="dashboard-grid">
            
            {/* Heart Rate Zones Distribution */}
            <div className="glass-card chart-card card-col-12" style={{ minHeight: 'auto', paddingBottom: '24px' }}>
              <h3 className="section-title"><Heart size={18} color="var(--accent-red)" /> Cardio Training Intensity Zones (2026)</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Classification of 2026 workouts based on average heart rate, illustrating the primary metabolic system trained.
              </p>
              
              <div className="zones-grid">
                {hrZonesData.map((zone) => (
                  <div 
                    key={zone.name} 
                    className={`zone-box ${zone.count > 0 ? 'active' : ''}`}
                    style={{ 
                      '--zone-color': zone.color,
                      '--zone-color-rgb': zone.rgb
                    } as React.CSSProperties}
                  >
                    <span className="zone-number">{zone.name.split(':')[0]}</span>
                    <span className="zone-name">{zone.name.split(':')[1]}</span>
                    <span className="zone-range">{zone.range}</span>
                    <span className="zone-count">{zone.count} <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'var(--text-muted)' }}>workouts</span></span>
                  </div>
                ))}
              </div>
            </div>

            {/* Average Heart Rate by Workout Type */}
            <div className="glass-card chart-card card-col-6">
              <h3 className="section-title"><Dumbbell size={18} color="var(--accent-yellow)" /> Cardiovascular Load by Activity</h3>
              {hrByActivityType.length > 0 ? (
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={hrByActivityType} layout="vertical" margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                      <XAxis type="number" stroke="var(--text-secondary)" domain={[80, 190]} />
                      <YAxis type="category" dataKey="activity" stroke="var(--text-secondary)" style={{ fontSize: '12px' }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px' }}
                      />
                      <Bar dataKey="Average Heart Rate" fill="var(--accent-red)" radius={[0, 4, 4, 0]}>
                        {hrByActivityType.map((entry, index) => {
                          const originalType = Object.keys(ACTIVITY_NAMES).find(key => ACTIVITY_NAMES[key] === entry.activity) || entry.activity;
                          const color = ACTIVITY_COLORS[originalType] || 'var(--accent-red)';
                          return <Cell key={`cell-${index}`} fill={color} />;
                        })}
                      </Bar>
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="empty-state">No heart rate data available</div>
              )}
            </div>

            {/* Max vs Avg HR Chart */}
            <div className="glass-card chart-card card-col-6">
              <h3 className="section-title"><Heart size={18} color="var(--accent-strava)" /> 2026 Activity Heart Rate Breakdown</h3>
              {workouts.filter(w => w.year === 2026 && w.avg_hr !== null).length > 0 ? (
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={workouts.filter(w => w.year === 2026 && w.avg_hr !== null).reverse()} margin={{ top: 20, right: 20, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                      <XAxis dataKey="date" stroke="var(--text-secondary)" style={{ fontSize: '10px' }} />
                      <YAxis stroke="var(--text-secondary)" domain={[80, 200]} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px' }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="max_hr" stroke="var(--accent-red)" name="Max Heart Rate" dot={false} strokeWidth={2} />
                      <Line type="monotone" dataKey="avg_hr" stroke="var(--accent-yellow)" name="Average Heart Rate" dot={false} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="empty-state">No HR timeline available</div>
              )}
            </div>

          </div>
        )}

        {/* AI COACH AND WHAT-IF SIMULATOR */}
        {activeTab === 'coach' && (
          <div className="dashboard-grid" style={{ display: 'block', padding: '24px' }}>
            
            {/* Coach Header Intro */}
            <div className="glass-card coach-header-card">
              <div className="coach-intro">
                <span className="coach-subtitle">Training Analytics & Advisory</span>
                <h3 style={{ fontSize: '24px', fontWeight: 800, margin: '4px 0 8px' }}>AI Workout Coach & Performance Advisor</h3>
                <p className="coach-description">
                  Based on your workout logs from 2025 and 2026 (comparing the Jan-Jun periods), here is a personalized analysis of your physical training habits, areas of concern, and actionable guidance to optimize your athletic improvements.
                </p>
              </div>
            </div>

            {/* Row of Coach Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
              
              {/* Card 1: Volume Decline */}
              <div className="glass-card insight-card" style={{ '--insight-color': 'var(--accent-strava)' } as React.CSSProperties}>
                <div className="insight-header">
                  <div className="insight-icon-container"><AlertTriangle size={18} /></div>
                  <h4 className="insight-title">Activity Frequency Alert</h4>
                </div>
                <div className="insight-body">
                  In 2025 (Jan-Jun), you completed <strong>59 sessions</strong>. In 2026 (Jan-May), you have completed <strong>39 sessions</strong>. This represents a <strong>33.9% drop</strong> in active workout consistency. January to March 2026 was particularly quiet, though you have rebuilt excellent momentum in April and May!
                </div>
                <div className="insight-actionable">
                  💡 <strong>Goal:</strong> Re-establish a baseline of 3-4 workouts per week to recover your 2025 aerobic capacity.
                </div>
              </div>

              {/* Card 2: Running Intensity */}
              <div className="glass-card insight-card" style={{ '--insight-color': 'var(--accent-red)' } as React.CSSProperties}>
                <div className="insight-header">
                  <div className="insight-icon-container"><Heart size={18} /></div>
                  <h4 className="insight-title">High running intensity (Zone 4/5)</h4>
                </div>
                <div className="insight-body">
                  In 2026, your average running heart rate is <strong>174.5 bpm</strong>, with peak rates hitting <strong>196 bpm</strong>. This indicates you are executing almost every single run at a hard Threshold or Peak intensity. Running constantly in Zone 4/5 limits aerobic development and elevates risk of chronic fatigue or injury.
                </div>
                <div className="insight-actionable">
                  💡 <strong>Goal:</strong> Introduce slow, conversational runs (Zone 2, average HR under 140 bpm) for 80% of your weekly distance.
                </div>
              </div>

              {/* Card 3: Recovery / Strength Balance */}
              <div className="glass-card insight-card" style={{ '--insight-color': 'var(--accent-purple)' } as React.CSSProperties}>
                <div className="insight-header">
                  <div className="insight-icon-container"><Dumbbell size={18} /></div>
                  <h4 className="insight-title">Active Recovery & Strength</h4>
                </div>
                <div className="insight-body">
                  In 2025, you did 5 Pilates and 1 Yoga session. In 2026, you completed 5 Yoga sessions and 4 Walks. Great work preserving flexibility! However, you have <strong>0 strength training sessions</strong> in 2026 compared to 2025. Running and HIIT demand solid joint stability from resistance training.
                </div>
                <div className="insight-actionable">
                  💡 <strong>Goal:</strong> Replace 1 HIIT session with 1 structured strength training (WeightTraining / Bodypump) session.
                </div>
              </div>

            </div>

            {/* Recommendations & What-If split */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
              
              {/* Recommendations Box */}
              <div className="glass-card recommendations-box">
                <h3 className="section-title"><Award size={18} color="var(--accent-yellow)" /> Action Plan for Improvement</h3>
                
                <div className="rec-list">
                  <div className="rec-item">
                    <span className="rec-num">1</span>
                    <div className="rec-content">
                      <h4>Adopt the 80/20 Running Rule</h4>
                      <p>Currently, 100% of your runs are high intensity. Aim to make 4 out of 5 runs extremely easy (Zone 2, comfortable pace). This builds mitochondrial density, improves run efficiency, and lowers resting heart rate.</p>
                    </div>
                  </div>

                  <div className="rec-item">
                    <span className="rec-num">2</span>
                    <div className="rec-content">
                      <h4>Integrate Joint Stability Strength Work</h4>
                      <p>Runners need core and lower body stability. Add back at least 1 WeightTraining or high-quality Bodypump session per week. Focus on single-leg movements (lunges, step-ups) and glute activation.</p>
                    </div>
                  </div>

                  <div className="rec-item">
                    <span className="rec-num">3</span>
                    <div className="rec-content">
                      <h4>Standardize Heart Rate Tracking</h4>
                      <p>Congratulations on introducing heart rate tracking in 2026! It provides key physiological insights. Continue wearing your monitor for all workouts to track cardiovascular efficiency gains (faster pace at lower HR).</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* What-If Simulator */}
              <div className="glass-card simulator-card">
                <h3 className="section-title"><Sliders size={18} color="var(--accent-cyan)" /> "What-If" Training Volume Simulator</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Adjust the sliders to simulate changes in your weekly routine. See how minor consistency adjustments affect your weekly and monthly activity levels.
                </p>

                <div className="simulator-controls">
                  <div className="slider-group">
                    <div className="slider-header">
                      <span className="slider-label">Easy Runs per Week</span>
                      <span className="slider-value">{simWeeklyRuns} runs</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="6" 
                      step="1"
                      value={simWeeklyRuns}
                      onChange={(e) => setSimWeeklyRuns(parseInt(e.target.value))}
                    />
                  </div>

                  <div className="slider-group">
                    <div className="slider-header">
                      <span className="slider-label">HIIT / Bodypump Sessions per Week</span>
                      <span className="slider-value">{simWeeklyHIIT} workouts</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="6" 
                      step="1"
                      value={simWeeklyHIIT}
                      onChange={(e) => setSimWeeklyHIIT(parseInt(e.target.value))}
                    />
                  </div>

                  <div className="slider-group">
                    <div className="slider-header">
                      <span className="slider-label">Yoga / Pilates Sessions per Week</span>
                      <span className="slider-value">{simWeeklyYoga} sessions</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="4" 
                      step="1"
                      value={simWeeklyYoga}
                      onChange={(e) => setSimWeeklyYoga(parseInt(e.target.value))}
                    />
                  </div>
                </div>

                <div className="simulator-results">
                  <div className="sim-result-row">
                    <span className="sim-result-label">Weekly Workouts:</span>
                    <span className="sim-result-val">
                      {simulatorResults.currentWeeklyWorkouts} <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'var(--text-muted)' }}>current</span>
                      <ArrowRight size={12} style={{ margin: '0 8px', color: 'var(--text-muted)' }} />
                      <span className="highlight">{simulatorResults.simulatedWeeklyWorkouts}</span>
                    </span>
                  </div>

                  <div className="sim-result-row">
                    <span className="sim-result-label">Weekly Active Time:</span>
                    <span className="sim-result-val">
                      {simulatorResults.currentWeeklyDuration}m <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'var(--text-muted)' }}>current</span>
                      <ArrowRight size={12} style={{ margin: '0 8px', color: 'var(--text-muted)' }} />
                      <span className="highlight">{simulatorResults.simulatedWeeklyDuration}m</span>
                    </span>
                  </div>

                  <div className="sim-result-row">
                    <span className="sim-result-label">Est. Monthly Mileage:</span>
                    <span className="sim-result-val highlight">{simulatorResults.simulatedMonthlyDistance} km</span>
                  </div>

                  <div className="sim-result-row">
                    <span className="sim-result-label">Est. Monthly Active Sessions:</span>
                    <span className="sim-result-val highlight">{simulatorResults.simulatedMonthlyWorkouts} workouts</span>
                  </div>

                  <div style={{ marginTop: '16px' }}>
                    <div className="progress-bar-container">
                      {/* Scale progress relative to max potential weekly hours (10 hours = 600 mins) */}
                      <div 
                        className="progress-bar-fill" 
                        style={{ width: `${Math.min((simulatorResults.simulatedWeeklyDuration / 600) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      <span>0 hrs</span>
                      <span>5 hrs</span>
                      <span>10 hrs/week potential</span>
                    </div>
                  </div>
                </div>

              </div>

            </div>

          </div>
        )}

        {/* WORKOUT LOG TABLE TAB */}
        {activeTab === 'logs' && (
          <div className="dashboard-grid" style={{ display: 'block', padding: '24px' }}>
            <div className="glass-card table-card">
              <div className="table-header-row">
                <h3 className="section-title" style={{ marginBottom: 0 }}><Calendar size={18} color="var(--accent-strava)" /> Detailed Workouts Registry</h3>
                <input 
                  type="text" 
                  className="table-search" 
                  placeholder="Search by name or type..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {filteredWorkouts.length > 0 ? (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Activity Name</th>
                        <th>Duration</th>
                        <th>Distance</th>
                        <th>Elevation</th>
                        <th>Avg HR</th>
                        <th>Kudos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredWorkouts.map((workout) => {
                        const typeClass = `badge-${workout.type.toLowerCase()}`;
                        const displayType = ACTIVITY_NAMES[workout.type] || workout.type;
                        
                        return (
                          <tr key={workout.id}>
                            <td style={{ whiteSpace: 'nowrap' }}>{workout.date}</td>
                            <td>
                              <span className={`activity-badge ${typeClass}`}>
                                {displayType}
                              </span>
                            </td>
                            <td className="table-row-name">{workout.name}</td>
                            <td>{workout.duration_min} min</td>
                            <td>{workout.distance_km > 0 ? `${workout.distance_km.toFixed(2)} km` : '--'}</td>
                            <td>{workout.elevation_m > 0 ? `${workout.elevation_m} m` : '--'}</td>
                            <td style={{ color: workout.avg_hr ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                              {workout.avg_hr ? `${workout.avg_hr} bpm` : '--'}
                            </td>
                            <td>{workout.kudos} 👍</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <Info size={32} style={{ marginBottom: '12px' }} />
                  <p>No workouts match the search query or year filter.</p>
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      {/* CSV Uploader Modal / Dropzone */}
      {isDropzoneOpen && (
        <div className="dropzone-overlay" onClick={() => setIsDropzoneOpen(false)}>
          <div 
            className="glass-card dropzone-container" 
            onClick={(e) => e.stopPropagation()}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
          >
            <button className="close-dropzone-btn" onClick={() => setIsDropzoneOpen(false)}>
              <X size={20} />
            </button>
            
            <div className={`dropzone-content ${dragActive ? 'drag-active' : ''}`}>
              <UploadCloud className="dropzone-icon" />
              <h3 className="dropzone-title">Upload Workout Log CSV</h3>
              <p className="dropzone-text">
                Drag and drop your workout log CSV files (e.g., 2025 or 2026 data) here to parse them dynamically, or browse files on your computer.
              </p>
              
              <label className="upload-btn" style={{ display: 'inline-flex', margin: '0 auto', cursor: 'pointer' }}>
                <span>Select CSV File</span>
                <input 
                  type="file" 
                  accept=".csv" 
                  style={{ display: 'none' }} 
                  onChange={handleFileChange}
                />
              </label>
              
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '24px' }}>
                Note: CSV files should contain: date, name, type, duration_min, distance_km, elevation_m, avg_hr, max_hr, kudos
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
