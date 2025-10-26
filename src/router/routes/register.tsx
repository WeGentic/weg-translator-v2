import { createFileRoute } from "@tanstack/react-router";

import { RegistrationRoute } from "@/modules/auth";

export const Route = createFileRoute("/register")({
  component: RegistrationRoute,
});
