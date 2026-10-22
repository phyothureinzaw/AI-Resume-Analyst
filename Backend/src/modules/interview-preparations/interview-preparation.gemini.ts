import { GoogleGenAI } from '@google/genai';
import { env } from '../../config/env.js';
import { GeminiProviderError, classifyGeminiError } from '../analyses/gemini.provider.js';
import { buildInterviewJsonSchema, buildInterviewPrompt, type InterviewSourceSegment } from './interview-preparation.result.js';

export type InterviewGeminiDiagnostics = { requestDurationMs: number; inputChars: { job: number; resume: number }; finishReason: string | null; outputTruncated: boolean; outputChars: number; promptTokenCount: number | null; outputTokenCount: number | null };
export type InterviewGeminiProvider = { generate(jobTitle: string, companyName: string | null, jobText: string, resumeText: string | null, segments: InterviewSourceSegment[], signal: AbortSignal): Promise<{ text: string; modelName: string | null; diagnostics: InterviewGeminiDiagnostics }> };

export function createInterviewGeminiProvider(): InterviewGeminiProvider {
  if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is required for the interview preparation worker');
  const client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  return {
    async generate(jobTitle, companyName, jobText, resumeText, segments, signal) {
      const startedAt = Date.now();
      const inputChars = { job: jobText.length, resume: resumeText?.length ?? 0 };
      try {
        const response = await client.models.generateContent({ model: env.GEMINI_MODEL, contents: buildInterviewPrompt(jobTitle, companyName, jobText, resumeText, segments), config: {
          abortSignal: signal, temperature: 0.2, maxOutputTokens: 12_000, responseMimeType: 'application/json', responseJsonSchema: buildInterviewJsonSchema(segments),
          systemInstruction: 'Generate only the requested interview preparation JSON. Do not use tools, browsing, external actions, or code execution.'
        } });
        const text = response.text?.trim() ?? '';
        const finishReason = response.candidates?.[0]?.finishReason?.toString() ?? null;
        const diagnostics = { requestDurationMs: Date.now() - startedAt, inputChars, finishReason, outputTruncated: finishReason === 'MAX_TOKENS' || finishReason === 'LENGTH', outputChars: text.length, promptTokenCount: response.usageMetadata?.promptTokenCount ?? null, outputTokenCount: response.usageMetadata?.candidatesTokenCount ?? null };
        if (!text) throw new GeminiProviderError('invalid_output', 'Gemini returned empty interview preparation output', { httpStatus: null, providerStatus: null, providerMessage: null });
        if (finishReason === 'SAFETY') throw new GeminiProviderError('refusal', 'Gemini refused the interview preparation request', { httpStatus: null, providerStatus: 'SAFETY', providerMessage: null });
        if (diagnostics.outputTruncated) throw new GeminiProviderError('invalid_output', 'Gemini interview preparation output was truncated', { httpStatus: null, providerStatus: 'TRUNCATED', providerMessage: null });
        return { text, modelName: response.modelVersion ?? env.GEMINI_MODEL, diagnostics };
      } catch (error) {
        if (error instanceof GeminiProviderError) { error.details.requestDurationMs ??= Date.now() - startedAt; error.details.inputChars ??= inputChars; throw error; }
        const classified = classifyGeminiError(error); classified.details.requestDurationMs = Date.now() - startedAt; classified.details.inputChars = inputChars; throw classified;
      }
    }
  };
}
