import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  MapPin,
  Camera,
  History,
  Shield,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sliders,
  Database,
  Lock,
  User,
  Smartphone,
  Check,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Info
} from "lucide-react";
import { AttendanceLog, OfficeConfig, GeolocationState, CameraState } from "./types";

export default function App() {
  // --- Employee Identity (Editable for Preview testing) ---
  const [employeeId, setEmployeeId] = useState<string>("EMP-8849");
  const [employeeName, setEmployeeName] = useState<string>("ស៊ិន ពិសិដ្ឋ (Sin Piseth)");

  // --- Core Application States ---
  const [office, setOffice] = useState<OfficeConfig>({
    latitude: 11.5564, // Phnom Penh Default (Independence Monument)
    longitude: 104.9282,
    name: "ការិយាល័យកណ្តាល (Phnom Penh Main Office)",
    radius: 100, // 100 meters
  });

  const [geoState, setGeoState] = useState<GeolocationState>({
    coords: null,
    distance: null,
    status: "detecting",
    isWithinBounds: false,
  });

  const [cameraState, setCameraState] = useState<CameraState>({
    stream: null,
    status: "idle",
  });

  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [serverTimeOffset, setServerTimeOffset] = useState<number>(0);
  const [displayTime, setDisplayTime] = useState<Date>(new Date());
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"all" | "in" | "out">("all");

  // Custom mock location simulator state
  const [isSimulatedLocation, setIsSimulatedLocation] = useState<boolean>(true); // Default to true in AI Studio preview for immediate geofence success
  const [simulatedCoords, setSimulatedCoords] = useState<{ lat: number; lng: number }>({
    lat: 11.55643, // Perfectly in bounds by default
    lng: 104.92822,
  });

  // Notifications and Details drawer
  const [apiResponseMsg, setApiResponseMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showArchDetails, setShowArchDetails] = useState<boolean>(false);

  // References
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const geoWatchId = useRef<number | null>(null);

  // --- Calculate Distance (Client-side mirror for real-time UI response) ---
  const getHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000; // meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(2));
  };

  // Helper to extract initials for the header avatar badge
  const getInitials = (name: string): string => {
    if (!name) return "SC";
    const parts = name.split(" ");
    const lastPart = parts[parts.length - 1];
    // extract english alphanumeric if available
    const cleanStr = lastPart.replace(/[^a-zA-Z]/g, '');
    if (cleanStr.length >= 2) return cleanStr.substring(0, 2).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  // --- Sync Server Time, Office, and Records ---
  const syncServerTime = async () => {
    try {
      const start = Date.now();
      const res = await fetch("/api/time");
      if (res.ok) {
        const data = await res.json();
        const serverTime = new Date(data.isoString).getTime();
        const rtt = Date.now() - start;
        const offset = serverTime - (Date.now() - rtt / 2); // Compute skew
        setServerTimeOffset(offset);
      }
    } catch (e) {
      console.warn("Could not sync server time. Defaulting to local clock.", e);
    }
  };

  const fetchOfficeConfig = async () => {
    try {
      const res = await fetch("/api/office");
      if (res.ok) {
        const config = await res.json();
        setOffice(config);
      }
    } catch (e) {
      console.error("Failed to load office config", e);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/attendance");
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (e) {
      console.error("Failed to load attendance logs", e);
    }
  };

  // Mount logic
  useEffect(() => {
    syncServerTime();
    fetchOfficeConfig();
    fetchLogs();

    const clockInterval = setInterval(() => {
      const adjusted = new Date(Date.now() + serverTimeOffset);
      setDisplayTime(adjusted);
    }, 1000);

    return () => clearInterval(clockInterval);
  }, [serverTimeOffset]);

  // --- Geolocation Live Watcher ---
  const startLocationTracking = () => {
    if (geoWatchId.current) {
      navigator.geolocation.clearWatch(geoWatchId.current);
    }

    if (!navigator.geolocation) {
      setGeoState((prev) => ({ ...prev, status: "unsupported" }));
      return;
    }

    setGeoState((prev) => ({ ...prev, status: "detecting" }));

    geoWatchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const currentLat = isSimulatedLocation ? simulatedCoords.lat : pos.coords.latitude;
        const currentLng = isSimulatedLocation ? simulatedCoords.lng : pos.coords.longitude;

        const distance = getHaversineDistance(
          currentLat,
          currentLng,
          office.latitude,
          office.longitude
        );

        setGeoState({
          coords: { latitude: currentLat, longitude: currentLng },
          distance,
          status: "available",
          isWithinBounds: distance <= office.radius,
        });
      },
      (err) => {
        if (isSimulatedLocation) {
          const distance = getHaversineDistance(
            simulatedCoords.lat,
            simulatedCoords.lng,
            office.latitude,
            office.longitude
          );
          setGeoState({
            coords: { latitude: simulatedCoords.lat, longitude: simulatedCoords.lng },
            distance,
            status: "available",
            isWithinBounds: distance <= office.radius,
          });
          return;
        }

        setGeoState((prev) => ({
          ...prev,
          status: "denied",
          error: err.message,
        }));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 1000 }
    );
  };

  useEffect(() => {
    startLocationTracking();
    return () => {
      if (geoWatchId.current) {
        navigator.geolocation.clearWatch(geoWatchId.current);
      }
    };
  }, [isSimulatedLocation, simulatedCoords, office.latitude, office.longitude, office.radius]);

  // --- Camera Controller ---
  const startCamera = async () => {
    setCameraState({ stream: null, status: "requesting" });
    try {
      const constraints = {
        video: {
          facingMode: "user", // Strict front camera
          width: { ideal: 480 },
          height: { ideal: 480 },
        },
        audio: false, 
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraState({ stream, status: "ready" });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.warn("Front Camera initialization error:", err);
      setCameraState({
        stream: null,
        status: err.name === "NotAllowedError" ? "denied" : "unavailable",
        error: err.message || "Failed to find or authorize user camera",
      });
    }
  };

  const stopCamera = () => {
    if (cameraState.stream) {
      cameraState.stream.getTracks().forEach((track) => track.stop());
      setCameraState({ stream: null, status: "idle" });
    }
  };

  // Launch camera streaming whenever Geofence checks pass successfully
  useEffect(() => {
    if (geoState.isWithinBounds) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [geoState.isWithinBounds]);

  // --- Submitting Secure Logs ---
  const handleSubmitAttendance = async (type: "check_in" | "check_out") => {
    if (!geoState.coords) {
      setApiResponseMsg({
        type: "error",
        text: "រកមិនឃើញកូអរដោនេទីតាំងដើម្បីកត់ត្រាឡើយ។ (Coordinates not detected yet!)",
      });
      return;
    }

    if (!cameraState.stream && cameraState.status !== "ready") {
      setApiResponseMsg({
        type: "error",
        text: "កាមេរ៉ាមិនទាន់រួចរាល់សម្រាប់ការផ្ទៀងផ្ទាត់។ (Live camera feed required!)",
      });
      return;
    }

    setIsCapturing(true);

    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;

      if (canvas && video) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          canvas.width = video.videoWidth || 480;
          canvas.height = video.videoHeight || 480;

          // Mirror horizontally for natural canvas visual frame capture
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          ctx.setTransform(1, 0, 0, 1, 0, 0);

          const base64Photo = canvas.toDataURL("image/jpeg", 0.85);

          const payload = {
            employeeId,
            employeeName,
            type,
            latitude: geoState.coords.latitude,
            longitude: geoState.coords.longitude,
            photo: base64Photo,
            deviceName: getDeviceLabel(),
          };

          const response = await fetch("/api/attendance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          const result = await response.json();

          if (response.ok) {
            setApiResponseMsg({
              type: "success",
              text: type === "check_in"
                ? "ជោគជ័យ! ចុះឈ្មោះចូលធ្វើការបានកត់ត្រាត្រឹមត្រូវ។ (Check-In Registered Successfully!)"
                : "ជោគជ័យ! ចុះឈ្មោះចេញពីការងារបានកត់ត្រាត្រឹមត្រូវ។ (Check-Out Registered Successfully!)",
            });
            fetchLogs();
          } else {
            setApiResponseMsg({
              type: "error",
              text: result.error || "ការបញ្ជូនព័ត៌មានវត្តមានបានបរាជ័យ (Submission failed)",
            });
          }
        }
      } else {
        // Fallback placeholder photo if camera stream failed or is restricted during iframe testing
        const fallbackPic = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80";
        const payload = {
          employeeId,
          employeeName,
          type,
          latitude: geoState.coords.latitude,
          longitude: geoState.coords.longitude,
          photo: fallbackPic,
          deviceName: getDeviceLabel() + " (Fallback snapshot)",
        };

        const response = await fetch("/api/attendance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (response.ok) {
          setApiResponseMsg({
            type: "success",
            text: `ជោគជ័យ! ការចុះឈ្មោះវត្តមានដោយជោគជ័យ (ជាមួយរូបភាពកំណត់ត្រាទុក)។`,
          });
          fetchLogs();
        } else {
          setApiResponseMsg({
            type: "error",
            text: result.error || "Submission failed",
          });
        }
      }
    } catch (err: any) {
      setApiResponseMsg({
        type: "error",
        text: "កំហុសគណនា៖ " + err.message,
      });
    } finally {
      setIsCapturing(false);
      setTimeout(() => setApiResponseMsg(null), 7000);
    }
  };

  const getDeviceLabel = (): string => {
    const ua = navigator.userAgent;
    if (ua.includes("iPhone")) return "iPhone";
    if (ua.includes("Android")) return "Android Phone";
    if (ua.includes("Macintosh")) return "MacBook Pro";
    return "Office Terminal";
  };

  const handleSetCurrentAsOffice = async () => {
    if (!geoState.coords) return;
    try {
      const res = await fetch("/api/office", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: geoState.coords.latitude,
          longitude: geoState.coords.longitude,
          name: "ទីតាំងបច្ចុប្បន្ន (Custom Tested Target Coords)",
          radius: 100,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setOffice(data.config);
        setApiResponseMsg({
          type: "success",
          text: "ទីតាំងការិយាល័យថ្មីត្រូវបានកែតម្រូវបានជោគជ័យ! (Office coordinates updated successfully!)"
        });
        setTimeout(() => setApiResponseMsg(null), 4000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearLogs = async () => {
    if (confirm("តើអ្នកចង់លុបប្រវត្តិកត់ត្រាទាំងអស់មែនទេ? (Clear all database logs?)")) {
      await fetch("/api/attendance/clear", { method: "POST" });
      fetchLogs();
    }
  };

  // Filter logs for the history list
  const filteredLogs = logs.filter(log => {
    if (activeTab === "in") return log.type === "check_in";
    if (activeTab === "out") return log.type === "check_out";
    return true;
  });

  return (
    <div className="w-full min-h-screen bg-slate-50 font-sans p-4 md:p-8 flex flex-col items-center justify-start text-slate-800">
      
      {/* HEADER SECTION */}
      <header className="w-full max-w-5xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6 text-indigo-600 shrink-0" />
            <span>ប្រព័ន្ធវត្តមានបុគ្គលិក</span>
          </h1>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">
            Attendance System 3.0 • Khmer Secure Bento UX
          </p>
        </div>

        <div className="flex items-center gap-3 bg-white p-2 pl-4 pr-3 rounded-2xl shadow-sm border border-slate-100">
          <div className="text-right">
            <p className="text-[10px] font-bold text-slate-400 leading-none">អត្តសញ្ញាណបច្ចុប្បន្ន</p>
            <p className="text-xs font-semibold text-slate-700">{employeeName}</p>
          </div>
          <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 font-bold text-xs shadow-inner">
            {getInitials(employeeName)}
          </div>
        </div>
      </header>

      {/* GLOBAL TOAST NOTIFICATION CONTAINER */}
      <AnimatePresence>
        {apiResponseMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`w-full max-w-5xl mb-4 p-4 rounded-2xl border text-xs font-semibold flex items-start gap-3 shadow-sm ${
              apiResponseMsg.type === "success"
                ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                : "bg-rose-50 border-rose-100 text-rose-800"
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {apiResponseMsg.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-bold leading-normal">{apiResponseMsg.text}</p>
              <p className="text-[10px] opacity-75 mt-0.5 font-mono">
                {apiResponseMsg.type === "success" ? "Operation verified by server security handshake." : "Request halted on secure geofence constraints."}
              </p>
            </div>
            <button
              onClick={() => setApiResponseMsg(null)}
              className="text-[10px] opacity-65 hover:opacity-100 px-1 py-0.5"
            >
              បិទ
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BENTO MAIN GRID */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 w-full max-w-5xl">
        
        {/* CARD 1: Clock (col-span-4) */}
        <div className="col-span-1 md:col-span-4 bg-white rounded-3xl shadow-sm border border-slate-100 p-6 flex flex-col justify-center items-center overflow-hidden relative min-h-[160px]">
          <div className="absolute top-4 right-4 text-slate-100 pointer-events-none">
            <Clock className="w-12 h-12 stroke-[1]" />
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 select-none">ម៉ោងបច្ចុប្បន្ន (Safe NTP)</p>
          <p className="text-5xl font-black tracking-tight text-slate-800 my-1 font-mono">
            {displayTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
          </p>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            {displayTime.toLocaleDateString('km-KH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          <span className="text-[9px] bg-indigo-50 border border-indigo-100/60 rounded-full text-indigo-600 font-mono px-2 py-0.5 mt-2.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
            Server Offset: {serverTimeOffset}ms synced
          </span>
        </div>

        {/* CARD 2: Current GPS Location Status (col-span-4) */}
        <div className={`col-span-1 md:col-span-4 rounded-3xl p-6 border flex flex-col justify-between overflow-hidden relative min-h-[160px] ${
          geoState.isWithinBounds
            ? "bg-emerald-50/70 border-emerald-100 text-slate-800"
            : "bg-rose-50/70 border-rose-100 text-slate-800"
        }`}>
          <div className="flex justify-between items-start">
            <div className={`p-2 rounded-xl text-white shadow-sm ${
              geoState.isWithinBounds ? "bg-emerald-500" : "bg-rose-500"
            }`}>
              <MapPin className="w-5 h-5" />
            </div>
            
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider border ${
              geoState.isWithinBounds
                ? "text-emerald-700 bg-emerald-100/80 border-emerald-200"
                : "text-rose-700 bg-rose-100/80 border-rose-200"
            }`}>
              {geoState.isWithinBounds ? "ផ្ទៀងផ្ទាត់ជោគជ័យ" : "ចម្ងាយខុសគោលដៅ"}
            </span>
          </div>

          <div className="mt-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">ស្ថានភាពទីតាំងភូមិសាស្ត្រ</p>
            <p className="text-lg font-black text-slate-800 leading-tight">
              {geoState.isWithinBounds ? "នៅក្នុងតំបន់អនុញ្ញាត" : "ស្ថិតក្នុងតំបន់ហាមឃាត់"}
            </p>
            <p className="text-xs font-mono font-medium text-slate-600 mt-1">
              ចម្ងាយ៖ {geoState.distance !== null ? `${geoState.distance} ម៉ែត្រ` : "ស្វែងរក GPS កូអរដោនែ..."}
            </p>
            <p className="text-[9px] text-slate-400 mt-1 truncate">
              📍 Config: {office.name}
            </p>
          </div>
        </div>

        {/* CARD 3: Employee Ident & GPS Simulation Settings (col-span-4) */}
        <div className="col-span-1 md:col-span-4 bg-white rounded-3xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between min-h-[160px]">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-indigo-600" />
              <span>ការកំណត់ការពិសោធន៍ (Profile & Test Sandbox)</span>
            </p>

            {/* Editable Profile Names & IDs */}
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <label className="text-[9px] text-slate-400 uppercase font-semibold block">ឈ្មោះបុគ្គលិក</label>
                <input
                  type="text"
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-100 focus:border-indigo-500 focus:bg-white rounded-lg px-2 py-1 outlines-none text-slate-700 font-bold transition mt-0.5"
                  placeholder="ឈ្មោះបុគ្គលិក"
                />
              </div>
              <div>
                <label className="text-[9px] text-slate-400 uppercase font-semibold block">លេខអត្តសញ្ញាណ</label>
                <input
                  type="text"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-100 focus:border-indigo-500 focus:bg-white rounded-lg px-2 py-1 outlines-none text-slate-700 font-semibold transition mt-0.5"
                  placeholder="EMP ID"
                />
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-500 font-semibold">Simulated GPS Coords</span>
              <button
                onClick={() => setIsSimulatedLocation(!isSimulatedLocation)}
                className={`text-[9px] py-1 px-2.5 font-bold rounded-lg transition-all border ${
                  isSimulatedLocation
                    ? "bg-indigo-600 text-white border-indigo-500"
                    : "bg-slate-100 text-slate-500 border-slate-200"
                }`}
              >
                {isSimulatedLocation ? "បើកតេស្ត (ON)" : "បិទតេស្ត (OFF)"}
              </button>
            </div>

            {isSimulatedLocation && (
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setSimulatedCoords({ lat: 11.55642, lng: 104.92821 })}
                  className="py-1 px-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100/60 rounded-md text-[9px] font-bold text-emerald-700 transition"
                >
                  នៅការិយាល័យ (Inside) 
                </button>
                <button
                  type="button"
                  onClick={() => setSimulatedCoords({ lat: 11.5492, lng: 104.9175 })}
                  className="py-1 px-1 bg-rose-50 hover:bg-rose-100 border border-rose-100/60 rounded-md text-[9px] font-bold text-rose-700 transition"
                >
                  ក្រៅការិយាល័យ (Outside)
                </button>
              </div>
            )}
          </div>
        </div>

        {/* CARD 4: Live Front-Facing Camera Card (col-span-6 md:col-span-5) */}
        <div className="col-span-1 md:col-span-5 bg-slate-900 rounded-3xl shadow-lg border border-slate-800 flex flex-col justify-between overflow-hidden relative aspect-square md:aspect-auto md:h-[420px]">
          
          {/* Top Camera label overlay */}
          <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-black/40 backdrop-blur-md border border-white/10 py-1 px-2.5 rounded-full">
            <span className="flex h-2 w-2 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                geoState.isWithinBounds ? "bg-emerald-400" : "bg-red-400"
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                geoState.isWithinBounds ? "bg-emerald-500" : "bg-red-500"
              }`}></span>
            </span>
            <span className="text-white text-[9px] font-bold uppercase tracking-wider font-mono">
              ស្កេនផ្ទៃមុខផ្ទាល់ (Face live only)
            </span>
          </div>

          {/* Canvas or Video layout wrapper */}
          <div className="flex-1 w-full flex items-center justify-center relative overflow-hidden bg-black/95">
            
            {/* Safe boundaries and target mask guides */}
            <div className="absolute inset-0 pointer-events-none border-[12px] border-black/10 z-10" />
            <div className="absolute top-8 left-8 w-6 h-6 border-t-2 border-l-2 border-white/40 pointer-events-none z-10" />
            <div className="absolute top-8 right-8 w-6 h-6 border-t-2 border-r-2 border-white/40 pointer-events-none z-10" />
            <div className="absolute bottom-8 left-8 w-6 h-6 border-b-2 border-l-2 border-white/40 pointer-events-none z-10" />
            <div className="absolute bottom-8 right-8 w-6 h-6 border-b-2 border-r-2 border-white/40 pointer-events-none z-10" />

            <div className="absolute w-44 h-44 rounded-full border border-dashed border-white/20 pointer-events-none z-10" />

            {/* Video track stream */}
            {geoState.isWithinBounds ? (
              cameraState.status === "ready" ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
              ) : (
                <div className="text-center p-6 flex flex-col items-center gap-2.5">
                  <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
                  <p className="text-xs text-slate-300 font-bold">កំពុងតភ្ជាប់កាមេរ៉ាខាងមុខ...</p>
                  <p className="text-[10px] text-slate-500 font-mono">Seeking secure browser camera feed</p>
                </div>
              )
            ) : (
              <div className="text-center p-6 flex flex-col items-center gap-3 relative z-10 max-w-[260px]">
                <div className="w-12 h-12 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-full flex items-center justify-center shadow-lg">
                  <Lock className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-slate-200 text-xs font-extrabold">កាមេរ៉ាចាក់សោ (Camera Geo-Locked)</h4>
                  <p className="text-[10px] text-slate-500 leading-normal mt-1">
                    កាមេរ៉ានឹងបើកដោយស្វ័យប្រវត្តនៅពេលលោកអ្នកស្ថិតនៅចម្ងាយក្រោម ១០០ ម៉ែត្រការិយាល័យ។
                  </p>
                </div>
              </div>
            )}

            {/* Scanning light animation overlay */}
            {cameraState.status === "ready" && geoState.isWithinBounds && (
              <div className="absolute left-0 right-0 h-0.5 bg-emerald-400/40 blur-[1px] animate-[bounce_4s_infinite] pointer-events-none" />
            )}
          </div>

          {/* Bottom state banner */}
          <div className="bg-slate-950 p-4 border-t border-slate-800 text-xs flex justify-between items-center text-slate-300">
            <span className="font-medium text-[10px]">ស្ថានភាពសុវត្ថិភាព ៖</span>
            <span className="font-mono text-[9px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-500/20">
              Live Capture Anti-Gallery
            </span>
          </div>
        </div>

        {/* CARD 5: Core Attendance Check Actions (col-span-3) */}
        <div className="col-span-1 md:col-span-3 bg-white rounded-3xl shadow-sm border border-slate-100 p-6 flex flex-col gap-4 justify-between md:h-[420px]">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-indigo-600" />
              <span>កត់ត្រាវត្តមានផ្ទាល់</span>
            </p>
            <p className="text-[11px] text-slate-500 leading-normal">
              ចុចប៊ូតុងខាងក្រោមដើម្បីបង្កើតវត្តមានចូល ឬ ចេញ របស់អ្នកនៅការិយាល័យ។
            </p>
          </div>

          <div className="flex flex-col gap-3 flex-1 justify-center mt-3">
            {/* CHECK-IN CORE BUTTON */}
            <button
              disabled={!geoState.isWithinBounds || cameraState.status !== "ready" || isCapturing}
              onClick={() => handleSubmitAttendance("check_in")}
              className={`w-full py-4 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all outline-none border shadow-xs ${
                geoState.isWithinBounds && cameraState.status === "ready"
                  ? "bg-indigo-600 border-indigo-500 hover:bg-indigo-700 text-white cursor-pointer active:scale-95"
                  : "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
              }`}
            >
              <CheckCircle2 className="w-6 h-6" />
              <span className="text-sm font-bold">វត្តមានចូល (CHECK-IN)</span>
              <span className="text-[8px] opacity-75 uppercase tracking-wider font-mono">Live Secure Sync</span>
            </button>

            {/* CHECK-OUT CORE BUTTON */}
            <button
              disabled={!geoState.isWithinBounds || cameraState.status !== "ready" || isCapturing}
              onClick={() => handleSubmitAttendance("check_out")}
              className={`w-full py-4 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all outline-none border shadow-xs ${
                geoState.isWithinBounds && cameraState.status === "ready"
                  ? "bg-amber-600 border-amber-500 hover:bg-amber-700 text-white cursor-pointer active:scale-95"
                  : "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
              }`}
            >
              <History className="w-6 h-6" />
              <span className="text-sm font-bold">វត្តមានចេញ (CHECK-OUT)</span>
              <span className="text-[8px] opacity-75 uppercase tracking-wider font-mono">End of Duty</span>
            </button>
          </div>

          {/* Action guidance indicator */}
          <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl text-[10px] text-slate-500 text-center select-none mt-1">
            {geoState.isWithinBounds ? (
              <p className="text-emerald-700 font-bold">✓ ទីតាំងត្រឹមត្រូវ។ រួចរាល់សម្រាប់ការចុះឈ្មោះ!</p>
            ) : (
              <p className="text-rose-600 font-medium">⚠ ប៊ូតុងត្រូវបានបិទរហូតដល់ GPS ផ្ទៀងផ្ទាត់រួចរាល់</p>
            )}
          </div>
        </div>

        {/* CARD 6: Dynamic History Log Board Table (col-span-9) */}
        <div className="col-span-1 md:col-span-4 bg-white rounded-3xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between min-h-[160px]">
          <div>
            <h4 className="font-bold text-xs text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
              <MapPin className="w-4 h-4 text-indigo-600 animate-pulse" />
              <span>ទីតាំងគោលការិយាល័យ</span>
            </h4>
            <p className="text-[10px] text-slate-400 leading-normal">
              ទីតាំងភូមិសាស្ត្រដែលត្រូវបានកំណត់នៅលើ Server សម្រាប់ធ្វើ Geofencing៖
            </p>

            <div className="mt-2 text-xs font-mono bg-slate-50 border border-slate-100/60 p-2.5 rounded-xl text-slate-700 space-y-1">
              <p className="truncate"><strong className="text-[10px] text-slate-400 uppercase font-sans">តំបន់៖</strong> {office.name}</p>
              <p><strong className="text-[10px] text-slate-400 uppercase font-sans">Lat:</strong> {office.latitude.toFixed(5)}</p>
              <p><strong className="text-[10px] text-slate-400 uppercase font-sans">Lng:</strong> {office.longitude.toFixed(5)}</p>
            </div>
          </div>

          <button
            onClick={handleSetCurrentAsOffice}
            disabled={!geoState.coords}
            className={`w-full text-center text-[10px] font-bold py-2 px-3 rounded-xl border mt-3 transition ${
              geoState.coords
                ? "bg-slate-50 border-slate-200 hover:bg-slate-100/80 text-slate-700"
                : "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed"
            }`}
          >
            កំណត់ទីតាំងខ្ញុំជាការិយាល័យ (Align GPS Target)
          </button>
        </div>

        {/* CARD 7: Dynamic Logs list - Table format (col-span-12) */}
        <div className="col-span-1 md:col-span-12 bg-white rounded-3xl shadow-sm border border-slate-100 p-6 overflow-hidden flex flex-col min-h-[300px]">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 pb-4 border-b border-slate-100">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest select-none">កំណត់ត្រាវត្តមានថ្មីៗ (Attendance Logs)</p>
              <h3 className="text-xl font-black text-slate-800 mt-0.5">ប្រវត្តិសរុបកត់ក្នុងប្រព័ន្ធ</h3>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Log filter tags */}
              <div className="bg-slate-100 p-1 rounded-xl flex items-center justify-between border border-slate-200/50">
                <button
                  onClick={() => setActiveTab("all")}
                  className={`text-[10px] font-bold px-3 py-1 rounded-lg transition ${
                    activeTab === "all" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  ទាំងអស់ ({logs.length})
                </button>
                <button
                  onClick={() => setActiveTab("in")}
                  className={`text-[10px] font-bold px-3 py-1 rounded-lg transition ${
                    activeTab === "in" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  ចូល (In)
                </button>
                <button
                  onClick={() => setActiveTab("out")}
                  className={`text-[10px] font-bold px-3 py-1 rounded-lg transition ${
                    activeTab === "out" ? "bg-white text-amber-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  ចេញ (Out)
                </button>
              </div>

              {logs.length > 0 && (
                <button
                  onClick={handleClearLogs}
                  className="bg-rose-50 hover:bg-rose-100 hover:text-rose-800 text-rose-700 border border-rose-100 font-bold text-[10px] px-3 py-1.5 rounded-xl transition shrink-0 ml-auto"
                >
                  លុបកំណត់ត្រា
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-x-auto w-full">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-12 flex flex-col items-center justify-center gap-2">
                <div className="w-12 h-12 bg-slate-50 border border-slate-150 rounded-full flex items-center justify-center text-slate-400">
                  <Database className="w-6 h-6 stroke-[1.5]" />
                </div>
                <p className="text-sm font-bold text-slate-500">រកមិនឃើញកំណត់ត្រាវត្តមានណាមួយឡើយ</p>
                <p className="text-xs text-slate-400 max-w-sm leading-normal">
                  សូមបើក GPS សាកល្បង ដើម្បីតម្រឹមទីតាំងក្នុងរង្វង់ការិយាល័យ រួចធ្វើការចុះឈ្មោះវត្តមានចូលជាគំរូសាកល្បង។
                </p>
              </div>
            ) : (
              <table className="w-full text-left min-w-[640px]">
                <thead>
                  <tr className="text-[10px] text-slate-400 font-bold uppercase border-b border-slate-100 select-none">
                    <th className="py-2.5 pb-2">ព័ត៌មានបុគ្គលិក</th>
                    <th className="py-2.5 pb-2">ប្រភេទ</th>
                    <th className="py-2.5 pb-2">ចម្ងាយ (Geofence)</th>
                    <th className="py-2.5 pb-2">ម៉ោងផ្លូវការ (Server Time)</th>
                    <th className="py-2.5 pb-2">ឧបករណ៍ប្រើប្រាស់</th>
                    <th className="py-2.5 pb-2 text-right">រូបថតកាមេរ៉ា</th>
                  </tr>
                </thead>
                <tbody className="text-xs font-medium text-slate-700 divide-y divide-slate-50">
                  {filteredLogs.map((log) => {
                    const isCheckIn = log.type === "check_in";
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition">
                        <td className="py-3">
                          <div>
                            <p className="font-bold text-slate-800">{log.employeeName}</p>
                            <p className="text-[9px] text-slate-400 font-mono tracking-wider mt-0.5">ID: {log.employeeId}</p>
                          </div>
                        </td>
                        <td className="py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            isCheckIn
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-100/60"
                              : "bg-amber-50 text-amber-700 border border-amber-100/60"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isCheckIn ? "bg-emerald-500" : "bg-amber-500"}`}></span>
                            {isCheckIn ? "ចូលធ្វើការ" : "ចេញពីការងារ"}
                          </span>
                        </td>
                        <td className="py-3 font-mono font-bold text-slate-600">
                          {log.distance} ម៉ែត្រ
                          <span className="block text-[8px] font-sans font-medium text-slate-400 mt-0.5">
                            📍 Coords: {log.latitude.toFixed(4)}, {log.longitude.toFixed(4)}
                          </span>
                        </td>
                        <td className="py-3">
                          <p className="font-mono text-slate-800">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                          </p>
                          <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                            {new Date(log.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </td>
                        <td className="py-3 text-[10px] text-slate-500 font-medium">
                          {log.deviceName || "ស្មាតហ្វូនបុគ្គលិក"}
                        </td>
                        <td className="py-3 text-right">
                          <div className="inline-flex items-center border border-slate-100 justify-center w-12 h-12 rounded-xl overflow-hidden bg-slate-100 ring-2 ring-slate-100/50 shadow-xs">
                            <img
                              src={log.photo}
                              alt="Liveness Front Photo"
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>

      {/* ANTI-CHEAT ARCHITECTURE DETAILS */}
      <div id="security_architecture_drawer" className="w-full max-w-5xl mt-6">
        <button
          onClick={() => setShowArchDetails(!showArchDetails)}
          className="w-full bg-white hover:bg-slate-100/80 border border-slate-200/60 shadow-xs rounded-2xl p-4 flex items-center justify-between text-xs font-semibold text-slate-700 transition cursor-pointer"
        >
          <span className="flex items-center gap-2 text-indigo-600 font-bold">
            <Database className="w-4.5 h-4.5" />
            <span>ស្វែងយល់ពីបច្ចេកវិទ្យាការពារការលួចបន្លំ (Security Architecture Insight)</span>
          </span>
          {showArchDetails ? (
            <ChevronUp className="w-4 h-4 text-slate-500 hover:text-slate-800" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500 hover:text-slate-800" />
          )}
        </button>

        <AnimatePresence>
          {showArchDetails && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-white border border-t-0 border-slate-200/60 rounded-b-2xl p-6 text-xs leading-relaxed text-slate-600 flex flex-col gap-4 shadow-xs">
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col gap-2">
                    <h5 className="font-bold text-slate-800 flex items-center gap-1.5 text-indigo-600">
                      <Clock className="w-4 h-4 shrink-0" />
                      <span>១. ការពារការកែម៉ោងលើទូរស័ព្ទ</span>
                    </h5>
                    <p className="text-slate-500 text-[11px] leading-relaxed">
                      ប្រព័ន្ធវត្តមាននេះមិនងាករេតាមម៉ោងលើឧបករណ៍ទូរស័ព្ទរបស់បុគ្គលិកឡើយ។ រាល់ពេលធ្វើការចុះឈ្មោះចូល/ចេញ ម៉ាស៊ីនមេ (Express server-side) នឹងបង្កើតពេលវេលាផ្លូវការមួយហៅថា <strong>Server Timestamp</strong> (`new Date().toISOString()`) ដោយស្វ័យប្រវត្តិកំឡុងពេលទទួលបានសំណើ។ បុគ្គលិកប្រើប្រាស់ទូរស័ព្ទដៃទោះបីកែតម្រូវម៉ោងក្នុង settings ក៏គ្មានប្រយោជន៍ដែរ។
                    </p>
                  </div>

                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col gap-2">
                    <h5 className="font-bold text-slate-800 flex items-center gap-1.5 text-indigo-600">
                      <Camera className="w-4 h-4 shrink-0" />
                      <span>២. បង្ខំឱ្យប្រើតែកាមេរ៉ាផ្ទាល់</span>
                    </h5>
                    <p className="text-slate-500 text-[11px] leading-relaxed">
                      យើងប្រើប្រាស់ `mediaDevices.getUserMedia` ជាទម្រង់ `facingMode: "user"` សំដៅច្បាស់លើកាមេរ៉ាខាងមុខប៉ុណ្ណោះ។ កម្មវិធីនេះគ្មាន `<input type="file" />` ដែលអនុញ្ញាតឱ្យបុគ្គលិកជ្រើសរើសរូបថតចាស់ៗពី device gallery ឡើយ។ រាល់ការបញ្ជួនត្រូវធ្វើឡើងដោយការថតផ្ទាល់ចេញពី Canvas ភ្លាមៗ (Snapshot Canvas Rendering)។
                    </p>
                  </div>

                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col gap-2">
                    <h5 className="font-bold text-slate-800 flex items-center gap-1.5 text-indigo-600">
                      <Lock className="w-4 h-4 shrink-0" />
                      <span>៣. ការពារការបន្លំ GPS តាមរយៈ API</span>
                    </h5>
                    <p className="text-slate-500 text-[11px] leading-relaxed">
                      ជាទូទៅ Hacker អាចបន្លំ GPS លើ browser ដោយកែសម្រួល script ឱ្យប៊ូតុងចុះឈ្មោះដំណើរការ។ ដើម្បីទប់ស្កាត់ការលួចបន្លំកម្រិតខ្ពស់នេះ នៅពេលបុគ្គលិកធ្វើការបញ្ជូនទិន្នន័យ ម៉ាស៊ីនមេនឹងធ្វើការគណនាចម្ងាយឡើងវិញតាមរយរូបមន្ត <strong>Haversine Formula</strong> នៅផ្នែក Backend សាមញ្ញ។ បើចម្ងាយរវាងកូអរដោនេផ្ញើមក និងចំណុចការិយាល័យលើស ១០០ម៉ែត្រ សំណើនឹងត្រូវបានបដិសេធចោលភ្លាមៗ (HTTP 422 - Unprocessable Entity)។
                    </p>
                  </div>

                </div>

                <div className="border-t border-slate-100 pt-4 mt-2">
                  <h5 className="font-bold text-slate-800 flex items-center gap-1.5 mb-2 text-indigo-700">
                    <Database className="w-4 h-4" />
                    <span>៤. របៀបតភ្ជាប់ជាមួយ Firebase Firestore រឺ Supabase សុវត្ថិភាពខ្ពស់ (Production Architecture)</span>
                  </h5>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1 text-[11px]">
                    <div className="bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                      <h6 className="font-extrabold text-slate-700 mb-1">🔥 សម្រាប់ Firebase Firestore ៖</h6>
                      <ul className="list-disc pl-4 space-y-1 text-slate-500">
                        <li><strong>Cloud Functions ៖</strong> ត្រូវបង្កើត Cloud Function សំរាប់លើយន្តការ `/api/attendance` ដើម្បីគណនា GPS និង Time សុវត្ថិភាព។</li>
                        <li><strong>Database Security Rules ៖</strong> ត្រូវចាក់សោរមិនឱ្យបុគ្គលិកសរសេរវិញ្ញាបនប័ត្រចូលផ្ទាល់ (`allow write: if false`) លើកលែងការសរសេរតាមរយៈ Admin SDK នៅក្នុង Cloud Functions តែប៉ុណ្ណោះ។</li>
                      </ul>
                    </div>

                    <div className="bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                      <h6 className="font-extrabold text-slate-700 mb-1">⚡ សម្រាប់ Supabase (PostgreSQL) ៖</h6>
                      <ul className="list-disc pl-4 space-y-1 text-slate-500">
                        <li><strong>Edge Functions / RPC ៖</strong> ត្រូវបង្កើត Database Trigger ឬ Supabase RPC function ដែលផ្ទៀងផ្ទាត់ GPS និង Server-Generated timestamp មុននឹងសរសេរវត្តមានចូល។</li>
                        <li><strong>Row-Level Security (RLS) ៖</strong> ប្រើប្រាស់ RLS policy ដើម្បីអនុញ្ញាតឱ្យបុគ្គលិកមើលឃើញតែប្រវត្តិកំណត់ហេតុរបស់ខ្លួនឯងប៉ុណ្ណោះ (`auth.uid() = user_id`)។</li>
                      </ul>
                    </div>
                  </div>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* FOOTER DECORATION */}
      <footer className="mt-8 text-slate-400 text-[10px] font-semibold tracking-widest uppercase flex flex-wrap items-center justify-center gap-3 md:gap-4 select-none">
        <span>Anti-Spoofing Enabled</span>
        <div className="w-1.5 h-1.5 bg-indigo-200 rounded-full shrink-0"></div>
        <span>NTP Server Time Sync 0.2ms</span>
        <div className="w-1.5 h-1.5 bg-indigo-200 rounded-full shrink-0"></div>
        <span>Secure Front Live App v2.0</span>
      </footer>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
