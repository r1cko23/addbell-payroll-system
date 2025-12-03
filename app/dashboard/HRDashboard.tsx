'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card } from '@/components/Card';
import { Loader2, Users, Clock, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { OfficeLocation, resolveLocationDetails } from '@/lib/location';
import Link from 'next/link';
import { Button } from '@/components/Button';

interface ClockEntry {
  id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  status: string;
  clock_in_location: string | null;
  clock_out_location: string | null;
  employees: {
    employee_id: string;
    full_name: string;
  };
}

export default function HRDashboard() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [recentEntries, setRecentEntries] = useState<ClockEntry[]>([]);
  const [clockedInEntries, setClockedInEntries] = useState<ClockEntry[]>([]);
  const [officeLocations, setOfficeLocations] = useState<OfficeLocation[]>([]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [employeeCountRes, recentRes, activeRes, locationsRes] = await Promise.all([
          supabase.from('employees').select('id', { count: 'exact', head: true }),
          supabase
            .from('time_clock_entries')
            .select(
              `
              *,
              employees (
                employee_id,
                full_name
              )
            `
            )
            .order('clock_in_time', { ascending: false })
            .limit(8),
          supabase
            .from('time_clock_entries')
            .select(
              `
              *,
              employees (
                employee_id,
                full_name
              )
            `
            )
            .eq('status', 'clocked_in')
            .order('clock_in_time', { ascending: true }),
          supabase
            .from('office_locations')
            .select('id, name, address, latitude, longitude, radius_meters'),
        ]);

        setTotalEmployees(employeeCountRes.count || 0);
        setRecentEntries((recentRes.data || []) as ClockEntry[]);
        setClockedInEntries((activeRes.data || []) as ClockEntry[]);
        setOfficeLocations((locationsRes.data || []) as OfficeLocation[]);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [supabase]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Workforce Overview</h1>
          <p className="text-muted-foreground mt-2">
            Track employee registrations and the latest time in/out activity.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Employees Registered</p>
                <p className="text-3xl font-bold text-foreground mt-2">{totalEmployees}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-full">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Currently Clocked In</p>
                <p className="text-3xl font-bold text-foreground mt-2">{clockedInEntries.length}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-full">
                <Clock className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </Card>
          <Card className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Manage Time Entries</p>
              <p className="text-lg font-semibold text-foreground mt-2">
                Review approvals and locations
              </p>
              </div>
            <Link href="/time-entries">
              <Button variant="secondary">Open</Button>
            </Link>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Currently Clocked In</h2>
                <p className="text-sm text-muted-foreground">
                  Showing employees whose status is still clocked in today.
                </p>
              </div>
            </div>
            {clockedInEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No employees are clocked in at the moment.</p>
            ) : (
              <div className="space-y-3">
                {clockedInEntries.map((entry) => {
                  const details = resolveLocationDetails(entry.clock_in_location, officeLocations);
                  return (
                    <div
                      key={entry.id}
                      className="border rounded-lg p-3 flex items-start justify-between bg-muted/50"
                    >
                      <div>
                        <p className="font-semibold text-foreground">{entry.employees.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          Since {format(new Date(entry.clock_in_time), 'MMM d, h:mm a')}
                        </p>
                        <div className="mt-2 text-xs text-muted-foreground flex items-start gap-1">
                          <MapPin className="h-3 w-3 mt-0.5 text-blue-500" />
                          <div>
                            <span className="text-foreground font-medium">{details.name}</span>
                            <div>{details.address}</div>
                    </div>
                  </div>
                    </div>
                      <div className="text-xs text-blue-600 font-semibold bg-blue-50 px-2 py-1 rounded-full">
                        ACTIVE
                  </div>
                    </div>
                  );
                })}
                    </div>
            )}
        </Card>

          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Recent Clock Activity</h2>
                <p className="text-sm text-muted-foreground">
                  Latest clock in/out events from all employees.
                </p>
              </div>
              <div className="text-xs text-muted-foreground">
                {format(new Date(), 'MMM d, yyyy')}
              </div>
            </div>
            {recentEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No clock entries recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {recentEntries.map((entry) => {
                  const clockInDetails = resolveLocationDetails(entry.clock_in_location, officeLocations);
                  const clockOutDetails = resolveLocationDetails(entry.clock_out_location, officeLocations);
                  const statusLabel = entry.status.replace('_', ' ').toUpperCase();

                  return (
                    <div key={entry.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
              <div>
                          <p className="font-semibold text-foreground">{entry.employees.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {statusLabel} · {format(new Date(entry.clock_in_time), 'MMM d, h:mm a')}
                          </p>
                        </div>
                        <div className="text-[11px] px-2 py-1 rounded-full bg-muted text-muted-foreground">
                          {entry.employees.employee_id}
                        </div>
                      </div>
                      <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                        <div className="flex items-start gap-2">
                          <span className="font-semibold text-foreground">Clock In:</span>
                          <div>
                            <div>{clockInDetails.name}</div>
                            <div>{clockInDetails.address}</div>
                          </div>
                        </div>
                        {entry.clock_out_time && (
                          <div className="flex items-start gap-2">
                            <span className="font-semibold text-foreground">Clock Out:</span>
                            <div>
                              <div>
                                {format(new Date(entry.clock_out_time), 'MMM d, h:mm a')}
                              </div>
                              <div>{clockOutDetails.name}</div>
                              <div>{clockOutDetails.address}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
            </div>
      </div>
    </DashboardLayout>
  );
}
