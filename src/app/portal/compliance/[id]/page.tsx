"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CheckCircle2,
  Circle,
  Calendar,
  AlertCircle,
  ArrowLeft,
  DownloadCloud,
  Clock,
  FileText,
  Users,
  MessageSquare,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface ComplianceItem {
  id: string;
  entityId: string;
  entityName: string;
  type: string;
  frequency: string;
  dueAt: string;
  status: "UPCOMING" | "OVERDUE" | "FILED" | "PENDING_APPROVAL" | "WAIVED";
  priority: "high" | "medium" | "low";
  description: string;
  assigneeId?: string;
  assigneeName?: string;
  completionPercentage: number;
}

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  required: boolean;
  dueAt?: string;
}

interface LinkedDocument {
  id: string;
  name: string;
  type: string;
  uploadedAt: string;
  linkedBy?: string;
}

interface ActivityEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details?: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ComplianceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [activeTab, setActiveTab] = useState("checklist");
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch compliance item
  const { data: complianceResponse, isLoading, mutate } = useSWR<{
    success: boolean;
    data: ComplianceItem;
  }>(`/api/compliance/${id}`, fetcher, {
    revalidateOnFocus: false,
  });

  const item = complianceResponse?.data;

  // Fetch checklist items
  const { data: checklistResponse } = useSWR<{
    success: boolean;
    data: ChecklistItem[];
  }>(item ? `/api/compliance/${id}/checklist` : null, fetcher);

  const checklist = checklistResponse?.data || [];

  // Fetch linked documents
  const { data: docsResponse } = useSWR<{
    success: boolean;
    data: LinkedDocument[];
  }>(item ? `/api/compliance/${id}/documents` : null, fetcher);

  const documents = docsResponse?.data || [];

  // Fetch activity
  const { data: activityResponse } = useSWR<{
    success: boolean;
    data: ActivityEntry[];
  }>(item ? `/api/compliance/${id}/activity` : null, fetcher);

  const activity = activityResponse?.data || [];

  const handleExportICS = async () => {
    if (!item) return;

    try {
      setIsUpdating(true);
      const response = await fetch(`/api/compliance/${id}/export-ics`);

      if (!response.ok) throw new Error("Failed to export");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${item.type}-${item.entityName}-${new Date().toISOString().split("T")[0]}.ics`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Calendar file downloaded");
    } catch (error) {
      toast.error("Failed to export calendar");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!item) return;

    try {
      setIsUpdating(true);
      const response = await fetch(`/api/compliance/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error("Failed to update");

      toast.success("Status updated");
      mutate();
    } catch (error) {
      toast.error("Failed to update status");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleChecklistToggle = async (checklistItemId: string) => {
    try {
      setIsUpdating(true);
      const response = await fetch(`/api/compliance/${id}/checklist/${checklistItemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !checklist.find((c) => c.id === checklistItemId)?.completed }),
      });

      if (!response.ok) throw new Error("Failed to update");

      toast.success("Checklist updated");
      mutate();
    } catch (error) {
      toast.error("Failed to update checklist");
    } finally {
      setIsUpdating(false);
    }
  };

  const completedChecklist = checklist.filter((c) => c.completed).length;
  const totalChecklist = checklist.length;
  const checklistPercentage = totalChecklist > 0 ? Math.round((completedChecklist / totalChecklist) * 100) : 0;

  const statusColors: Record<string, string> = {
    UPCOMING: "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200",
    OVERDUE: "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200",
    FILED: "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200",
    PENDING_APPROVAL: "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200",
    WAIVED: "bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200",
  };

  if (isLoading || !item) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin mb-4">⏳</div>
          <p className="text-gray-600">Loading compliance details...</p>
        </div>
      </div>
    );
  }

  const daysUntilDue = Math.ceil(
    (new Date(item.dueAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );
  const isOverdue = daysUntilDue < 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/portal/dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {item.type} Filing
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {item.entityName} • {item.frequency}
              </p>
            </div>
            <Badge className={statusColors[item.status]}>{item.status.replace(/_/g, " ")}</Badge>
          </div>

          {/* Danger Alert for Overdue */}
          {isOverdue && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This filing is <strong>{Math.abs(daysUntilDue)} days overdue</strong>. Please submit immediately to avoid
                penalties.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-400">Due Date</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {new Date(item.dueAt).toLocaleDateString()}
                </p>
                <p className={`text-xs font-medium ${isOverdue ? "text-red-600" : "text-blue-600"}`}>
                  {isOverdue ? `${Math.abs(daysUntilDue)} days overdue` : `${daysUntilDue} days remaining`}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-400">Priority</p>
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${
                    item.priority === "high"
                      ? "bg-red-500"
                      : item.priority === "medium"
                      ? "bg-yellow-500"
                      : "bg-green-500"
                  }`} />
                  <p className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
                    {item.priority}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-400">Completion</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {item.completionPercentage}%
                </p>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${item.completionPercentage}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-400">Assigned To</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {item.assigneeName || "Unassigned"}
                </p>
                <Button
                  variant="link"
                  size="sm"
                  className="p-0 h-auto"
                  onClick={() => toast.info("Assign functionality coming soon")}
                >
                  Change
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Description */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 dark:text-gray-300">{item.description}</p>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-2 flex-wrap">
          <Button onClick={handleExportICS} disabled={isUpdating}>
            <DownloadCloud className="h-4 w-4 mr-2" />
            Export to Calendar
          </Button>

          <Button
            variant="outline"
            disabled={isUpdating}
            onClick={() => handleStatusChange("FILED")}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Mark as Filed
          </Button>

          {item.status === "UPCOMING" && (
            <Button
              variant="outline"
              disabled={isUpdating}
              onClick={() => toast.info("Snooze functionality coming soon")}
            >
              <Clock className="h-4 w-4 mr-2" />
              Snooze
            </Button>
          )}

          <Button
            variant="outline"
            disabled={isUpdating}
            onClick={() => router.push(`/portal/messages?ref=${item.id}`)}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Contact Support
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="checklist">Checklist ({completedChecklist}/{totalChecklist})</TabsTrigger>
            <TabsTrigger value="documents">Documents ({documents.length})</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>

          {/* Checklist Tab */}
          <TabsContent value="checklist" className="space-y-4">
            {checklist.length > 0 ? (
              <Card>
                <CardContent className="pt-6 space-y-3">
                  {checklist.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                    >
                      <Checkbox
                        checked={item.completed}
                        onCheckedChange={() => handleChecklistToggle(item.id)}
                        disabled={isUpdating}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className={`font-medium ${
                            item.completed
                              ? "line-through text-gray-500"
                              : "text-gray-900 dark:text-white"
                          }`}>
                            {item.title}
                          </p>
                          {item.required && (
                            <Badge variant="outline" className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800">
                              Required
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {item.description}
                        </p>
                        {item.dueAt && (
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                            Due: {new Date(item.dueAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No checklist items for this filing. Start by uploading supporting documents.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="space-y-4">
            {documents.length > 0 ? (
              <Card>
                <CardContent className="pt-6 space-y-2">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{doc.name}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {doc.type} • Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No documents uploaded yet.{" "}
                  <Button
                    variant="link"
                    className="p-0 h-auto font-semibold"
                    onClick={() => router.push("/portal/documents")}
                  >
                    Upload documents
                  </Button>
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="space-y-4">
            {activity.length > 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    {activity.map((entry) => (
                      <div key={entry.id} className="border-l-2 border-gray-300 dark:border-gray-700 pl-4 pb-4">
                        <p className="font-medium text-gray-900 dark:text-white">{entry.action}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {entry.user} • {new Date(entry.timestamp).toLocaleString()}
                        </p>
                        {entry.details && (
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{entry.details}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>No activity recorded yet.</AlertDescription>
              </Alert>
            )}
          </TabsContent>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Filing Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Filing Type</p>
                    <p className="text-lg text-gray-900 dark:text-white">{item.type}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Frequency</p>
                    <p className="text-lg text-gray-900 dark:text-white">{item.frequency}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Entity</p>
                    <p className="text-lg text-gray-900 dark:text-white">{item.entityName}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Status</p>
                    <p className="text-lg text-gray-900 dark:text-white capitalize">
                      {item.status.replace(/_/g, " ")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
