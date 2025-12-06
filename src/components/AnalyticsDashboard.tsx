import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Overview } from './dashboard/Overview';
import { RecentActivity } from './dashboard/RecentActivity';
import { Button } from './ui/button';
import { Download } from 'lucide-react';

// Redefine type for frontend
// Redefine type for frontend
interface AnalyticsStats {
    totalAssets: number;
    assetsByStatus: Record<string, number>;
    assetsByType: Record<string, number>;
    assetsByAuthor: Record<string, number>;
    recentActivity: any[];
    ingressOverTime: { date: string; count: number }[];
}

export const AnalyticsDashboard: React.FC = () => {
    const [stats, setStats] = useState<AnalyticsStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // @ts-ignore
                const data = await window.ipcRenderer.invoke('get-analytics-stats');
                setStats(data);
            } catch (error) {
                console.error('Failed to fetch analytics:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    if (loading) return <div className="flex h-full items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
    if (!stats) return <div className="p-8 text-destructive">Failed to load analytics.</div>;

    return (
        <div className="flex-1 space-y-4 p-8 pt-6 overflow-y-auto h-full bg-gradient-to-b from-background to-background/80">
            <div className="flex items-center justify-between space-y-2 mb-6">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Dashboard</h2>
                    <p className="text-muted-foreground">Project insights and performance metrics.</p>
                </div>
                <div className="flex items-center space-x-2">
                    <Button disabled variant="outline">
                        <Download className="mr-2 h-4 w-4" />
                        Export Report
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="overview" className="space-y-4">
                <TabsList className="bg-muted/50 p-1">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="content" disabled>Content Analysis</TabsTrigger>
                    <TabsTrigger value="reports" disabled>Reports</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card className="bg-card/50 backdrop-blur-sm border-primary/10 hover:border-primary/30 transition-colors">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
                                <div className="h-4 w-4 text-primary" >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="h-4 w-4">
                                        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                                    </svg>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.totalAssets}</div>
                                <p className="text-xs text-muted-foreground">in project library</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-card/50 backdrop-blur-sm border-primary/10 hover:border-primary/30 transition-colors">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Images</CardTitle>
                                <div className="h-4 w-4 text-blue-500">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="h-4 w-4">
                                        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                                        <circle cx="9" cy="9" r="2" />
                                        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                                    </svg>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.assetsByType['image'] || 0}</div>
                                <p className="text-xs text-muted-foreground">
                                    {((stats.assetsByType['image'] || 0) / (stats.totalAssets || 1) * 100).toFixed(1)}% of total
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="bg-card/50 backdrop-blur-sm border-primary/10 hover:border-primary/30 transition-colors">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Videos</CardTitle>
                                <div className="h-4 w-4 text-purple-500">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="h-4 w-4">
                                        <path d="M15 10l5-5v14l-5-5" />
                                        <rect x="2" y="6" width="13" height="12" rx="2" />
                                    </svg>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.assetsByType['video'] || 0}</div>
                                <p className="text-xs text-muted-foreground">
                                    {((stats.assetsByType['video'] || 0) / (stats.totalAssets || 1) * 100).toFixed(1)}% of total
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="bg-card/50 backdrop-blur-sm border-primary/10 hover:border-primary/30 transition-colors">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Top Author</CardTitle>
                                <div className="h-4 w-4 text-green-500">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="h-4 w-4">
                                        <circle cx="12" cy="12" r="10" />
                                        <path d="M12 8v8" />
                                        <path d="M8 12h8" />
                                    </svg>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-xl font-bold truncate">
                                    {Object.entries(stats.assetsByAuthor).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {Object.entries(stats.assetsByAuthor).sort((a, b) => b[1] - a[1])[0]?.[1] || 0} assets contributed
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                        <Card className="col-span-4 bg-card/50 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle>Asset Ingestion</CardTitle>
                                <CardDescription>New assets added over the last 30 days.</CardDescription>
                            </CardHeader>
                            <CardContent className="pl-2">
                                <Overview data={stats.ingressOverTime} />
                            </CardContent>
                        </Card>

                        <Card className="col-span-3 bg-card/50 backdrop-blur-sm flex flex-col">
                            <CardHeader>
                                <CardTitle>Recent Activity</CardTitle>
                                <CardDescription>Latest actions across the project.</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1 overflow-auto max-h-[400px]">
                                <RecentActivity activity={stats.recentActivity} />
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
};
