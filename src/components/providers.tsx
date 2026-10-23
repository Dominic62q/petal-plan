"use client";

import { useState } from "react";
import { MotionConfig } from "motion/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ServiceWorkerRegistrar } from "@/components/service-worker-registrar";
import { AuthProvider } from "@/components/auth-provider";
import { ArrivalProvider } from "@/components/arrival";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {/* Honour the OS "reduce motion" setting for every animation below. */}
      <MotionConfig reducedMotion="user">
        <AuthProvider>
          <ArrivalProvider>
            {children}
            <ServiceWorkerRegistrar />
          </ArrivalProvider>
        </AuthProvider>
      </MotionConfig>
    </QueryClientProvider>
  );
}
