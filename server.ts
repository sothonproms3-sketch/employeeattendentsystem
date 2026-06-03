import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

interface AttendanceLog {
  id: string;
  employeeId: string;
  employeeName: string;
  type: "check_in" | "check_out";
  latitude: number;
  longitude: number;
  distance: number;
  timestamp: string; // Server time secure verification
  photo: string; // Base64 Live capture photo
  deviceName?: string;
}

interface OfficeConfig {
  latitude: number;
  longitude: number;
  name: string;
  radius: number; // in meters (default 100m)
}

// In-memory data store for testing and preview persistence
let officeConfig: OfficeConfig = {
  latitude: 11.5564, // Default: Phnom Penh Independence Monument
  longitude: 104.9282,
  name: "ការិយាល័យកណ្តាល (Phnom Penh Main Office)",
  radius: 100, // 100 meters strictly
};

// Seed records with realistic initial logs in Khmer
let attendanceLogs: AttendanceLog[] = [
  {
    id: "log_1",
    employeeId: "EMP-0042",
    employeeName: "ស៊ន សុភ័ក្ត្រ (Sorn Sopheak)",
    type: "check_in",
    latitude: 11.55635,
    longitude: 104.92815,
    distance: 8.52,
    timestamp: new Date(Date.now() - 4 * 3600000).toISOString(), // 4 hours ago
    photo: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80",
    deviceName: "iPhone 14 Pro Max"
  },
  {
    id: "log_2",
    employeeId: "EMP-0015",
    employeeName: "លឹម ណារ៉េត (Lim Nareth)",
    type: "check_in",
    latitude: 11.55642,
    longitude: 104.92822,
    distance: 3.12,
    timestamp: new Date(Date.now() - 3.5 * 3600000).toISOString(), // 3.5 hours ago
    photo: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=120&auto=format&fit=crop&q=80",
    deviceName: "Samsung Galaxy S23"
  }
];

// Haversine formula to compute exact distance in meters between two geolocations
function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return parseFloat(distance.toFixed(2)); // distance in meters up to two decimals
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Enhance payload size limits for Base64 live photo captures
  app.use(express.json({ limit: "15mb" }));
  app.use(express.urlencoded({ limit: "15mb", extended: true }));

  // API Endpoints for Secure Verification
  
  // 1. Fetch Secure Server Time to prevent employee device-clock tricks
  app.get("/api/time", (req, res) => {
    res.json({
      localTimeAtServer: new Date().toString(),
      isoString: new Date().toISOString(),
      timestamp: Date.now(),
    });
  });

  // 2. Fetch configured office geofence properties
  app.get("/api/office", (req, res) => {
    res.json(officeConfig);
  });

  // 3. Update configured office geofence parameters (great for easy local testing)
  app.post("/api/office", (req, res) => {
    const { latitude, longitude, name, radius } = req.body;
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return res.status(400).json({ error: "Invalid coordinate values" });
    }
    
    officeConfig = {
      latitude,
      longitude,
      name: name || officeConfig.name,
      radius: typeof radius === "number" ? radius : 100,
    };

    res.json({
      message: "Office coordinates updated successfully",
      config: officeConfig,
    });
  });

  // 4. Fetch past attendance logs (History tab)
  app.get("/api/attendance", (req, res) => {
    res.json(attendanceLogs);
  });

  // 5. Submit secure verification record (Checkpoint registration)
  app.post("/api/attendance", (req, res) => {
    const { employeeId, employeeName, type, latitude, longitude, photo, deviceName } = req.body;

    // Parameter presence verification
    if (!employeeId || !employeeName || !type || !latitude || !longitude || !photo) {
      return res.status(400).json({
        error: "ឈ្នោះ លេខសម្គាល់ ប្រភេទ ទីតាំង និងរូបថតត្រូវបានកំណត់ជាចម្បង (All parameters are required)",
      });
    }

    if (type !== "check_in" && type !== "check_out") {
      return res.status(400).json({ error: "Invalid attendance operation type" });
    }

    // Server-Side Strict Geofence math
    const employeeDistance = calculateHaversineDistance(
      latitude,
      longitude,
      officeConfig.latitude,
      officeConfig.longitude
    );

    // If coordinates exceed maximum range allowed, abort instantly
    if (employeeDistance > officeConfig.radius) {
      return res.status(422).json({
        errorType: "GEOFENCE_BREACH",
        distance: employeeDistance,
        allowedRadius: officeConfig.radius,
        error: `ចម្ងាយរបស់អ្នកគឺ ${employeeDistance} ម៉ែត្រ ដែលលើសពី ១០០ ម៉ែត្រការិយាល័យ! (Geofence Breach: You are ${employeeDistance}m away, which exceeds the ${officeConfig.radius}m office boundary!)`,
      });
    }

    // Capture exact non-tamperable True Server Date-Time
    const secureServerTimestamp = new Date().toISOString();

    const newLog: AttendanceLog = {
      id: "log_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      employeeId,
      employeeName,
      type,
      latitude,
      longitude,
      distance: employeeDistance,
      timestamp: secureServerTimestamp,
      photo,
      deviceName: deviceName || "Unknown Device"
    };

    // Store log to history array
    attendanceLogs.unshift(newLog);

    res.json({
      success: true,
      data: {
        id: newLog.id,
        distance: employeeDistance,
        timestamp: secureServerTimestamp,
        type: newLog.type,
      },
      message: "ជោគជ័យ! វត្តមានត្រូវបានកត់ត្រាត្រឹមត្រូវ។ (Success! Attendance registered successfully.)",
    });
  });

  // Clear all logs for testing purposes
  app.post("/api/attendance/clear", (req, res) => {
    attendanceLogs = [];
    res.json({ message: "Logs cleared!" });
  });

  // Vite middleware integration for developmental code bundles
  if (process.env.DISABLE_HMR === "true" || process.env.NODE_ENV === "production") {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // Single page path-routing routing helper
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[FULLSTACK SERVER] Secure Attendance listening on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
});
