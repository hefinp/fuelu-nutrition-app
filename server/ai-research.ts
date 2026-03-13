import OpenAI from "openai";

export interface ResearchSource {
  title: string;
  url: string;
}

export interface ResearchResult {
  text: string;
  sources: ResearchSource[];
}

const MEDICAL_DOMAINS = [
  "pubmed.ncbi.nlm.nih.gov",
  "nih.gov",
  "who.int",
  "nhs.uk",
  "nutritionj.biomedcentral.com",
  "jamanetwork.com",
  "bmj.com",
  "thelancet.com",
  "nature.com",
  "sciencedirect.com",
];

export async function searchMedicalLiterature(prompt: string): Promise<ResearchResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured");
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await openai.responses.create({
    model: "gpt-4o-search-preview",
    tools: [
      {
        type: "web_search_preview" as const,
        search_context_size: "medium",
      } as any,
    ],
    input: prompt,
  } as any);

  const text = (response as any).output_text ?? "";

  const sources: ResearchSource[] = [];
  const seen = new Set<string>();

  const output = (response as any).output ?? [];
  for (const item of output) {
    if (item.type === "message") {
      for (const content of item.content ?? []) {
        if (content.type === "output_text") {
          for (const annotation of content.annotations ?? []) {
            if (annotation.type === "url_citation" && !seen.has(annotation.url)) {
              seen.add(annotation.url);
              sources.push({
                title: annotation.title ?? annotation.url,
                url: annotation.url,
              });
            }
          }
        }
      }
    }
  }

  return { text, sources };
}

export function isAiAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
