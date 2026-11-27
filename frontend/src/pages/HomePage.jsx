import { useAuth } from "../context/AuthContext";
import CitizenDashboard from "./CitizenDashboard";
import OfficerDashboard from "./OfficerDashboard";

export default function HomePage() {
  const { user } = useAuth();
  const role = user?.role?.toUpperCase();

  if (role === "PIO" || role === "OFFICER") {
    return <OfficerDashboard />;
  }

  return <CitizenDashboard />;
}
