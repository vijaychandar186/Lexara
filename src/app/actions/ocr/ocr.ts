"use server";

import { v4 as uuidv4 } from 'uuid';
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { PLAN_LIMITS } from "@/constants/plan-limits";
import { PDFDocument } from "pdf-lib";
import { Mistral } from "@mistralai/mistralai";
import { revalidatePath } from "next/cache";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Define interfaces for type safety
interface JobStatus {
  status: 'processing' | 'completed' | 'error';
  progress?: number;
  error?: string;
  result?: {
    mdUrl?: string;
    message?: string;
    fileCount?: number;
    quota?: number;
    plan?: string;
    needsRevalidation?: boolean;
  };
  startTime: number;
}

interface UploadResponse {
  success: boolean;
  processingId?: string;
  mdUrl?: string;
  message?: string;
  fileCount?: number;
  quota?: number;
  plan?: string;
  error?: string;
}

interface StatusResponse {
  status: 'processing' | 'completed' | 'error';
  progress?: number;
  error?: string;
  fileCount?: number;
  quota?: number;
  plan?: string;
  result?: Record<string, unknown>;
}

// In-memory store for processing status (use Redis in production)
const processingJobs = new Map<string, JobStatus>();

// Cleanup old jobs (runs every hour)
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [id, job] of processingJobs) {
    if (job.startTime < oneHourAgo) {
      processingJobs.delete(id);
    }
  }
}, 60 * 60 * 1000);

export async function uploadFile(formData: FormData): Promise<UploadResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const file = formData.get("file") as File;
    if (!file) {
      return { success: false, error: "No file provided" };
    }

    if (file.type !== "application/pdf") {
      return { success: false, error: "Invalid file type. Only PDF files are allowed." };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { subscription: true, files: true },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    const userPlan = user.subscription?.plan || "FREE";
    const { maxFileSizeMB, maxPages, quota } = PLAN_LIMITS[userPlan];

    const fileSizeMB = file.size / 1024 / 1024;
    if (fileSizeMB > maxFileSizeMB) {
      return {
        success: false,
        error: `File size (${fileSizeMB.toFixed(1)}MB) exceeds the ${maxFileSizeMB}MB limit for your ${userPlan} plan.`,
      };
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const pageCount = pdfDoc.getPageCount();
    if (pageCount > maxPages) {
      return {
        success: false,
        error: `PDF has ${pageCount} pages, which exceeds the ${maxPages}-page limit for your ${userPlan} plan.`,
      };
    }

    const currentFileCount = user.files?.fileCount || 0;
    if (currentFileCount >= quota) {
      return {
        success: false,
        error: `File upload limit reached. You have ${currentFileCount}/${quota} files for your ${userPlan} plan. Please upgrade to upload more files.`,
      };
    }

    const shouldProcessAsync = fileSizeMB > 5 || pageCount > 10;

    if (shouldProcessAsync) {
      const processingId = uuidv4();
      processingJobs.set(processingId, {
        status: 'processing',
        progress: 0,
        startTime: Date.now(),
      });

      // Start async processing without awaiting
      processFileAsync(file, processingId, session.user.id, userPlan, currentFileCount, quota).catch(error => {
        console.error('Async processing error:', error);
        processingJobs.set(processingId, {
          status: 'error',
          error: error.message,
          startTime: Date.now(),
        });
      });

      return {
        success: true,
        processingId,
        message: 'File uploaded successfully. Processing in background.',
      };
    } else {
      const result = await processFileSync(file, session.user.id, userPlan, currentFileCount, quota);
      return result;
    }
  } catch (error) {
    console.error("Unexpected error during file upload:", error);
    return { success: false, error: "An unexpected error occurred while processing the file." };
  }
}

