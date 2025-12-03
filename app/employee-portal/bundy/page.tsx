'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useEmployeeSession } from '@/contexts/EmployeeSessionContext';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { toast } from 'sonner';
import { MapPin, ArrowLeft, ArrowRight } from 'lucide-react';
import {
  getBiMonthlyPeriodEnd,
  getBiMonthlyPeriodStart,
  getNextBiMonthlyPeriod,
  getPreviousBiMonthlyPeriod,
  formatBiMonthlyPeriod,
} from '@/utils/bimonthly';

interface TimeEntry {
  id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  clock_in_location: string | null;
  clock_out_location: string | null;
  total_hours: number | null;
  status: string;
}

interface LocationStatus {
  isAllowed: boolean;
  nearestLocation: string | null;
  distance: number | null;
  error: string | null;
}

export default function BundyClockPage() {
  const { employee } = useEmployeeSession();
  const supabase = createClient();

  const [currentEntry, setCurrentEntry] = useState<TimeEntry | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus | null>(null);
  const [periodStart, setPeriodStart] = useState<Date>(() => getBiMonthlyPeriodStart(new Date()));
  const periodEnd = useMemo(() => getBiMonthlyPeriodEnd(periodStart), [periodStart]);
  const [loading, setLoading] = useState(true);
  const [initialFetchComplete, setInitialFetchComplete] = useState(false);

  const validateLocation = useCallback(async (lat: number, lng: number) => {
    const { data, error } = await supabase.rpc('is_employee_location_allowed', {
      p_employee_uuid: employee.id,
      p_latitude: lat,
      p_longitude: lng,
    });

    if (error) {
      setLocationStatus({
        isAllowed: false,
        nearestLocation: null,
        distance: null,
        error: 'Failed to validate location',
      });
      return;
    }

    if (data && data.length > 0) {
      const result = data[0];
      setLocationStatus({
        isAllowed: result.is_allowed,
        nearestLocation: result.nearest_location_name,
        distance: result.distance_meters ? Math.round(result.distance_meters) : null,
        error: result.error_message,
      });
    }
  }, [employee.id, supabase]);

  const checkClockStatus = useCallback(async () => {
    const { data } = await supabase
      .from('time_clock_entries')
      .select('*')
      .eq('employee_id', employee.id)
      .eq('status', 'clocked_in')
      .order('clock_in_time', { ascending: false })
      .limit(1)
      .single();

    setCurrentEntry(data || null);
  }, [employee.id, supabase]);

  const fetchEntries = useCallback(async () => {
    const { data } = await supabase
      .from('time_clock_entries')
      .select('*')
      .eq('employee_id', employee.id)
      .gte('clock_in_time', periodStart.toISOString())
      .lte('clock_in_time', periodEnd.toISOString())
      .order('clock_in_time', { ascending: false });

    setEntries(data || []);
  }, [employee.id, periodEnd, periodStart, supabase]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchInitialData = async () => {
      await Promise.all([checkClockStatus(), fetchEntries()]);
      setLoading(false);
      setInitialFetchComplete(true);
    };
    fetchInitialData();
  }, [checkClockStatus, fetchEntries]);

  useEffect(() => {
    if (!initialFetchComplete) return;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const loc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setLocation(loc);
          await validateLocation(loc.lat, loc.lng);
        },
        (error) => {
          console.log('Location not available:', error);
        },
        { enableHighAccuracy: true }
      );
    }
  }, [initialFetchComplete, validateLocation]);

  async function handleClock(event: 'in' | 'out') {
    if (!location) {
      toast.error('📍 Please enable location services to use the time clock');
      return;
    }

    await validateLocation(location.lat, location.lng);
    const { data: validationData } = await supabase.rpc('is_employee_location_allowed', {
      p_employee_uuid: employee.id,
      p_latitude: location.lat,
      p_longitude: location.lng,
    });

    if (validationData && validationData.length > 0 && !validationData[0].is_allowed) {
      toast.error(`🚫 ${validationData[0].error_message || 'You are not at an allowed location'}`);
      return;
    }

    const locationString = `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;

    if (event === 'in') {
      const { data, error } = await supabase
        .from('time_clock_entries')
        .insert({
          employee_id: employee.id,
          clock_in_time: new Date().toISOString(),
          clock_in_location: locationString,
          status: 'clocked_in',
        })
        .select()
        .single();

      if (error) {
        toast.error('Failed to clock in');
        return;
      }

      setCurrentEntry(data);
      toast.success('✅ Clocked in successfully!');
      fetchEntries();
      return;
    }

    if (!currentEntry) return;

    const { error } = await supabase
      .from('time_clock_entries')
      .update({
        clock_out_time: new Date().toISOString(),
        clock_out_location: locationString,
      })
      .eq('id', currentEntry.id);

    if (error) {
      toast.error('Failed to clock out');
      return;
    }

    toast.success('✅ Clocked out successfully!');
    setCurrentEntry(null);
    fetchEntries();
  }

  const totalHours = entries.reduce((sum, entry) => sum + (entry.total_hours || 0), 0);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2 text-center">
            <div className="text-6xl font-bold text-gray-800 font-mono">
              {currentTime.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </div>
            <div className="text-gray-500">
              {currentTime.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                className="px-3 py-3"
                onClick={() => setPeriodStart(getPreviousBiMonthlyPeriod(periodStart))}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase tracking-widest">Bi-Monthly Period</p>
                <p className="text-lg font-semibold text-gray-800">
                  {formatBiMonthlyPeriod(periodStart, periodEnd)}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="px-3 py-3"
                onClick={() => setPeriodStart(getNextBiMonthlyPeriod(periodStart))}
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-sm text-gray-500">
              Total Hours: <span className="font-semibold text-gray-900">{totalHours.toFixed(2)}h</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => handleClock('in')}
              disabled={!!currentEntry || !locationStatus?.isAllowed}
              className={`py-4 rounded-xl text-lg font-bold uppercase tracking-wider transition ${
                currentEntry || !locationStatus?.isAllowed
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 shadow-lg'
              }`}
            >
              Time In
            </button>
            <button
              onClick={() => handleClock('out')}
              disabled={!currentEntry || !locationStatus?.isAllowed}
              className={`py-4 rounded-xl text-lg font-bold uppercase tracking-wider transition ${
                !currentEntry || !locationStatus?.isAllowed
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-br from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 shadow-lg'
              }`}
            >
              Time Out
            </button>
          </div>

          <div>
            {location ? (
              locationStatus ? (
                locationStatus.isAllowed ? (
                  <div className="inline-flex items-center gap-2 text-sm text-green-600 bg-green-50 px-4 py-2 rounded-full border border-green-200">
                    <MapPin className="h-4 w-4" />
                    <span>
                      At {locationStatus.nearestLocation || 'an approved site'}
                      {locationStatus.distance !== null && ` (${locationStatus.distance}m away)`}
                    </span>
                  </div>
                ) : (
                  <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 text-sm text-red-700">
                    <p className="font-semibold mb-1">Location not allowed</p>
                    <p>{locationStatus.error || 'You must be at an approved location to clock in/out.'}</p>
                  </div>
                )
              ) : (
                <div className="inline-flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-200">
                  <MapPin className="h-4 w-4" />
                  <span>Validating location...</span>
                </div>
              )
            ) : (
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 text-sm text-red-700">
                <p className="font-semibold mb-1">Location required</p>
               <p>Please enable GPS/location services and refresh the page.</p>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Time Records</h2>
          <p className="text-sm text-gray-500">{formatBiMonthlyPeriod(periodStart, periodEnd)}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Time In</th>
                <th className="text-left px-4 py-3">Time Out</th>
                <th className="text-right px-4 py-3">Hours</th>
                <th className="text-center px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-500">
                    No time records for this period.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50 text-gray-800">
                    <td className="px-4 py-3">
                      {new Date(entry.clock_in_time).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        weekday: 'short',
                      })}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {new Date(entry.clock_in_time).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {entry.clock_out_time
                        ? new Date(entry.clock_out_time).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {entry.total_hours ? entry.total_hours.toFixed(2) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          entry.status === 'clocked_in'
                            ? 'bg-green-100 text-green-700'
                            : entry.status === 'approved' || entry.status === 'auto_approved'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {entry.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

