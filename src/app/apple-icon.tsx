import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const SVG_MARK = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
    <rect width="32" height="32" rx="7" fill="#1a2030"/>
    <polyline
      points="4,25 10,18 17,20 24,12 28,7"
      fill="none"
      stroke="#35c78c"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <circle cx="28" cy="7" r="2.5" fill="#35c78c"/>
  </svg>
`;

export default function AppleIcon() {
  const dataUri = `data:image/svg+xml;base64,${Buffer.from(SVG_MARK).toString("base64")}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#1a2030",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dataUri} width={size.width} height={size.height} alt="" />
      </div>
    ),
    { ...size },
  );
}