async function processFileSync(file: File, userId: string, userPlan: string, currentFileCount: number, quota: number): Promise<UploadResponse> {
  try {
    const timestamp = Date.now();
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const pdfFileName = `${userId}/pdf/${timestamp}-${cleanFileName}`;
    const mdFileName = `${userId}/md/${timestamp}-${cleanFileName.replace(/\.pdf$/, ".md")}`;

    const { error: pdfError } = await supabase.storage
      .from("files")
      .upload(pdfFileName, file, {
        contentType: "application/pdf",
        cacheControl: "3600",
        upsert: false,
      });

    if (pdfError) {
      console.error("Supabase PDF upload error:", pdfError);
      return { success: false, error: `Failed to upload PDF: ${pdfError.message}` };
    }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("files")
      .createSignedUrl(pdfFileName, 3600);

    if (signedUrlError || !signedUrlData) {
      console.error("Supabase signed URL error:", signedUrlError);
      await supabase.storage.from("files").remove([pdfFileName]);
      return { success: false, error: `Failed to generate signed URL: ${signedUrlError?.message || "Unknown error"}` };
    }

    const pdfUrl = signedUrlData.signedUrl;

    const ocrResponse = await processOcr(pdfUrl);
    if (!ocrResponse.success || !ocrResponse.data) {
      console.error("OCR processing failed:", ocrResponse.error);
      await supabase.storage.from("files").remove([pdfFileName]);
      return { success: false, error: ocrResponse.error || "OCR processing failed" };
    }

    const mdBlob = new Blob([ocrResponse.data], { type: "text/markdown" });
    const mdFile = new File([mdBlob], `${timestamp}-${cleanFileName.replace(/\.pdf$/, ".md")}`, {
      type: "text/markdown",
    });

    const { error: mdError } = await supabase.storage
      .from("files")
      .upload(mdFileName, mdFile, {
        contentType: "text/markdown",
        cacheControl: "3600",
        upsert: false,
      });

    if (mdError) {
      console.error("Supabase Markdown upload error:", mdError);
      await supabase.storage.from("files").remove([pdfFileName]);
      return { success: false, error: `Failed to upload Markdown: ${mdError.message}` };
    }

    const { error: deletePdfError } = await supabase.storage
      .from("files")
      .remove([pdfFileName]);

    if (deletePdfError) {
      console.error("Supabase PDF delete error:", deletePdfError);
    }

    const { data: mdPublicUrlData } = supabase.storage
      .from("files")
      .getPublicUrl(mdFileName);

    const mdPublicUrl = mdPublicUrlData.publicUrl;

    const newFileCount = currentFileCount + 1;
    if (currentFileCount > 0) {
      await prisma.files.update({
        where: { userId },
        data: {
          mdUrls: { push: mdPublicUrl },
          fileCount: newFileCount,
          updatedAt: new Date(),
        },
      });
    } else {
      await prisma.files.create({
        data: {
          userId,
          mdUrls: [mdPublicUrl],
          fileCount: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    revalidatePath("/dashboard");

    return {
      success: true,
      mdUrl: mdPublicUrl,
      message: "File processed successfully",
      fileCount: newFileCount,
      quota,
      plan: userPlan,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error("Synchronous processing error:", error);
    return { success: false, error: msg };
  }
}

async function processFileAsync(file: File, processingId: string, userId: string, userPlan: string, currentFileCount: number, quota: number) {
  try {
    const updateProgress = (progress: number) => {
      const job = processingJobs.get(processingId);
      if (job) {
        processingJobs.set(processingId, { ...job, progress });
      }
    };

    updateProgress(10);

    const timestamp = Date.now();
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const pdfFileName = `${userId}/pdf/${timestamp}-${cleanFileName}`;
    const mdFileName = `${userId}/md/${timestamp}-${cleanFileName.replace(/\.pdf$/, ".md")}`;

    updateProgress(20);

    const { error: pdfError } = await supabase.storage
      .from("files")
      .upload(pdfFileName, file, {
        contentType: "application/pdf",
        cacheControl: "3600",
        upsert: false,
      });

    if (pdfError) {
      console.error("Supabase PDF upload error:", pdfError);
      processingJobs.set(processingId, {
        status: 'error',
        error: `Failed to upload PDF: ${pdfError.message}`,
        startTime: Date.now(),
      });
      return;
    }

    updateProgress(30);

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("files")
      .createSignedUrl(pdfFileName, 3600);

    if (signedUrlError || !signedUrlData) {
      console.error("Supabase signed URL error:", signedUrlError);
      await supabase.storage.from("files").remove([pdfFileName]);
      processingJobs.set(processingId, {
        status: 'error',
        error: `Failed to generate signed URL: ${signedUrlError?.message || "Unknown error"}`,
        startTime: Date.now(),
      });
      return;
    }

    updateProgress(40);

    const pdfUrl = signedUrlData.signedUrl;

    updateProgress(50);

    const ocrResponse = await processOcr(pdfUrl);
    if (!ocrResponse.success || !ocrResponse.data) {
      console.error("OCR processing failed:", ocrResponse.error);
      await supabase.storage.from("files").remove([pdfFileName]);
      processingJobs.set(processingId, {
        status: 'error',
        error: ocrResponse.error || "OCR processing failed",
        startTime: Date.now(),
      });
      return;
    }

    updateProgress(70);

    const mdBlob = new Blob([ocrResponse.data], { type: "text/markdown" });
    const mdFile = new File([mdBlob], `${timestamp}-${cleanFileName.replace(/\.pdf$/, ".md")}`, {
      type: "text/markdown",
    });

    const { error: mdError } = await supabase.storage
      .from("files")
      .upload(mdFileName, mdFile, {
        contentType: "text/markdown",
        cacheControl: "3600",
        upsert: false,
      });

    if (mdError) {
      console.error("Supabase Markdown upload error:", mdError);
      await supabase.storage.from("files").remove([pdfFileName]);
      processingJobs.set(processingId, {
        status: 'error',
        error: `Failed to upload Markdown: ${mdError.message}`,
        startTime: Date.now(),
      });
      return;
    }

    updateProgress(80);

    const { error: deletePdfError } = await supabase.storage
      .from("files")
      .remove([pdfFileName]);

    if (deletePdfError) {
      console.error("Supabase PDF delete error:", deletePdfError);
    }

    updateProgress(90);

    const { data: mdPublicUrlData } = supabase.storage
      .from("files")
      .getPublicUrl(mdFileName);

    const mdPublicUrl = mdPublicUrlData.publicUrl;

    const newFileCount = currentFileCount + 1;
    if (currentFileCount > 0) {
      await prisma.files.update({
        where: { userId },
        data: {
          mdUrls: { push: mdPublicUrl },
          fileCount: newFileCount,
          updatedAt: new Date(),
        },
      });
    } else {
      await prisma.files.create({
        data: {
          userId,
          mdUrls: [mdPublicUrl],
          fileCount: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    updateProgress(95);

    // Store the need for revalidation in the job status
    processingJobs.set(processingId, {
      status: 'completed',
      progress: 100,
      result: {
        mdUrl: mdPublicUrl,
        message: "File processed successfully",
        fileCount: newFileCount,
        quota,
        plan: userPlan,
        needsRevalidation: true, // Indicate that client should revalidate
      },
      startTime: Date.now(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error("Async processing failed:", error);
    processingJobs.set(processingId, {
      status: 'error',
      error: msg,
      startTime: Date.now(),
    });
  }
}

export async function checkProcessingStatus(processingId: string): Promise<StatusResponse> {
  const job = processingJobs.get(processingId);

  if (!job) {
    return { status: 'error', error: 'Job not found' };
  }

  const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
  if (job.startTime < thirtyMinutesAgo && job.status === 'processing') {
    processingJobs.set(processingId, {
      ...job,
      status: 'error',
      error: 'Processing timeout',
    });
    return { status: 'error', error: 'Processing timeout' };
  }

  return {
    status: job.status,
    progress: job.progress,
    error: job.error,
    fileCount: job.result?.fileCount,
    quota: job.result?.quota,
    plan: job.result?.plan,
    result: job.result,
  };
}

export async function revalidateDashboard(): Promise<void> {
  revalidatePath("/dashboard");
}

export async function deleteFile(fileUrl: string): Promise<UploadResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const userFiles = await prisma.files.findUnique({
      where: { userId: session.user.id },
    });

    if (!userFiles) {
      return { success: false, error: "No files found for user" };
    }

    const urlArray = userFiles.mdUrls;
    const fileIndex = urlArray.findIndex((url) => url === fileUrl);
    if (fileIndex === -1) {
      return { success: false, error: "File not found in your Markdown files" };
    }

    const urlParts = fileUrl.split("/");
    const filePathIndex = urlParts.findIndex((part) => part === "files");
    if (filePathIndex === -1) {
      console.error("Invalid file URL format:", fileUrl);
      return { success: false, error: "Invalid file URL format" };
    }

    const filePath = urlParts.slice(filePathIndex + 1).join("/");

    const { error: deleteError } = await supabase.storage
      .from("files")
      .remove([filePath]);

    if (deleteError) {
      console.error("Supabase delete error:", deleteError);
    }

    const updatedUrls = urlArray.filter((url) => url !== fileUrl);

    await prisma.files.update({
      where: { userId: session.user.id },
      data: {
        mdUrls: updatedUrls,
        updatedAt: new Date(),
      },
    });

    revalidatePath("/dashboard");

    return {
      success: true,
      message: "File deleted successfully",
    };
  } catch (error) {
    console.error("Unexpected error during file deletion:", error);
    return { success: false, error: "An unexpected error occurred while deleting the file." };
  }
}

export async function getUserFiles() {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { subscription: true, files: true },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    const userPlan = user.subscription?.plan || "FREE";
    const { quota } = PLAN_LIMITS[userPlan];

    const actualFileCount = user.files?.mdUrls?.length || 0;

    if (user.files && user.files.fileCount < actualFileCount) {
      await prisma.files.update({
        where: { userId: session.user.id },
        data: {
          fileCount: actualFileCount,
          updatedAt: new Date(),
        },
      });
    }

    return {
      success: true,
      files: user.files,
      plan: userPlan,
      quota,
      currentCount: user.files?.fileCount || 0,
    };
  } catch (error) {
    console.error("Unexpected error fetching user files:", error);
    return { success: false, error: "An unexpected error occurred while fetching user files." };
  }
}

export async function processOcr(documentUrl: string) {
  try {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      throw new Error("Mistral API key is not configured");
    }

    const client = new Mistral({ apiKey });

    const ocrResponse = await client.ocr.process({
      model: "mistral-ocr-latest",
      document: {
        type: "document_url",
        documentUrl,
      },
      includeImageBase64: true,
    });

    const markdownContent = ocrResponse.pages
      .map((page) => page.markdown)
      .filter((markdown) => markdown)
      .join("\n\n");

    return {
      success: true,
      data: markdownContent,
      error: null,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown error occurred during OCR processing";
    console.error("OCR processing error:", error);
    return {
      success: false,
      error: errorMessage,
      data: undefined,
    };
  }
}