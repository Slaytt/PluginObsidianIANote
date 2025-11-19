import { GoogleGenerativeAI } from "@google/generative-ai";

export class GeminiService {
    private genAI: GoogleGenerativeAI;
    private model: any;
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
        this.init();
    }

    private init() {
        if (!this.apiKey || this.apiKey === 'default') {
            console.warn("Gemini API Key not set");
            return;
        }
        this.genAI = new GoogleGenerativeAI(this.apiKey);
        // Utilisation de gemini-2.0-flash (disponible dans la liste de l'utilisateur)
        this.model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    }

    updateApiKey(apiKey: string) {
        this.apiKey = apiKey;
        this.init();
    }

    async generateContent(prompt: string): Promise<string> {
        if (!this.model) {
            throw new Error("Gemini API not initialized. Please check your API key in settings.");
        }

        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error("Error generating content from Gemini:", error);

            if (error.toString().includes("404") || error.toString().includes("not found") || error.toString().includes("429")) {
                console.log("Primary model failed (404 or 429), trying fallback to gemini-2.0-flash-lite...");
                try {
                    const fallbackModel = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
                    const result = await fallbackModel.generateContent(prompt);
                    const response = await result.response;
                    return response.text();
                } catch (fallbackError) {
                    console.error("Fallback model also failed:", fallbackError);
                    if (fallbackError.toString().includes("429")) {
                        return "⚠️ Quota dépassé (Erreur 429). Veuillez patienter quelques instants avant de réessayer.";
                    }
                    throw error;
                }
            }
            if (error.toString().includes("429")) {
                return "⚠️ Quota dépassé (Erreur 429). Veuillez patienter quelques instants avant de réessayer.";
            }
            throw error;
        }
    }
}
