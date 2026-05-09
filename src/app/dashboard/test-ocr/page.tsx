"use client";

import { useState } from "react";
import { processOcr } from "@/app/actions/ocr/ocr";

export default function OcrTestPage() {
  const [documentUrl, setDocumentUrl] = useState<string>("https://arxiv.org/pdf/2201.04234.pdf");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleOcr = async () => {
    setIsLoading(true);
    setError(null);

    const response = await processOcr(documentUrl);

    if (response.success && response.data) {
      // Create and trigger download of markdown file
      const blob = new Blob([response.data], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "output.md";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      setError(response.error);
    }
    setIsLoading(false);
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Mistral OCR Test</h1>
      <div className="mb-4">
        <label htmlFor="documentUrl" className="block text-sm font-medium text-gray-700">
          Document URL
        </label>
        <input
          id="documentUrl"
          type="text"
          value={documentUrl}
          onChange={(e) => setDocumentUrl(e.target.value)}
          className="mt-1 p-2 block w-full border border-gray-300 rounded-md"
          placeholder="Enter document URL"
        />
      </div>
      <button
        onClick={handleOcr}
        disabled={isLoading}
        className="px-4 py-2 bg-blue-500 text-white rounded-md disabled:bg-gray-400"
      >
        {isLoading ? "Processing..." : "Download Markdown"}
      </button>
      {error && (
        <div className="mt-4 p-4 bg-red-100 rounded-md">
          <h2 className="text-lg font-semibold">Error:</h2>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}