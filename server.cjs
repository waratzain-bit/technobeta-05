var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json({ limit: "50mb" }));
  app.use(import_express.default.urlencoded({ limit: "50mb", extended: true }));
  app.post("/api/generate", async (req, res) => {
    try {
      const { imageDataUrl, decade } = req.body;
      if (!imageDataUrl) {
        return res.status(400).json({ error: "No image source uploaded." });
      }
      if (!decade) {
        return res.status(400).json({ error: "No decade specified." });
      }
      const activeApiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!activeApiKey) {
        return res.status(503).json({
          error: "API key is not configured. Please add your GEMINI_API_KEY in Settings > Secrets."
        });
      }
      const activeAi = new import_genai.GoogleGenAI({
        apiKey: activeApiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });
      const match = imageDataUrl.match(/^data:(image\/\w+);base64,(.*)$/);
      if (!match) {
        return res.status(400).json({ error: "Invalid image format. Must be a valid image Data URL." });
      }
      const [, mimeType, base64Data] = match;
      const imagePart = {
        inlineData: { mimeType, data: base64Data }
      };
      const primaryPrompt = `Reimagine the person in this photo in the style of the ${decade}. This includes clothing, hairstyle, photo quality, and the overall aesthetic of that decade. The output must be a photorealistic image showing the person clearly.`;
      const fallbackPrompt = `Create a photograph of the person in this image as if they were living in the ${decade}. The photograph should capture the distinct fashion, hairstyles, and overall atmosphere of that time period. Ensure the final image is a clear photograph that looks authentic to the era.`;
      console.log(`[Backend] Generating image for decade: ${decade}`);
      const callGeminiWithRetry = async (prompt) => {
        const maxRetries = 3;
        const initialDelay = 1e3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            return await activeAi.models.generateContent({
              model: "gemini-2.5-flash-image",
              contents: { parts: [imagePart, { text: prompt }] }
            });
          } catch (error) {
            console.error(`[Backend] Error calling Gemini (Attempt ${attempt}/${maxRetries}):`, error);
            const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
            const isAuthOrValidationIssue = errorMessage.includes("API_KEY_INVALID") || errorMessage.includes("INVALID_ARGUMENT") || errorMessage.includes("PERMISSION_DENIED");
            if (!isAuthOrValidationIssue && attempt < maxRetries) {
              const delay = initialDelay * Math.pow(2.5, attempt - 1) + Math.random() * 500;
              console.log(`[Backend] Standard or Quota error detected. Retrying in ${Math.round(delay)}ms...`);
              await new Promise((resolve) => setTimeout(resolve, delay));
              continue;
            }
            throw error;
          }
        }
        throw new Error("Gemini API call failed after retries.");
      };
      const processResponse = (response) => {
        const imagePartFromResponse = response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData);
        if (imagePartFromResponse?.inlineData) {
          const { mimeType: outMimeType, data: outData } = imagePartFromResponse.inlineData;
          return `data:${outMimeType};base64,${outData}`;
        }
        const textResponse = response.text || "";
        console.error("[Backend] API text response received instead of image:", textResponse);
        throw new Error(`Model returned text: "${textResponse.substring(0, 100)}..."`);
      };
      try {
        const response = await callGeminiWithRetry(primaryPrompt);
        const url = processResponse(response);
        return res.json({ url });
      } catch (err) {
        console.warn(`[Backend] Primary prompt failed for ${decade}, trying fallback. Error:`, err.message);
        try {
          const fallbackResponse = await callGeminiWithRetry(fallbackPrompt);
          const url = processResponse(fallbackResponse);
          return res.json({ url });
        } catch (fallbackErr) {
          console.error(`[Backend] Fallback also failed for ${decade}:`, fallbackErr.message);
          return res.status(500).json({
            error: `Failed to generate image. Details: ${fallbackErr.message || "Unknown error"}`
          });
        }
      }
    } catch (globalErr) {
      console.error("[Backend] Unhandled API error:", globalErr);
      return res.status(500).json({ error: globalErr.message || "An unexpected server error occurred." });
    }
  });
  app.post("/api/ai-draft", async (req, res) => {
    try {
      const { prompt, category } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Silakan masukkan topik tulisan terlebih dahulu." });
      }
      const activeApiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!activeApiKey) {
        return res.status(503).json({
          error: "API key is not configured. Please add your GEMINI_API_KEY in Settings > Secrets."
        });
      }
      const activeAi = new import_genai.GoogleGenAI({
        apiKey: activeApiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });
      const systemPrompt = `You are a professional web content developer and copywriter. 
Generate a comprehensive, premium and highly engaging short article in Indonesian language based on this request guidelines.
Topic guideline: "${prompt}"
In the Category of: "${category || "Teknologi"}"

You must return EXACTLY a JSON structure matching this model:
{
  "title": "A highly punchy, sleek title that sounds human, professional and inspiring (maximum 12 words)",
  "subtitle": "An elegant, descriptive and inspiring subtitle (maximum 18 words)",
  "content": "A detailed, structured and fully written professional article content. Write with standard Indonesian grammar, fluid and conversational but intellectual. Avoid dry technical templates. Incorporate beautiful spacing and insights (around 150 - 300 words).",
  "tags": ["Tag1", "Tag2", "Tag3"],
  "categoryColor": "One of these Tailwind color prefixes: emerald, sky, violet, pink, amber based on the aesthetic vibe"
}

Ensure the output is 100% valid JSON matching this schema. Avoid any extra words outside JSON. No markdown enclosures.`;
      console.log(`[Backend] Generating AI draft for topic: ${prompt}`);
      const aiResponse = await activeAi.models.generateContent({
        model: "gemini-2.5-flash",
        contents: systemPrompt,
        config: {
          responseMimeType: "application/json"
        }
      });
      const responseText = aiResponse.text || "";
      try {
        const parsedJson = JSON.parse(responseText);
        return res.json(parsedJson);
      } catch (jsonErr) {
        console.error("[Backend] Failed to parse generated AI draft to JSON:", responseText);
        return res.json({
          title: prompt,
          subtitle: `Inspirasi seputar ${category || "Kreatif"}`,
          content: responseText || "Gagal memproses detail tulisan seutuhnya.",
          tags: ["AI", "Generative"],
          categoryColor: "emerald"
        });
      }
    } catch (err) {
      console.error("[Backend] AI draft generation error:", err);
      return res.status(500).json({ error: err.message || "Gagal membuat draf tulisan otomatis." });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Backend] Server running on http://localhost:${PORT} in ${process.env.NODE_ENV || "development"} mode`);
  });
}
startServer();
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
//# sourceMappingURL=server.cjs.map
