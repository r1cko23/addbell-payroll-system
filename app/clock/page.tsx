"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { CardSection } from "@/components/ui/card-section";
import { H1, H3, BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";

interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
}

interface ClockEntry {
  id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  clock_in_location: string | null;
  clock_out_location: string | null;
  status: "clocked_in" | "clocked_out" | "approved" | "rejected";
  total_hours: number | null;
  regular_hours: number | null;
  overtime_hours: number | null;
  employee_notes: string | null;
}

export default function ClockPage() {
  const supabase = createClient();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [currentEntry, setCurrentEntry] = useState<ClockEntry | null>(null);
  const [todayEntries, setTodayEntries] = useState<ClockEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [locationStatus, setLocationStatus] = useState<{
    isAllowed: boolean;
    nearestLocation: string | null;
    distance: number | null;
    error: string | null;
  } | null>(null);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch employees
  useEffect(() => {
    fetchEmployees();
  }, []);

  // Check clock status when employee is selected
  useEffect(() => {
    if (selectedEmployeeId) {
      checkClockStatus();
      fetchTodayEntries();
    } else {
      setCurrentEntry(null);
      setTodayEntries([]);
    }
  }, [selectedEmployeeId]);

  // Get location on component mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const loc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setLocation(loc);
          // Validate location
          await validateLocation(loc.lat, loc.lng);
        },
        (error) => {
          console.log("Location not available:", error);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        }
      );
    }
  }, []);

  async function validateLocation(lat: number, lng: number) {
    const { data, error } = await supabase.rpc("is_location_allowed", {
      p_latitude: lat,
      p_longitude: lng,
    } as any);

    if (error) {
      console.error("Location validation error:", error);
      setLocationStatus({
        isAllowed: false,
        nearestLocation: null,
        distance: null,
        error: "Failed to validate location",
      });
      return;
    }

    if (data) {
      const dataArray = data as Array<{
        is_allowed: boolean;
        nearest_location_name: string | null;
        distance_meters: number | null;
        error_message: string | null;
      }>;

      if (dataArray.length > 0) {
        const result = dataArray[0];
        setLocationStatus({
          isAllowed: result.is_allowed,
          nearestLocation: result.nearest_location_name,
          distance: result.distance_meters
            ? Math.round(result.distance_meters)
            : null,
          error: result.error_message,
        });
      }
    }
  }

  async function fetchEmployees() {
    const { data, error } = await supabase
      .from("employees")
      .select("id, employee_id, full_name, last_name, first_name")
      .eq("is_active", true)
      .order("last_name", { ascending: true, nullsFirst: false })
      .order("first_name", { ascending: true, nullsFirst: false });

    if (error) {
      console.error("Error fetching employees:", error);
      toast.error("Failed to load employees");
      return;
    }

    setEmployees(data || []);
  }

  async function checkClockStatus() {
    if (!selectedEmployeeId) return;

    const { data, error } = await supabase
      .from("time_clock_entries")
      .select("*")
      .eq("employee_id", selectedEmployeeId)
      .eq("status", "clocked_in")
      .order("clock_in_time", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error checking clock status:", error);
      return;
    }

    setCurrentEntry(data || null);
  }

  async function fetchTodayEntries() {
    if (!selectedEmployeeId) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data, error } = await supabase
      .from("time_clock_entries")
      .select("*")
      .eq("employee_id", selectedEmployeeId)
      .gte("clock_in_time", today.toISOString())
      .lt("clock_in_time", tomorrow.toISOString())
      .order("clock_in_time", { ascending: false });

    if (error) {
      console.error("Error fetching today entries:", error);
      return;
    }

    setTodayEntries(data || []);
  }

  async function handleClockIn() {
    if (!selectedEmployeeId) {
      toast.error("Please select an employee");
      return;
    }

    if (currentEntry) {
      toast.error("Already clocked in! Please clock out first.");
      return;
    }

    setLoading(true);

    // Validate location if available
    if (location) {
      await validateLocation(location.lat, location.lng);
      const { data: validationData } = await supabase.rpc(
        "is_location_allowed",
        {
          p_latitude: location.lat,
          p_longitude: location.lng,
        } as any
      );

      const validationArray = validationData as Array<{
        is_allowed: boolean;
        nearest_location_name: string | null;
        distance_meters: number | null;
        error_message: string | null;
      }> | null;

      if (
        validationArray &&
        validationArray.length > 0 &&
        !validationArray[0].is_allowed
      ) {
        toast.error(
          `📍 Location Error: ${
            validationArray[0].error_message ||
            "You must be at an allowed location to clock in."
          }`
        );
        setLoading(false);
        return;
      }
    }

    const locationString = location
      ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`
      : null;

    const { data, error } = await (supabase.from("time_clock_entries") as any)
      .insert({
        employee_id: selectedEmployeeId,
        clock_in_time: new Date().toISOString(),
        clock_in_location: locationString,
        clock_in_device: navigator.userAgent.substring(0, 255),
        status: "clocked_in",
      })
      .select()
      .single();

    setLoading(false);

    if (error) {
      console.error("Error clocking in:", error);
      toast.error("Failed to clock in");
      return;
    }

    setCurrentEntry(data);
    toast.success("Clocked in successfully!");
    fetchTodayEntries();
  }

  async function handleClockOut() {
    if (!currentEntry) {
      toast.error("You are not clocked in");
      return;
    }

    setLoading(true);

    // Validate location if available
    if (location) {
      await validateLocation(location.lat, location.lng);
      const { data: validationData } = await supabase.rpc(
        "is_location_allowed",
        {
          p_latitude: location.lat,
          p_longitude: location.lng,
        } as any
      );

      const validationArray = validationData as Array<{
        is_allowed: boolean;
        nearest_location_name: string | null;
        distance_meters: number | null;
        error_message: string | null;
      }> | null;

      if (
        validationArray &&
        validationArray.length > 0 &&
        !validationArray[0].is_allowed
      ) {
        toast.error(
          `📍 Location Error: ${
            validationArray[0].error_message ||
            "You must be at an allowed location to clock in."
          }`
        );
        setLoading(false);
        return;
      }
    }

    const locationString = location
      ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`
      : null;

    const { error } = await (supabase.from("time_clock_entries") as any)
      .update({
        clock_out_time: new Date().toISOString(),
        clock_out_location: locationString,
        clock_out_device: navigator.userAgent.substring(0, 255),
      })
      .eq("id", currentEntry.id);

    setLoading(false);

    if (error) {
      console.error("Error clocking out:", error);
      toast.error("Failed to clock out");
      return;
    }

    toast.success("Clocked out successfully! 👋");
    setCurrentEntry(null);
    fetchTodayEntries();
  }

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId);

  // Flip clock digit component
  const FlipDigit = ({ value }: { value: string }) => (
    <div className="relative w-16 h-24 md:w-24 md:h-32 lg:w-32 lg:h-40">
      <div className="absolute inset-0 bg-gradient-to-b from-gray-800 to-gray-900 rounded-lg shadow-2xl border-2 border-gray-700">
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-5xl md:text-7xl lg:text-8xl font-bold text-white">
            {value}
          </span>
        </div>
        {/* Top half shadow */}
        <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-black/20 to-transparent rounded-t-lg" />
        {/* Middle line */}
        <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-gray-950 transform -translate-y-1/2" />
        {/* Bottom half shadow */}
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/30 to-transparent rounded-b-lg" />
      </div>
    </div>
  );

  const Separator = () => (
    <div className="flex flex-col gap-3 mx-2">
      <div className="w-3 h-3 md:w-4 md:h-4 bg-gray-700 rounded-full" />
      <div className="w-3 h-3 md:w-4 md:h-4 bg-gray-700 rounded-full" />
    </div>
  );

  const time = currentTime.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const [hours, minutes, seconds] = time.split(":");

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 -m-6 p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <Card>
            <CardContent className="text-center py-6">
              <VStack gap="2" align="center">
                <H1 className="md:text-4xl tracking-wider">Bundy Clock</H1>
                <BodySmall>
                  {currentTime.toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </BodySmall>
              </VStack>
            </CardContent>
          </Card>

          {/* Main Clock Card */}
          <Card className="p-8 bg-white shadow-xl">
            {/* Flip Clock Display */}
            <div className="flex items-center justify-center mb-8">
              <FlipDigit value={hours[0]} />
              <FlipDigit value={hours[1]} />
              <Separator />
              <FlipDigit value={minutes[0]} />
              <FlipDigit value={minutes[1]} />
              <Separator />
              <FlipDigit value={seconds[0]} />
              <FlipDigit value={seconds[1]} />
            </div>

            {/* Employee Selection */}
            <div className="max-w-md mx-auto mb-8">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Select Employee
              </label>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="w-full p-4 border-2 border-gray-300 rounded-lg text-lg font-medium focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
                disabled={loading}
              >
                <option value="">-- Select Your Name --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.employee_id})
                  </option>
                ))}
              </select>
            </div>

            {/* Current Status */}
            {selectedEmployee && (
              <div className="max-w-md mx-auto mb-6">
                <div
                  className={`p-4 rounded-lg text-center ${
                    currentEntry
                      ? "bg-green-50 border-2 border-green-500"
                      : "bg-gray-50 border-2 border-gray-300"
                  }`}
                >
                  <HStack
                    gap="2"
                    align="center"
                    justify="center"
                    className="mb-2"
                  >
                    <Icon name="User" size={IconSizes.md} />
                    <span className="font-semibold text-lg">
                      {selectedEmployee.full_name}
                    </span>
                  </HStack>
                  {currentEntry ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center gap-2 text-green-700 font-bold">
                        <div className="h-3 w-3 bg-green-600 rounded-full animate-pulse" />
                        CLOCKED IN
                      </div>
                      <div className="text-sm text-gray-600">
                        Since{" "}
                        {new Date(
                          currentEntry.clock_in_time
                        ).toLocaleTimeString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDistanceToNow(
                          new Date(currentEntry.clock_in_time),
                          { addSuffix: true }
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-600 font-medium">
                      Not Clocked In
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Time In/Out Buttons */}
            <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
              <button
                onClick={handleClockIn}
                disabled={!selectedEmployeeId || loading || !!currentEntry}
                className={`
                  py-6 px-8 rounded-xl text-xl font-bold uppercase tracking-wider
                  transition-all duration-200 transform
                  ${
                    !selectedEmployeeId || loading || currentEntry
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 hover:scale-105 shadow-lg hover:shadow-xl active:scale-95"
                  }
                `}
              >
                TIME IN
              </button>

              <button
                onClick={handleClockOut}
                disabled={!currentEntry || loading}
                className={`
                  py-6 px-8 rounded-xl text-xl font-bold uppercase tracking-wider
                  transition-all duration-200 transform
                  ${
                    !currentEntry || loading
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-gradient-to-br from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 hover:scale-105 shadow-lg hover:shadow-xl active:scale-95"
                  }
                `}
              >
                TIME OUT
              </button>
            </div>

            {/* GPS Status */}
            {location && (
              <div className="mt-6 text-center">
                <HStack
                  gap="2"
                  align="center"
                  justify="center"
                  className="inline-flex text-sm text-green-600 bg-green-50 px-4 py-2 rounded-full"
                >
                  <Icon name="MapPin" size={IconSizes.sm} />
                  <span>GPS Location Detected</span>
                </HStack>
              </div>
            )}
          </Card>

          {/* Today's Entries */}
          {selectedEmployee && todayEntries.length > 0 && (
            <CardSection
              title={
                <HStack gap="2" align="center">
                  <Icon name="ClockClockwise" size={IconSizes.md} />
                  <span>Today&apos;s Time Records ({todayEntries.length})</span>
                </HStack>
              }
              className="bg-white shadow-lg"
            >
              <VStack gap="3">
                {todayEntries.map((entry, index) => (
                  <div
                    key={entry.id}
                    className={`p-4 rounded-lg border-2 ${
                      entry.status === "clocked_in"
                        ? "bg-green-50 border-green-300"
                        : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-bold text-lg">
                            Shift {todayEntries.length - index}
                          </span>
                          {entry.status === "clocked_in" && (
                            <span className="px-3 py-1 bg-green-600 text-white text-xs rounded-full font-bold">
                              ACTIVE
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="text-gray-600">Time In</div>
                            <div className="font-semibold">
                              {new Date(entry.clock_in_time).toLocaleTimeString(
                                "en-US",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}
                            </div>
                          </div>

                          <div>
                            <div className="text-gray-600">Time Out</div>
                            <div className="font-semibold">
                              {entry.clock_out_time ? (
                                new Date(
                                  entry.clock_out_time
                                ).toLocaleTimeString("en-US", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              ) : (
                                <span className="text-green-600">
                                  Working...
                                </span>
                              )}
                            </div>
                          </div>

                          {entry.total_hours && (
                            <>
                              <div>
                                <div className="text-gray-600">Total Hours</div>
                                <div className="font-bold text-lg text-emerald-600">
                                  {entry.total_hours.toFixed(2)}h
                                </div>
                              </div>

                              <div>
                                <div className="text-gray-600">Breakdown</div>
                                <div className="text-xs">
                                  <div>
                                    Reg: {entry.regular_hours?.toFixed(2) || 0}h
                                  </div>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="mt-4 p-4 bg-emerald-50 rounded-lg border-2 border-emerald-200">
                  <HStack justify="between" align="center">
                    <span className="font-bold text-emerald-900 text-lg">
                      Total Hours Today:
                    </span>
                    <span className="text-3xl font-bold text-emerald-900">
                      {todayEntries
                        .reduce(
                          (sum, entry) => sum + (entry.total_hours || 0),
                          0
                        )
                        .toFixed(2)}
                      h
                    </span>
                  </HStack>
                </div>
              </VStack>
            </CardSection>
          )}

          {/* Instructions */}
          {!selectedEmployee && (
            <Card className="p-6 bg-emerald-50 border-emerald-200">
              <div className="text-center space-y-4">
                <h3 className="text-lg font-bold text-emerald-900">
                  How to Use
                </h3>
                <ul className="text-left max-w-md mx-auto space-y-2 text-emerald-800">
                  <li className="flex items-start gap-2">
                    <span className="font-bold">1.</span>
                    <span>Select your name from the dropdown</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">2.</span>
                    <span>
                      Click <strong>"TIME IN"</strong> when you arrive
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">3.</span>
                    <span>
                      Click <strong>"TIME OUT"</strong> when you leave
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">4.</span>
                    <span>Multiple shifts? Just clock in/out again!</span>
                  </li>
                </ul>
              </div>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}