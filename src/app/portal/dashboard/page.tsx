"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import FeaturesHub from "@/components/portal/FeaturesHub";
import {
  Search,
  Clock,
  FileText,
  Users,
  DollarSign,
  Settings,
  Plus,
  ChevronRight,
  Zap,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";

interface Entity {
  id: string;
  name: string;
  country: string;
  status: string;
}

interface UpcomingCompliance {
  id: string;
  type: string;
  dueAt: string;
  priority: "high" | "medium" | "low";
  status: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function DashboardPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch user's entities
  const { data: entitiesResponse, isLoading: entitiesLoading } = useSWR<{
    success: boolean;
    data: Entity[];
  }>("/api/entities", fetcher, {
    revalidateOnFocus: false,
  });

  const entities = entitiesResponse?.data || [];
  const primaryEntity = entities[0];

  // Fetch upcoming compliance
  const { data: complianceResponse } = useSWR<{
    success: boolean;
    data: UpcomingCompliance[];
  }>(primaryEntity ? "/api/compliance/upcoming?limit=3" : null, fetcher, {
    revalidateOnFocus: false,
  });

  const upcomingCompliance = complianceResponse?.data || [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    toast.info("Global search coming soon");
  };

  const countryFlags: Record<string, string> = {
    AE: "🇦🇪",
    SA: "🇸��",
    EG: "🇪🇬",
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Greeting & Time */}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {getGreeting()}, {session?.user?.name?.split(" ")[0] || "there"}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>

            {/* Right: Search & Actions */}
            <div className="flex items-center gap-2">
              <div className="relative hidden sm:block">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search (Cmd+K)"
                  className="pl-10 pr-4 py-2 text-sm w-48"
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchOpen(!searchOpen)}
                className="sm:hidden"
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Search */}
      {searchOpen && (
        <div className="sm:hidden bg-white dark:bg-gray-800 border-b p-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              placeholder="Search entities, filings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            <Button type="submit" size="sm">
              Search
            </Button>
          </form>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* No Entities State */}
        {!entitiesLoading && entities.length === 0 && (
          <Alert className="bg-blue-50 dark:bg-blue-900 border-blue-200 dark:border-blue-800">
            <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-900 dark:text-blue-200">
              <div className="font-semibold mb-2">Get started with your first entity</div>
              <p className="text-sm mb-3">
                Create a business account or add an existing one to manage tax obligations.
              </p>
              <Link href="/portal/setup">
                <Button size="sm" className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Business Account
                </Button>
              </Link>
            </AlertDescription>
          </Alert>
        )}

        {/* Verification Status Widget */}
        {primaryEntity && primaryEntity.status === "PENDING" && (
          <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800">
            <CardContent className="pt-6 flex items-start gap-4">
              <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-1">
                  Verifying Your Business Setup
                </h3>
                <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-3">
                  {"We're verifying your business details. This usually takes 5-10 minutes."}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/portal/setup-status/${primaryEntity.id}`)}
                  className="text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700 hover:bg-yellow-100 dark:hover:bg-yellow-900/40"
                >
                  View Status
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Features Hub - Full Width */}
        <FeaturesHub entityId={primaryEntity?.id} />

        {/* Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Widgets */}
          <div className="lg:col-span-2 space-y-6">
            {/* Entity Selector */}
            {entities.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Your Entities</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {entities.map((entity) => (
                      <button
                        key={entity.id}
                        onClick={() => router.push(`/portal/entities/${entity.id}`)}
                        className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition text-left"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                              <span>{countryFlags[entity.country] || "🌍"}</span>
                              {entity.name}
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              {entity.country}
                            </p>
                          </div>
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              entity.status === "ACTIVE"
                                ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                                : "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200"
                            }`}
                          >
                            {entity.status}
                          </span>
                        </div>
                      </button>
                    ))}
                    <Link href="/portal/entities/new" className="h-full">
                      <button className="w-full p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition flex items-center justify-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Entity
                      </button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Upcoming Compliance */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Upcoming Deadlines</CardTitle>
                <Link href="/portal/compliance">
                  <Button variant="ghost" size="sm">
                    View All
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {upcomingCompliance.length > 0 ? (
                  <div className="space-y-3">
                    {upcomingCompliance.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-4 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer"
                        onClick={() => router.push(`/portal/compliance/${item.id}`)}
                      >
                        <div className="flex-shrink-0">
                          <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white">{item.type}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            Due {new Date(item.dueAt).toLocaleDateString()}
                          </p>
                        </div>
                        <span
                          className={`flex-shrink-0 text-xs px-2 py-1 rounded font-medium ${
                            item.priority === "high"
                              ? "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200"
                              : item.priority === "medium"
                              ? "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200"
                              : "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                          }`}
                        >
                          {item.priority}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-600 dark:text-gray-400 py-8">
                    No upcoming deadlines
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Quick Access & Features (visible on desktop) */}
          <div className="space-y-6">
            {/* Features Quick Access */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Features</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
                  {[
                    { icon: FileText, label: "Documents", href: "/portal/documents" },
                    { icon: Users, label: "Team", href: "/portal/team" },
                    { icon: DollarSign, label: "Invoicing", href: "/portal/invoicing" },
                    { icon: Settings, label: "Settings", href: "/portal/settings" },
                  ].map((feature) => (
                    <Link key={feature.label} href={feature.href}>
                      <button className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition flex flex-col items-center justify-center gap-2">
                        <feature.icon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                        <span className="text-xs font-medium text-gray-900 dark:text-white text-center">
                          {feature.label}
                        </span>
                      </button>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Active Entities</span>
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">
                    {entities.filter((e) => e.status === "ACTIVE").length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Pending Setup</span>
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">
                    {entities.filter((e) => e.status === "PENDING").length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Upcoming Filings</span>
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">
                    {upcomingCompliance.length}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
