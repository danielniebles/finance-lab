import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Finance Lab",
    short_name: "Finance Lab",
    description: "Personal finance tracker",
    start_url: "/",
    display: "standalone",
    background_color: "#1a2030",
    theme_color: "#1a2030",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
