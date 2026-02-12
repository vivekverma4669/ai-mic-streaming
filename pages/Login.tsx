import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import hero from "../assets/hero.png";
import { getAuth, setAuth } from "../utils/auth";

const Login: React.FC = () => {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [showBotModal, setShowBotModal] = useState(false);

  const navigate = useNavigate();
  const STATIC_CODE = "9900";

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ✅ If already logged in -> go to last bot route
  useEffect(() => {
    const auth = getAuth();
    if (auth?.auth) {
      if (auth.bot) navigate(`/${auth.bot}`, { replace: true });
      // else navigate("/rheuma", { replace: true });
    }
  }, [navigate]);

  const handleContinue = () => {
    setError("");

    const trimmedName = name.trim();

    // ✅ name mandatory
    if (!trimmedName) {
      setError("Name is required");
      return;
    }

    if (code !== STATIC_CODE) {
      setError("Invalid access code");
      return;
    }

    // ✅ open modal after validation
    setShowBotModal(true);
  };

  const handleSelectBot = (bot: "rheuma" | "live" | "live_audio") => {
    // ✅ store auth in localStorage
    setAuth({
      auth: true,
      name: name.trim(),
      bot,
    });

    setShowBotModal(false);

    navigate(`/${bot}`);
    // ✅ routes same as your app
    // if (bot === "octa") navigate("/rheuma");
    // if (bot === "octaLive") navigate("/live");
  };

  return (
    <div
      style={{
        ...styles.container,
        flexDirection: isMobile ? "column" : "row",
      }}
    >
      {/* LEFT LOGIN */}
      <div
        style={{
          ...styles.left,
          width: isMobile ? "100%" : "35%",
          padding: isMobile ? "40px 24px" : "80px",
          marginTop: isMobile ? "110px" : 0,
          height: isMobile ? "auto" : "100vh",
        }}
      >
        <h1 style={styles.logo}>DOCTAT</h1>

        <h2 style={styles.title}>Welcome</h2>
        <p style={styles.subtitle}>
          Enter your details to chat with your assistant
        </p>

        <input
          type="text"
          placeholder="Enter Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={styles.input}
        />

        <input
          type="password"
          placeholder="Enter access code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          style={styles.input}
        />

        {error && <p style={styles.error}>{error}</p>}

        <button onClick={handleContinue} style={styles.button}>
          Continue
        </button>
      </div>

      {/* RIGHT IMAGE */}
      {!isMobile && (
        <img
          src={hero}
          alt="Hero"
          style={{
            width: "65%",
            objectFit: "cover",
            borderTopLeftRadius: 50,
            borderBottomLeftRadius: 50,
          }}
        />
      )}

      {/* BOT SELECTION MODAL */}
      {showBotModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={styles.modalTitle}>Choose a bot</h3>
              <button
                onClick={() => setShowBotModal(false)}
                style={styles.closeBtn}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <p style={styles.modalSub}>
              Hi {name.trim()}, which assistant do you want to talk to?
            </p>

            <div style={styles.modalBtns}>
              <button
                onClick={() => handleSelectBot("rheuma")}
                style={styles.botBtnPrimary}
              >
                Octa Chat
              </button>

              <button
                onClick={() => handleSelectBot("live")}
                style={styles.botBtnSecondary}
              >
                Octa Live (Audio + Chat)
              </button>

              {/* <button
                onClick={() => handleSelectBot("live_audio")}
                style={styles.botBtnSecondary}
              >
                Talk to Octa Live Audio Only
              </button> */}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;

// ---- styles same as you already had ----
const THEME = {
  teal: "#22B8B2",
  tealSoft: "#BFF3F0",
  text: "#0F172A",
  muted: "#64748B",
  border: "#DCE7E7",
};

const styles: any = {
  container: {
    display: "flex",
    height: "100vh",
    fontFamily: "Inter, sans-serif",
    background: "#ffffff",
  },
  left: {
    background: "#ffffff",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  logo: {
    fontSize: "30px",
    fontWeight: 800,
    marginBottom: "40px",
    background: `linear-gradient(90deg, ${THEME.teal} 0%, #7FE6E0 100%)`,
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    textTransform: "uppercase",
  },
  title: { fontSize: "22px", marginBottom: "2px", color: THEME.text },
  subtitle: { color: THEME.muted, marginBottom: "24px" },
  input: {
    padding: "8px 10px",
    fontSize: "14px",
    borderRadius: "6px",
    border: `1px solid ${THEME.border}`,
    marginBottom: "12px",
    height: "38px",
    boxSizing: "border-box",
    outline: "none",
  },
  button: {
    padding: "12px",
    fontSize: "16px",
    borderRadius: "6px",
    border: "none",
    background: THEME.teal,
    color: "#fff",
    cursor: "pointer",
  },
  error: { color: "red", fontSize: "13px", marginBottom: "8px" },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 9999,
  },
  modalBox: {
    width: "100%",
    maxWidth: 420,
    background: "#fff",
    borderRadius: 12,
    padding: 18,
    boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
    border: `1px solid ${THEME.border}`,
  },
  modalTitle: { margin: 0, fontSize: 18, color: THEME.text },
  modalSub: {
    marginTop: 10,
    marginBottom: 16,
    color: THEME.muted,
    fontSize: 14,
  },
  closeBtn: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: 18,
    color: THEME.muted,
    padding: 4,
    lineHeight: 1,
  },
  modalBtns: { display: "flex", gap: 10 },
  botBtnPrimary: {
    flex: 1,
    padding: "12px 10px",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    background: THEME.teal,
    color: "#fff",
    fontWeight: 600,
  },
  botBtnSecondary: {
    flex: 1,
    padding: "12px 10px",
    borderRadius: 10,
    border: `1px solid ${THEME.teal}`,
    cursor: "pointer",
    background: "#fff",
    color: THEME.teal,
    fontWeight: 600,
  },
};
