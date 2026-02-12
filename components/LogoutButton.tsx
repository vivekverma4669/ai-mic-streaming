import { useNavigate } from "react-router-dom";
import { clearAuth } from "../utils/auth";

const LogoutButton = ({ onDone }: { onDone?: () => void }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    clearAuth();
    onDone?.();
    navigate("/", { replace: true });
  };

  return (
    <button
      onClick={handleLogout}
      className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-md"
    >
      Logout
    </button>
  );
};

export default LogoutButton;
