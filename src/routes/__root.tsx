import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "../lib/auth";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Sahifa topilmadi</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Siz qidirayotgan sahifa mavjud emas yoki ko'chirilgan.
        </p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            Bosh sahifa
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Sahifa yuklanmadi</h1>
        <p className="mt-2 text-sm text-muted-foreground">Nimadir noto'g'ri ketdi.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Qayta urinish</button>
          <a href="/" className="rounded-md border border-input bg-background px-4 py-2 text-sm">Bosh sahifa</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Suhbat — Tezkor xabar almashish" },
      { name: "description", content: "Do'stlaringiz bilan real vaqtda xabar almashing." },
      { property: "og:title", content: "Suhbat — Tezkor xabar almashish" },
      { name: "twitter:title", content: "Suhbat — Tezkor xabar almashish" },
      { property: "og:description", content: "Do'stlaringiz bilan real vaqtda xabar almashing." },
      { name: "twitter:description", content: "Do'stlaringiz bilan real vaqtda xabar almashing." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/4064dbae-9e77-40d0-8eb0-d1ae303d7c3a/id-preview-82e03c95--d344eb72-5ed5-437a-b63d-0b5e26e83527.lovable.app-1782469341435.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/4064dbae-9e77-40d0-8eb0-d1ae303d7c3a/id-preview-82e03c95--d344eb72-5ed5-437a-b63d-0b5e26e83527.lovable.app-1782469341435.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="uz">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster position="top-center" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
