"use client";

import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Dropzone from "react-dropzone";
import { Cloud, File, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { uploadFile, checkProcessingStatus } from "@/app/actions/ocr/ocr";
import { PLAN_LIMITS, SubscriptionPlan } from "@/constants/plan-limits";
import { PDFDocument } from "pdf-lib";

interface UploadDropzoneProps {
  userPlan: SubscriptionPlan;
  currentFileCount: number;
  quota: number;
  onUploadSuccess: () => void;
}

type ProcessingStatus = 'uploading' | 'processing' | 'completed' | 'error' | 'idle';

const UploadDropzone = ({
  userPlan,
  currentFileCount,
  quota,
  onUploadSuccess,
}: UploadDropzoneProps) => {
  const router = useRouter();
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [, setProcessingId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');

  const { maxFileSizeMB, maxPages } = PLAN_LIMITS[userPlan];

  const pollProcessingStatus = async (id: string) => {
    const maxAttempts = 120; // 10 minutes with 5-second intervals
    let attempts = 0;

    const poll = async () => {
      try {
        const statusResponse = await checkProcessingStatus(id);
        
        if (statusResponse.status === 'completed') {
          setStatus('completed');
          setUploadProgress(100);
          toast.success(`File processed successfully! (${statusResponse.fileCount}/${statusResponse.quota})`);
          onUploadSuccess();
          setTimeout(() => router.refresh(), 500);
          return;
        }
        
        if (statusResponse.status === 'error') {
          setStatus('error');
          toast.error(statusResponse.error || 'Processing failed');
          return;
        }
        
        if (statusResponse.status === 'processing') {
          if (statusResponse.progress) {
            setUploadProgress(Math.min(95, statusResponse.progress));
          }
          
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(poll, 5000);
          } else {
            setStatus('error');
            toast.error('Processing timed out. Please try again.');
          }
        }
      } catch (error) {
        console.error('Error polling status:', error);
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000);
        } else {
          setStatus('error');
          toast.error('Error checking processing status');
        }
      }
    };

    poll();
  };

  const validateFile = async (file: File): Promise<boolean> => {
    const fileSizeMB = file.size / 1024 / 1024;

    if (file.type !== "application/pdf") {
      toast.error("Invalid file type. Only PDF files are allowed.");
      return false;
    }

    if (fileSizeMB > maxFileSizeMB) {
      toast.error(
        `File size (${fileSizeMB.toFixed(1)}MB) exceeds the ${maxFileSizeMB}MB limit for your ${userPlan} plan.`
      );
      return false;
    }

    if (currentFileCount >= quota) {
      toast.error(
        `Upload limit reached! You have ${currentFileCount}/${quota} files for your ${userPlan} plan.`
      );
      return false;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pageCount = pdfDoc.getPageCount();
      if (pageCount > maxPages) {
        toast.error(
          `PDF has ${pageCount} pages, which exceeds the ${maxPages}-page limit for your ${userPlan} plan.`
        );
        return false;
      }
    } catch (error) {
      console.error("Error validating PDF pages on client:", error);
      toast.error("Error reading PDF file. Please try a different file.");
      return false;
    }

    return true;
  };

  const handleUpload = async (file: File) => {
    try {
      setFileName(file.name);
      setStatus('uploading');
      setUploadProgress(0);

      const formData = new FormData();
      formData.append("file", file);

      const uploadInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 30) {
            clearInterval(uploadInterval);
            return prev;
          }
          return prev + 5;
        });
      }, 200);

      const response = await uploadFile(formData);
      clearInterval(uploadInterval);

      if (!response.success) {
        setStatus('error');
        toast.error(response.error || "Upload failed. Please try again.");
        return;
      }

      if (response.processingId) {
        setProcessingId(response.processingId);
        setStatus('processing');
        setUploadProgress(40);
        toast.info("File uploaded! Processing in background...");
        pollProcessingStatus(response.processingId);
      } else {
        setStatus('completed');
        setUploadProgress(100);
        toast.success(`File processed successfully! (${response.fileCount}/${response.quota})`);
        onUploadSuccess();
        setTimeout(() => router.refresh(), 500);
      }
    } catch (error) {
      console.error("Unexpected error during upload:", error);
      setStatus('error');
      toast.error("An unexpected error occurred. Please try again.");
    }
  };

  const resetUpload = () => {
    setStatus('idle');
    setUploadProgress(0);
    setProcessingId(null);
    setFileName('');
  };

  const isQuotaExceeded = currentFileCount >= quota;
  const isUploading = status === 'uploading' || status === 'processing';

  const getStatusMessage = () => {
    switch (status) {
      case 'uploading':
        return 'Uploading file...';
      case 'processing':
        return 'Processing file... This may take several minutes for large PDFs.';
      case 'completed':
        return 'Processing completed!';
      case 'error':
        return 'Processing failed. Please try again.';
      default:
        return '';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'uploading':
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 p-3 rounded-lg border">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Plan: {userPlan}</span>
          <span
            className={`font-medium ${
              isQuotaExceeded ? "text-red-600" : "text-gray-600"
            }`}
          >
            {currentFileCount}/{quota} files
          </span>
        </div>
        <div className="mt-2">
          <Progress value={(currentFileCount / quota) * 100} className="h-2" />
        </div>
        {isQuotaExceeded && (
          <div className="flex items-center gap-2 mt-2 text-red-600 text-sm">
            <AlertCircle className="h-4 w-4" />
            <span>Upload limit reached. Please upgrade your plan.</span>
          </div>
        )}
      </div>

      {status !== 'idle' && (
        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2 text-sm">
            {getStatusIcon()}
            <span className="font-medium">{fileName}</span>
          </div>
          <p className="text-sm text-blue-700 mt-1">{getStatusMessage()}</p>
          {isUploading && (
            <div className="mt-2">
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-xs text-blue-600 mt-1">{uploadProgress}%</p>
            </div>
          )}
          {(status === 'completed' || status === 'error') && (
            <Button
              variant="outline"
              size="sm"
              onClick={resetUpload}
              className="mt-2"
            >
              Upload Another File
            </Button>
          )}
        </div>
      )}

      {status === 'idle' && (
        <Dropzone
          multiple={false}
          accept={{ "application/pdf": [".pdf"] }}
          disabled={isUploading || isQuotaExceeded}
          onDrop={async (acceptedFiles) => {
            const file = acceptedFiles[0];
            if (file && (await validateFile(file))) {
              await handleUpload(file);
            }
          }}
        >
          {({ getRootProps, getInputProps, acceptedFiles, isDragActive }) => (
            <div
              {...getRootProps()}
              className={`border h-64 border-dashed rounded-lg transition-colors ${
                isQuotaExceeded
                  ? "border-gray-200 bg-gray-50 cursor-not-allowed"
                  : isDragActive
                  ? "border-blue-400 bg-blue-50"
                  : "border-gray-300 hover:border-gray-400"
              }`}
            >
              <div className="flex items-center justify-center h-full w-full">
                <div
                  className={`flex flex-col items-center justify-center w-full h-full rounded-lg ${
                    isQuotaExceeded
                      ? "cursor-not-allowed"
                      : "cursor-pointer bg-gray-50 hover:bg-gray-100"
                  }`}
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Cloud
                      className={`h-6 w-6 mb-2 ${
                        isQuotaExceeded ? "text-gray-400" : "text-zinc-500"
                      }`}
                    />
                    <p
                      className={`mb-2 text-sm ${
                        isQuotaExceeded ? "text-gray-400" : "text-zinc-700"
                      }`}
                    >
                      {isQuotaExceeded ? (
                        <span>Upload limit reached</span>
                      ) : (
                        <>
                          <span className="font-semibold">Click to upload</span> or
                          drag and drop
                        </>
                      )}
                    </p>
                    {!isQuotaExceeded && (
                      <p className="text-xs text-zinc-500">
                        PDF (up to {maxFileSizeMB}MB, max {maxPages} pages)
                      </p>
                    )}
                  </div>

                  {acceptedFiles && acceptedFiles[0] && !isQuotaExceeded ? (
                    <div className="max-w-xs bg-white flex items-center rounded-md overflow-hidden outline outline-[1px] outline-zinc-200 divide-x divide-zinc-200">
                      <div className="px-3 py-2 h-full grid place-items-center">
                        <File className="h-4 w-4 text-blue-500" />
                      </div>
                      <div className="px-3 py-2 h-full text-sm truncate">
                        {acceptedFiles[0].name}
                      </div>
                    </div>
                  ) : null}

                  <input
                    {...getInputProps()}
                    type="file"
                    className="hidden"
                    disabled={isQuotaExceeded}
                  />
                </div>
              </div>
            </div>
          )}
        </Dropzone>
      )}
    </div>
  );
};

interface UploadButtonProps {
  userPlan?: SubscriptionPlan;
  currentFileCount?: number;
  quota?: number;
  onUploadSuccess?: () => void;
}

const UploadButton = ({
  userPlan = "FREE",
  currentFileCount = 0,
  quota = PLAN_LIMITS.FREE.quota,
  onUploadSuccess = () => {},
}: UploadButtonProps) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const isQuotaExceeded = currentFileCount >= quota;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(v) => {
        if (!v) {
          setIsOpen(v);
        }
      }}
    >
      <DialogTitle className="sr-only">Upload PDF</DialogTitle>
      <DialogTrigger onClick={() => setIsOpen(true)} asChild>
        <Button disabled={isQuotaExceeded}>
          {isQuotaExceeded ? "Quota Exceeded" : "Upload PDF"}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Upload PDF</h2>
            <p className="text-sm text-gray-600">
              Upload a PDF file to process. Large files will be processed in the background.
            </p>
          </div>
          <UploadDropzone
            userPlan={userPlan}
            currentFileCount={currentFileCount}
            quota={quota}
            onUploadSuccess={() => {
              onUploadSuccess();
              // Don't close dialog immediately for async processing
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UploadButton;