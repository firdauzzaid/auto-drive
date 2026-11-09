import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { ApiError } from "@/api";
import { useSession } from "@/session";
import { color, family, fonts, size } from "@/theme";

SplashScreen.preventAutoHideAsync();

function signOutOnExpiredSession(error: Error) {
  if (error instanceof ApiError && error.status === 401) useSession.getState().signOut();
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: signOutOnExpiredSession }),
  mutationCache: new MutationCache({ onError: signOutOnExpiredSession }),
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

export default function RootLayout() {
  const { session, loaded, load } = useSession();
  const [fontsLoaded, fontError] = useFonts(fonts);
  // A font that fails to load falls back to the system face rather than blocking the cashier.
  const ready = loaded && (fontsLoaded || !!fontError);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  useEffect(() => {
    if (!session) queryClient.clear();
  }, [session]);

  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: color.plate },
          headerTintColor: color.onPlate,
          headerTitleStyle: { fontFamily: family.bold, fontSize: size.lg, color: color.onPlate },
          headerShadowVisible: false,
          // The tabs route group name would otherwise show as the iOS back label.
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: color.ground },
        }}>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="checkout" options={{ title: "Pembayaran", presentation: "modal" }} />
          <Stack.Screen name="sales/[id]" options={{ title: "Bukti Transaksi" }} />
          <Stack.Screen name="kendaraan/index" options={{ title: "Kendaraan", presentation: "modal" }} />
          <Stack.Screen name="kendaraan/[id]" options={{ title: "Riwayat Servis" }} />
          <Stack.Screen name="katalog" options={{ title: "Tambah Katalog", presentation: "modal" }} />
        </Stack.Protected>
      </Stack>
    </QueryClientProvider>
  );
}
