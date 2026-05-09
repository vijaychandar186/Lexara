"use client";

import { useState, useEffect } from "react";
import {
  UploadIcon,
  Loader2,
  FileText,
  Download,
  Trash,
  AlertCircle,
  File,
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import UploadButton from "./upload-button";
import { getUserFiles, deleteFile } from "@/app/actions/ocr/ocr";
import { PLAN_LIMITS, SubscriptionPlan } from "@/constants/plan-limits";

interface FileData {
  id: string;
  url: string;
  name: string;
  type: "Markdown";
  uploadedAt: Date;
  downloadUrl: string;
}

interface FileGroup {
  id: string;
  baseName: string;
  uploadedAt: Date;
  markdown: FileData;
}

interface UserFilesData {
  success: boolean;
  files?: {
    id: string;
    mdUrls: string[];
    fileCount: number;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  plan?: SubscriptionPlan;
  quota?: number;
  currentCount?: number;
  error?: string;
}

const Dashboard = () => {
  const [currentlyDeletingFile, setCurrentlyDeletingFile] = useState<string | null>(null);
  const [userFilesData, setUserFilesData] = useState<UserFilesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<{
    url: string;
    type: "Markdown";
  } | null>(null);

  const extractBaseName = (filename: string): string => {
    return filename.replace(/^\d+-/, "").replace(/\.md$/i, "");
  };

  const transformUrlsToFileGroups = (
    mdUrls: string[],
    createdAt: Date
  ): FileGroup[] => {
    const fileGroups: FileGroup[] = [];

    mdUrls.forEach((url, index) => {
      const urlParts = url.split("/");
      const filename = urlParts[urlParts.length - 1];
      const cleanFilename = filename.replace(/^\d+-/, "").replace(/\.md$/, "");
      const baseName = extractBaseName(filename);

      const uniqueId = `${baseName}-${index}-${url.split("/").pop()}`;

      const fileData: FileData = {
        id: `${url}-md-${index}`,
        url,
        name: cleanFilename || `document-${index + 1}`,
        type: "Markdown",
        uploadedAt: createdAt,
        downloadUrl: url,
      };

      fileGroups.push({
        id: uniqueId,
        baseName: cleanFilename || `document-${index + 1}`,
        uploadedAt: createdAt,
        markdown: fileData,
      });
    });

    return fileGroups;
  };

  const loadUserFiles = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getUserFiles();
      setUserFilesData(data);
      if (!data.success) {
        setError(data.error || "Failed to load files");
        toast.error(data.error || "Failed to load files");
      }
    } catch (err) {
      console.error("Error loading files:", err);
      setError(err instanceof Error ? err.message : "Failed to load files");
      toast.error(err instanceof Error ? err.message : "Failed to load files");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUserFiles();
  }, []);

  const handleDeleteFile = async () => {
    if (!fileToDelete) return;

    setCurrentlyDeletingFile(fileToDelete.url);
    try {
      const response = await deleteFile(fileToDelete.url);
      if (!response.success) {
        toast.error(response.error || "Failed to delete file");
        return;
      }
      toast.success("File deleted successfully");
      await loadUserFiles();
    } catch (err) {
      console.error("Error deleting file:", err);
      toast.error(err instanceof Error ? err.message : "Failed to delete file");
    } finally {
      setCurrentlyDeletingFile(null);
      setShowDeleteDialog(false);
      setFileToDelete(null);
    }
  };

  const openDeleteDialog = (url: string, type: "Markdown") => {
    setFileToDelete({ url, type });
    setShowDeleteDialog(true);
  };

  if (error) {
    return (
      <main className="mx-auto max-w-7xl p-6">
        <Card className="border-red-200">
          <CardContent className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Files</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <Button onClick={loadUserFiles}>Try Again</Button>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  const fileGroups = userFilesData?.files
    ? transformUrlsToFileGroups(
        userFilesData.files.mdUrls,
        userFilesData.files.createdAt
      )
    : [];

  const currentCount = userFilesData?.currentCount || 0;
  const quota = userFilesData?.quota || PLAN_LIMITS.FREE.quota;
  const plan = userFilesData?.plan || "FREE";

  return (
    <main className="mx-auto max-w-7xl p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Files</h1>
          <p className="text-gray-600">Manage your processed Markdown documents</p>
        </div>
        <UploadButton
          userPlan={plan}
          currentFileCount={currentCount}
          quota={quota}
          onUploadSuccess={loadUserFiles}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Plan Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3">
            <div>
              <h3 className="font-semibold text-gray-900">Current Plan: {plan}</h3>
              <p className="text-sm text-gray-600">
                {currentCount} of {quota} files used
              </p>
            </div>
            <div className="text-right mt-2 sm:mt-0">
              <div className="text-sm text-gray-600 mb-1">
                Usage: {Math.round((currentCount / quota) * 100)}%
              </div>
              <Progress value={(currentCount / quota) * 100} className="w-32 h-2" />
            </div>
          </div>
          {currentCount >= quota && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>Storage limit reached. Upgrade your plan to upload more files.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {fileGroups.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Your Documents</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {fileGroups
              .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
              .map((group) => (
                <Card key={group.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <File className="h-5 w-5 text-blue-600" />
                      <span className="truncate">{group.baseName}</span>
                    </CardTitle>
                    <p className="text-sm text-gray-600">
                      Uploaded {format(new Date(group.uploadedAt), "MMM dd, yyyy")}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Markdown File */}
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-600" />
                        <div>
                          <p className="font-medium text-sm text-blue-900">Markdown Text</p>
                          <p className="text-xs text-blue-700 truncate max-w-[150px]">
                            {group.markdown.name}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2 border-blue-200 hover:bg-blue-100"
                          asChild
                        >
                          <a href={group.markdown.downloadUrl} download>
                            <Download className="h-3 w-3" />
                          </a>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2 border-blue-200 hover:bg-blue-100 text-blue-600"
                          onClick={() => openDeleteDialog(group.markdown.url, "Markdown")}
                          disabled={currentlyDeletingFile === group.markdown.url}
                        >
                          {currentlyDeletingFile === group.markdown.url ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      ) : isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="h-12 bg-gray-100 rounded animate-pulse" />
                  <div className="h-8 bg-gray-100 rounded animate-pulse" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 pt-6">
            <UploadIcon className="h-8 w-8 text-gray-500" />
            <h3 className="font-semibold text-xl">No files yet</h3>
            <p className="text-gray-600 text-center max-w-md">
              Upload your first PDF to get started. You can upload up to {quota} files with your {plan} plan.
            </p>
            <UploadButton
              userPlan={plan}
              currentFileCount={currentCount}
              quota={quota}
              onUploadSuccess={loadUserFiles}
            />
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this Markdown file? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setFileToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFile}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
};

export default Dashboard;