import { fetchJson } from "../utils/http.js";

export class OpenAiApi {
  constructor({ apiKey, model }) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async createStructuredSummary({ systemPrompt, context }) {
    return fetchJson(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: context },
          ],
        }),
      },
      "openai"
    );
  }
}
