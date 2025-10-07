import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import path from "path";
var host = process.env.TAURI_DEV_HOST;
// https://vite.dev/config/
export default defineConfig(function () { return ({
    plugins: [
        tanstackRouter({ target: "react", routesDirectory: "src/router/routes", generatedRouteTree: "src/router/routeTree.gen.ts" }),
        react({
            babel: {
                plugins: ["babel-plugin-react-compiler"],
            },
        }),
        tailwindcss(),
    ],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
            "@/core": path.resolve(__dirname, "./src/core"),
            "@/shared": path.resolve(__dirname, "./src/shared"),
            "@/shared/ui": path.resolve(__dirname, "./src/shared/ui"),
            "@/modules": path.resolve(__dirname, "./src/modules"),
        },
    },
    test: {
        environment: "jsdom",
        globals: true,
        setupFiles: ["./src/test/setup/index.ts"],
        coverage: {
            reporter: ["text", "lcov"],
        },
        restoreMocks: true,
    },
    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    //
    // 1. prevent Vite from obscuring rust errors
    clearScreen: false,
    // 2. tauri expects a fixed port, fail if that port is not available
    server: {
        port: 1420,
        strictPort: true,
        host: host || false,
        hmr: host
            ? {
                protocol: "ws",
                host: host,
                port: 1421,
            }
            : undefined,
        watch: {
            // 3. tell Vite to ignore watching `src-tauri`
            ignored: ["**/src-tauri/**"],
        },
    },
}); });
