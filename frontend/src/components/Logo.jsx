export const LOGO_URL = "https://customer-assets.emergentagent.com/job_fivem-server-be/artifacts/dox0sshs_bxrp.png";

export default function Logo({ size = 40, className = "", showRing = false }) {
  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={LOGO_URL}
        alt="Bruxelles RP"
        className={`w-full h-full object-contain ${showRing ? "drop-shadow-[0_0_20px_rgba(228,184,35,0.35)]" : ""}`}
        data-testid="bxlrp-logo"
      />
    </div>
  );
}
