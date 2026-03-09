import { defineSecret } from "firebase-functions/params";

/** Anthropic Claude API key — stored in Firebase Secret Manager. */
export const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
