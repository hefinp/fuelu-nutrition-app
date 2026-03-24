import { Link } from "wouter";
import { ArrowLeft, ExternalLink } from "lucide-react";

const sources = [
  {
    name: "Open Food Facts",
    url: "https://world.openfoodfacts.org/",
    description: "Open database of food products from around the world. Data is available under the Open Database License (ODbL).",
    testId: "link-source-openfoodfacts",
  },
  {
    name: "NZ Food Composition Database (NZFCD)",
    url: "https://www.foodcomposition.co.nz/",
    description: "New Zealand food composition data provided by Plant & Food Research New Zealand and the Ministry of Health.",
    testId: "link-source-nzfcd",
  },
  {
    name: "FSANZ AUSNUT 2011–13",
    url: "https://www.foodstandards.gov.au/science-data/monitoringnutrients/ausnut/ausnut-2011-13",
    description: "Australian food nutrient database published by Food Standards Australia New Zealand under Creative Commons licensing.",
    testId: "link-source-fsanz",
  },
  {
    name: "USDA FoodData Central",
    url: "https://fdc.nal.usda.gov/",
    description: "Comprehensive food nutrient database maintained by the U.S. Department of Agriculture.",
    testId: "link-source-usda",
  },
];

export default function DataSourcesPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-zinc-100 sticky top-0 z-50 bg-white/90 backdrop-blur-sm safe-area-inset-top">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center relative">
              <div className="w-3 h-3 bg-white rounded-full" />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[3px] h-[calc(50%-6px)] bg-white rounded-t-sm" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight text-zinc-900">FuelU</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
            data-testid="link-data-sources-back"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <h1 className="font-display font-bold text-3xl sm:text-4xl text-zinc-900 mb-2" data-testid="text-data-sources-title">Data Sources</h1>
        <p className="text-sm text-zinc-400 mb-10">Nutrition data attribution and licenses</p>

        <p className="text-sm text-zinc-600 mb-8">
          FuelU relies on the following open nutrition databases to provide accurate food and nutrient information. We gratefully acknowledge each source below.
        </p>

        <div className="space-y-6">
          {sources.map((source) => (
            <div key={source.testId} className="border border-zinc-100 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-zinc-900 hover:underline flex items-center gap-1.5"
                  data-testid={source.testId}
                >
                  {source.name}
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                </a>
              </div>
              <p className="text-xs text-zinc-500">{source.description}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
