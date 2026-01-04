"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/Button";
import {
  ArrowClockwise,
  CheckCircle,
  MapPin,
  SpinnerGap,
  XCircle,
} from "phosphor-react";
import { toast } from "sonner";

interface LocationConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (location: {
    lat: number;
    lng: number;
  }) => Promise<boolean | void>;
  type: "in" | "out";
  validateLocation: (
    lat: number,
    lng: number
  ) => Promise<{
    isAllowed: boolean;
    nearestLocation: string | null;
    distance: number | null;
    error: string | null;
  }>;
}

export function LocationConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  type,
  validateLocation,
}: LocationConfirmationModalProps) {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [locationStatus, setLocationStatus] = useState<{
    isAllowed: boolean;
    nearestLocation: string | null;
    distance: number | null;
    error: string | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshCountdown, setRefreshCountdown] = useState(10);

  // Get fresh location (no caching)
  const getFreshLocation = useCallback((): Promise<{
    lat: number;
    lng: number;
  } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          resolve(loc);
        },
        (error) => {
          console.error("Location error:", error);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0, // Force fresh location, no caching
        }
      );
    });
  }, []);

  // Fetch and validate location
  const fetchAndValidateLocation = useCallback(async () => {
    setIsLoading(true);
    const freshLocation = await getFreshLocation();

    if (!freshLocation) {
      setLocation(null);
      setLocationStatus({
        isAllowed: false,
        nearestLocation: null,
        distance: null,
        error:
          "Unable to get your location. Please enable GPS/location services.",
      });
      setIsLoading(false);
      return;
    }

    setLocation(freshLocation);
    setLastRefresh(new Date());
    setRefreshCountdown(10);

    // Validate location
    const status = await validateLocation(freshLocation.lat, freshLocation.lng);
    setLocationStatus(status);
    setIsLoading(false);
  }, [getFreshLocation, validateLocation]);

  // Initial fetch when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchAndValidateLocation();
    } else {
      // Reset state when modal closes
      setLocation(null);
      setLocationStatus(null);
      setLastRefresh(null);
      setRefreshCountdown(10);
    }
  }, [isOpen, fetchAndValidateLocation]);

  // Auto-refresh location every 10 seconds
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      fetchAndValidateLocation();
    }, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, [isOpen, fetchAndValidateLocation]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen || !lastRefresh) return;

    const countdownInterval = setInterval(() => {
      setRefreshCountdown((prev) => {
        if (prev <= 1) {
          return 10; // Reset to 10 when it reaches 0
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [isOpen, lastRefresh]);

  const handleConfirm = async () => {
    if (!location || !locationStatus?.isAllowed || isConfirming) {
      console.log("handleConfirm blocked", {
        location: !!location,
        isAllowed: locationStatus?.isAllowed,
        isConfirming,
      });
      return;
    }

    console.log("handleConfirm called, setting isConfirming to true");
    setIsConfirming(true);

    try {
      console.log("Calling onConfirm with location:", location);
      const result = await Promise.race([
        onConfirm(location),
        new Promise<boolean>((_, reject) =>
          setTimeout(
            () => reject(new Error("Operation timed out after 30 seconds")),
            30000
          )
        ),
      ]);

      console.log("onConfirm result:", result);

      // If onConfirm returns false, it means the operation failed
      // The modal will stay open so the user can try again
      if (result === false) {
        // Operation failed, keep modal open
        console.log("Operation failed, keeping modal open");
        setIsConfirming(false);
        return;
      }
      // If result is true or undefined, the parent will close the modal
      // Don't set isConfirming to false here as the modal will close
      console.log("Operation succeeded, modal will close");
    } catch (error) {
      console.error("Error in handleConfirm:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "An error occurred. Please try again."
      );
      setIsConfirming(false);
      // Keep modal open on error
    }
  };

  // Use OpenStreetMap for the map (free, no API key required)
  const mapIframeUrl = location
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${
        location.lng - 0.001
      },${location.lat - 0.001},${location.lng + 0.001},${
        location.lat + 0.001
      }&layer=mapnik&marker=${location.lat},${location.lng}`
    : "";

  const mapLinkUrl = location
    ? `https://www.google.com/maps?q=${location.lat},${location.lng}&z=18`
    : "";

  const openStreetMapLink = location
    ? `https://www.openstreetmap.org/?mlat=${location.lat}&mlon=${location.lng}&zoom=18`
    : "";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Confirm Time {type === "in" ? "In" : "Out"} Location
          </DialogTitle>
          <DialogDescription>
            Please verify your current location before confirming your time{" "}
            {type === "in" ? "in" : "out"}. Your location will be refreshed
            automatically every 10 seconds.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Location Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isLoading ? (
                <>
                  <SpinnerGap className="h-4 w-4 animate-spin text-blue-600" />
                  <span className="text-sm text-gray-600">
                    Getting location...
                  </span>
                </>
              ) : locationStatus ? (
                locationStatus.isAllowed ? (
                  <>
                    <CheckCircle
                      className="h-5 w-5 text-green-600"
                      weight="fill"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-green-700">
                        Location Verified
                      </span>
                      {locationStatus.nearestLocation && (
                        <span className="text-xs text-gray-500">
                          {locationStatus.nearestLocation}
                          {locationStatus.distance !== null &&
                            ` (${locationStatus.distance}m away)`}
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-red-600" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-red-700">
                        Location Not Allowed
                      </span>
                      <span className="text-xs text-red-600">
                        {locationStatus.error ||
                          "You must be at an approved location"}
                      </span>
                    </div>
                  </>
                )
              ) : (
                <>
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    Waiting for location...
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={fetchAndValidateLocation}
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                <ArrowClockwise
                  className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            </div>
          </div>

          {/* Refresh Countdown */}
          {lastRefresh && (
            <div className="text-xs text-gray-500 text-center">
              Next auto-refresh in {refreshCountdown} seconds
            </div>
          )}

          {/* Minimap */}
          <div className="relative w-full h-64 rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
            {location ? (
              <>
                <iframe
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                  src={mapIframeUrl}
                  className="w-full h-full"
                  title="Location Map"
                />
                <div className="absolute top-2 right-2 bg-white px-2 py-1 rounded shadow-sm text-xs z-10">
                  <div className="font-medium">Your Location</div>
                  <div className="text-gray-600">
                    {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                  </div>
                </div>
                <div className="absolute bottom-2 left-2 flex gap-2 z-10">
                  <a
                    href={mapLinkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-white px-3 py-1.5 rounded shadow-sm text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition"
                  >
                    Google Maps →
                  </a>
                  <a
                    href={openStreetMapLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-white px-3 py-1.5 rounded shadow-sm text-xs font-medium text-green-600 hover:text-green-700 hover:bg-green-50 transition"
                  >
                    OpenStreetMap →
                  </a>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Loading map...</p>
                </div>
              </div>
            )}
          </div>

          {/* Location Info */}
          {location && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-gray-600">Latitude:</span>
                  <span className="ml-2 font-mono">
                    {location.lat.toFixed(6)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Longitude:</span>
                  <span className="ml-2 font-mono">
                    {location.lng.toFixed(6)}
                  </span>
                </div>
                {lastRefresh && (
                  <div className="col-span-2 text-xs text-gray-500">
                    Last updated: {lastRefresh.toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: true
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={
              !location ||
              !locationStatus?.isAllowed ||
              isLoading ||
              isConfirming
            }
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConfirming ? (
              <>
                <SpinnerGap className="h-4 w-4 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              `Confirm Time ${type === "in" ? "In" : "Out"}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
