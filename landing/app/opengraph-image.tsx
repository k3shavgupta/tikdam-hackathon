export const dynamic = "force-static";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Tikdam. Check before you buy.";

export default async function OpenGraphImage() {
  const logo = await readFile(path.join(process.cwd(), "public/brand/logo.png"));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#FFFBEB",
          color: "#121212",
          padding: "64px 76px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 44,
            fontWeight: 800,
            letterSpacing: -2,
          }}
        >
          {/* Satori renders the outlined wordmark into the social card. */}
          <img src={`data:image/png;base64,${logo.toString("base64")}`} width={220} height={51} alt="Tikdam" />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <span style={{ fontSize: 25, fontWeight: 700 }}>
            A smarter question before checkout.
          </span>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 87,
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: -5,
            }}
          >
            <span>Check before</span>
            <span>you buy.</span>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 26,
            fontWeight: 700,
          }}
        >
          <span>Can you claim it? Check first.</span>
          <span
            style={{
              background: "#B6F09C",
              border: "3px solid #121212",
              padding: "10px 18px",
            }}
          >
            tikdam.xyz
          </span>
        </div>
      </div>
    ),
    size,
  );
}
