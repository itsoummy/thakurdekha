// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";

vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/LocationPicker", () => ({
  default: ({ onChange, onExisting }: { onChange: (p: unknown) => void; onExisting?: (p: unknown) => void }) => (
    <div>
      <button onClick={() => onChange({ lat: 22.5726, lng: 88.3639, address: "Picked Rd" })}>pick-location</button>
      {onExisting && (
        <button onClick={() => onExisting({ id: "f-golbari", name: "Golbari", lat: 22.6, lng: 88.37, source: "community" })}>pick-existing</button>
      )}
    </div>
  ),
}));

import { useUserLocation } from "@/hooks/useUserLocation";
import LocationPermissionDialog from "@/components/LocationPermissionDialog";
import MapFilters, { type MapFilter } from "@/components/MapFilters";
import DirectionsPanel from "@/components/DirectionsPanel";
import PlacePanel from "@/components/PlacePanel";
import GlobalSearch from "@/components/GlobalSearch";
import { BottomSheet, Rating } from "@/components/ui";
import { AuthProvider } from "@/context/AuthContext";
import { HoppingListProvider } from "@/context/HoppingListContext";
import NewPandalPage from "@/app/pandals/new/page";
import NewFoodPage from "@/app/food/new/page";
import MyListPage from "@/app/my-list/page";
import type { PandalDTO } from "@/server/repo";

type FetchHandler = (url: string, init?: RequestInit) => { status?: number; body: unknown } | undefined;
let handlers: FetchHandler[] = [];
const calls: { url: string; init?: RequestInit }[] = [];

function mockFetch(...h: FetchHandler[]) {
  handlers = h;
  calls.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      for (const fn of handlers) {
        const r = fn(url, init);
        if (r) return new Response(JSON.stringify(r.body), { status: r.status ?? 200 });
      }
      if (url.startsWith("/api/auth/me")) return new Response(JSON.stringify({ user: null }));
      if (url.startsWith("/api/analytics")) return new Response("{}", { status: 202 });
      return new Response(JSON.stringify({ data: [] }));
    })
  );
}
const signedIn: FetchHandler = (u) =>
  u.startsWith("/api/auth/me") ? { body: { user: { id: "u1", email: "a@b.co", name: "A", role: "USER" } } } : u.startsWith("/api/users/me/state") ? { body: { saved: [], visited: [], submissions: [], foodSubmissions: [] } } : undefined;

const wrap = ({ children }: { children: ReactNode }) => (
  <AuthProvider>
    <HoppingListProvider>{children}</HoppingListProvider>
  </AuthProvider>
);

beforeEach(() => {
  localStorage.clear();
  mockFetch();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useUserLocation permission states", () => {
  const geo = (impl: Partial<Geolocation> | undefined) =>
    Object.defineProperty(globalThis.navigator, "geolocation", { value: impl, configurable: true });
  const perms = (state: string) =>
    Object.defineProperty(globalThis.navigator, "permissions", {
      value: { query: vi.fn().mockResolvedValue({ state, addEventListener: vi.fn(), removeEventListener: vi.fn() }) },
      configurable: true,
    });
  const pos = { coords: { latitude: 22.57, longitude: 88.36, accuracy: 10, heading: null, speed: null } };

  it("location granted: exposes coordinates and stops watching on stop()", async () => {
    perms("granted");
    const clearWatch = vi.fn();
    geo({
      watchPosition: vi.fn((ok) => {
        ok(pos as GeolocationPosition);
        return 7;
      }) as never,
      clearWatch,
      getCurrentPosition: vi.fn((ok) => ok(pos as GeolocationPosition)) as never,
    });
    const { result } = renderHook(() => useUserLocation());
    await waitFor(() => expect(result.current.permission).toBe("granted"));
    act(() => result.current.start());
    expect(result.current.latitude).toBe(22.57);
    expect(result.current.watching).toBe(true);
    act(() => result.current.stop());
    expect(clearWatch).toHaveBeenCalledWith(7);
    expect(result.current.watching).toBe(false);
  });

  it("location denied: reports denied and does not throw", async () => {
    perms("denied");
    geo({
      getCurrentPosition: vi.fn((_ok, err) => err?.({ code: 1, message: "denied" } as GeolocationPositionError)) as never,
      watchPosition: vi.fn() as never,
      clearWatch: vi.fn(),
    });
    const { result } = renderHook(() => useUserLocation());
    let msg = "";
    await act(async () => {
      await result.current.getOnce().catch((e: Error) => (msg = e.message));
    });
    expect(msg).toBe("denied");
    await waitFor(() => expect(result.current.error).toBe("denied"));
    expect(result.current.permission).toBe("denied");
  });

  it("location unavailable: no geolocation API", async () => {
    geo(undefined);
    const { result } = renderHook(() => useUserLocation());
    await waitFor(() => expect(result.current.permission).toBe("unavailable"));
    expect(result.current.error).toBe("unavailable");
  });

  it("timeout maps to a timeout error", async () => {
    perms("prompt");
    geo({
      getCurrentPosition: vi.fn((_ok, err) => err?.({ code: 3, message: "t" } as GeolocationPositionError)) as never,
      watchPosition: vi.fn() as never,
      clearWatch: vi.fn(),
    });
    const { result } = renderHook(() => useUserLocation());
    let msg = "";
    await act(async () => {
      await result.current.getOnce().catch((e: Error) => (msg = e.message));
    });
    expect(msg).toBe("timeout");
    await waitFor(() => expect(result.current.error).toBe("timeout"));
  });
});

describe("permission dialog", () => {
  it("explains why location is needed and reports the choice", async () => {
    const onAllow = vi.fn();
    const onCancel = vi.fn();
    render(<LocationPermissionDialog onAllow={onAllow} onCancel={onCancel} />);
    expect(screen.getByText(/discover pandals near you and get directions from your current location/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Allow location" }));
    await userEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(onAllow).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

describe("map filters", () => {
  it("switches filter and radius without a page reload", async () => {
    const onFilter = vi.fn();
    const onRadius = vi.fn();
    render(<MapFilters filter={"all" as MapFilter} onFilter={onFilter} radius={2000} onRadius={onRadius} />);
    for (const name of ["All", "Pandals", "Food", "Nearby", "Popular", "Saved"]) {
      expect(screen.getByRole("tab", { name })).toBeInTheDocument();
    }
    await userEvent.click(screen.getByRole("tab", { name: "Food" }));
    expect(onFilter).toHaveBeenCalledWith("food");
    await userEvent.selectOptions(screen.getByLabelText("Search radius"), "500");
    expect(onRadius).toHaveBeenCalledWith(500);
    expect(screen.getByRole("tab", { name: "All" })).toHaveAttribute("aria-selected", "true");
  });
});

describe("bottom sheet", () => {
  it("renders as a dialog and closes on Escape", async () => {
    const onClose = vi.fn();
    render(
      <BottomSheet label="Place details" onClose={onClose}>
        <p>content</p>
      </BottomSheet>
    );
    expect(screen.getByRole("dialog", { name: "Place details" })).toHaveTextContent("content");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});

describe("directions panel", () => {
  const base = {
    destinationName: "Suruchi Sangha",
    destination: { lat: 22.49, lng: 88.35 },
    origin: { lat: 22.57, lng: 88.36 },
    mode: "WALKING" as const,
    onMode: vi.fn(),
    loading: false,
    error: null,
    onClose: vi.fn(),
  };
  const route = { distanceMeters: 1800, durationSeconds: 1440, polyline: [] as [number, number][], mode: "WALKING" as const, estimated: false, provider: "google" as const };

  it("shows distance, ETA and an external navigation link", () => {
    render(<DirectionsPanel {...base} route={route} transitAvailable />);
    const s = screen.getByTestId("route-summary");
    expect(s).toHaveTextContent("1.8 km");
    expect(s).toHaveTextContent("24 min");
    expect(s).toHaveTextContent("Suruchi Sangha");
    expect(screen.getByRole("link", { name: /Open in Google Maps/ })).toHaveAttribute("href", expect.stringContaining("destination=22.49%2C88.35"));
    expect(screen.getByRole("radio", { name: "Transit" })).toBeInTheDocument();
  });

  it("hides Transit when unsupported and warns when the route is only an estimate", () => {
    render(<DirectionsPanel {...base} route={{ ...route, estimated: true, provider: "estimate" }} transitAvailable={false} />);
    expect(screen.queryByRole("radio", { name: "Transit" })).not.toBeInTheDocument();
    expect(screen.getByText(/Estimated from a straight line/)).toBeInTheDocument();
  });

  it("shows a skeleton while loading and a friendly error on failure", () => {
    const { rerender } = render(<DirectionsPanel {...base} route={null} loading transitAvailable={false} />);
    expect(screen.getByTestId("route-skeleton")).toBeInTheDocument();
    rerender(<DirectionsPanel {...base} route={null} loading={false} error="We couldn't find a route for this destination right now." transitAvailable={false} />);
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't find a route");
  });

  it("changes travel mode", async () => {
    const onMode = vi.fn();
    render(<DirectionsPanel {...base} onMode={onMode} route={route} transitAvailable={false} />);
    await userEvent.click(screen.getByRole("radio", { name: "Driving" }));
    expect(onMode).toHaveBeenCalledWith("DRIVING");
  });
});

describe("place panel (marker selection)", () => {
  const pandal: PandalDTO = {
    id: "p-x", name: "Suruchi Sangha", slug: "s", nameBn: null, description: null, history: null, establishedYear: null,
    currentTheme: "Utsho", themeStatus: null, category: null, zone: "South", budgetRange: null, openingTime: null, closingTime: null,
    crowdRating: null, latitude: 22.49, longitude: 88.35, address: null, neighbourhood: "New Alipore", nearestMetro: null,
    nearestBusStop: null, googleMapsUrl: null, images: [], verified: false, status: "APPROVED", trust: "COMMUNITY",
    rating: null, reviewCount: 0, popularity: 0, createdAt: "2026-01-01", distanceMeters: 742,
  };

  it("shows theme, honest 'No rating yet', distance and fires Get Directions", async () => {
    const onDirections = vi.fn();
    render(<PlacePanel item={{ type: "PANDAL", data: pandal }} onDirections={onDirections} />, { wrapper: wrap });
    expect(screen.getByText("No rating yet")).toBeInTheDocument();
    expect(screen.getByText(/742 m away/)).toBeInTheDocument();
    expect(screen.getByText("Utsho")).toBeInTheDocument();
    expect(screen.getByText("Community recommendation")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Get Directions" }));
    expect(onDirections).toHaveBeenCalled();
  });

  it("adds to the Puja list", async () => {
    render(<PlacePanel item={{ type: "PANDAL", data: pandal }} onDirections={vi.fn()} />, { wrapper: wrap });
    await userEvent.click(screen.getByRole("button", { name: "Add to Puja List" }));
    expect(screen.getByRole("button", { name: /In Puja List/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("food place shows dish, price and no invented rating", () => {
    render(
      <PlacePanel
        item={{ type: "FOOD", data: { id: "f-x", name: "Kalika", description: null, category: "Sweets", recommendedDish: "Sandesh", priceRange: "₹", latitude: 22.5, longitude: 88.36, address: null, images: [], pujoSpecial: false, verified: false, status: "APPROVED", trust: "COMMUNITY", rating: null, reviewCount: 0, createdAt: "" } }}
        onDirections={vi.fn()}
      />,
      { wrapper: wrap }
    );
    expect(screen.getByText("Sandesh")).toBeInTheDocument();
    expect(screen.getByText("No rating yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Place" })).toHaveAttribute("href", "/food/f-x");
  });

  it("Rating renders a value only when real data exists", () => {
    const { rerender } = render(<Rating rating={null} count={0} />);
    expect(screen.getByText("No rating yet")).toBeInTheDocument();
    rerender(<Rating rating={4.5} count={12} />);
    expect(screen.getByText(/4.5/)).toBeInTheDocument();
  });
});

describe("global search", () => {
  it("debounces, groups results and handles empty results", async () => {
    mockFetch((u) =>
      u.startsWith("/api/search?q=Ball")
        ? { body: { pandals: [{ id: "p1", name: "Ballygunge Cultural Association", neighbourhood: null, zone: "South" }], food: [{ id: "f1", name: "Ballygunge Biryani", category: "biryani" }], transport: [{ id: "m1", name: "Kalighat", line: "Blue" }], areas: [{ name: "Ballygunge", pandalCount: 3 }] } }
        : u.startsWith("/api/search?q=zzz")
          ? { body: { pandals: [], food: [], transport: [], areas: [] } }
          : undefined
    );
    render(<GlobalSearch />);
    const box = screen.getByRole("searchbox");
    await userEvent.type(box, "Ball");
    expect(calls.filter((c) => c.url.startsWith("/api/search")).length).toBe(0);
    await waitFor(() => expect(screen.getByText("Pandals")).toBeInTheDocument(), { timeout: 2000 });
    expect(calls.filter((c) => c.url.startsWith("/api/search")).length).toBe(1);
    for (const g of ["Pandals", "Food", "Transport", "Areas"]) expect(screen.getByText(g)).toBeInTheDocument();
    await userEvent.clear(box);
    await userEvent.type(box, "zzz");
    await waitFor(() => expect(screen.getByText(/couldn't find anything matching/)).toBeInTheDocument(), { timeout: 2000 });
  });
});

describe("Add Pandal", () => {
  it("requires sign-in", async () => {
    render(<NewPandalPage />, { wrapper: wrap });
    expect(await screen.findByText("Sign in to continue")).toBeInTheDocument();
  });

  it("warns about duplicates and lets the user continue anyway", async () => {
    mockFetch(signedIn, (u, init) => {
      if (u === "/api/pandals/submissions") {
        const body = JSON.parse(String(init?.body));
        return body.force
          ? { status: 201, body: { data: { id: "p_new", status: "PENDING" } } }
          : { status: 409, body: { error: { code: "POSSIBLE_DUPLICATE", message: "dup" }, duplicates: [{ id: "p-suruchi-sangha", name: "Suruchi Sangha", address: "Golf Green" }] } };
      }
    });
    render(<NewPandalPage />, { wrapper: wrap });
    await userEvent.type(await screen.findByLabelText(/Name/), "Suruchi Sangha");
    await userEvent.click(screen.getByText("pick-location"));
    await userEvent.click(screen.getByRole("button", { name: "Submit for review" }));
    expect(await screen.findByText("We may already have this pandal listed.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Existing" })).toHaveAttribute("href", "/map?select=PANDAL:p-suruchi-sangha");
    await userEvent.click(screen.getByRole("button", { name: "Continue Anyway" }));
    expect(await screen.findByText("Thank you!")).toBeInTheDocument();
    expect(screen.getByText(/pending review/i)).toBeInTheDocument();
    const posts = calls.filter((c) => c.url === "/api/pandals/submissions");
    expect(JSON.parse(String(posts[1].init?.body)).force).toBe(true);
  });

  it("asks for a location before submitting", async () => {
    mockFetch(signedIn);
    render(<NewPandalPage />, { wrapper: wrap });
    await userEvent.type(await screen.findByLabelText(/Name/), "Some Pandal");
    await userEvent.click(screen.getByRole("button", { name: "Submit for review" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Choose the pandal's location/);
  });
});

describe("Recommend Food", () => {
  it("recommends an existing place instead of creating a duplicate", async () => {
    mockFetch(signedIn, (u) => (u.startsWith("/api/food/f-golbari/recommend") ? { status: 201, body: { data: { id: "fr1" } } } : undefined));
    render(
      <NewFoodPage />,
      { wrapper: wrap }
    );
    await userEvent.click(await screen.findByText("pick-existing"));
    expect(screen.getByText("Golbari")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Recommended dish/), "Kosha Mangsho");
    await userEvent.click(screen.getByRole("radio", { name: "5 stars" }));
    await userEvent.click(screen.getByRole("button", { name: "Submit for review" }));
    expect(await screen.findByText("Thanks for the recommendation!")).toBeInTheDocument();
    const post = calls.find((c) => c.url === "/api/food/f-golbari/recommend")!;
    expect(JSON.parse(String(post.init?.body))).toMatchObject({ rating: 5, recommendedDish: "Kosha Mangsho" });
    expect(calls.some((c) => c.url === "/api/food" && c.init?.method === "POST")).toBe(false);
  });

  it("creates a new place when none exists", async () => {
    mockFetch(signedIn, (u, init) => (u === "/api/food" && init?.method === "POST" ? { status: 201, body: { data: { id: "f_new", status: "PENDING" } } } : undefined));
    render(<NewFoodPage />, { wrapper: wrap });
    await userEvent.click(await screen.findByText("pick-location"));
    await userEvent.click(screen.getByRole("button", { name: /add it as new/ }));
    await userEvent.type(screen.getByLabelText(/^Name/), "Corner Shop");
    await userEvent.type(screen.getByLabelText(/Recommended dish/), "Phuchka");
    await userEvent.click(screen.getByRole("button", { name: "Submit for review" }));
    expect(await screen.findByText("Thanks for the recommendation!")).toBeInTheDocument();
    const post = calls.find((c) => c.url === "/api/food" && c.init?.method === "POST")!;
    expect(JSON.parse(String(post.init?.body))).toMatchObject({ name: "Corner Shop", latitude: 22.5726, recommendedDish: "Phuchka" });
  });

  it("requires something to recommend", async () => {
    mockFetch(signedIn);
    render(<NewFoodPage />, { wrapper: wrap });
    await userEvent.click(await screen.findByText("pick-existing"));
    expect(screen.getByRole("button", { name: "Submit for review" })).toBeDisabled();
  });
});

describe("Puja planner", () => {
  const pandalsResp = {
    data: [
      { id: "p-a", name: "Pandal A", zone: "North", neighbourhood: null, latitude: 22.6, longitude: 88.37 },
      { id: "p-b", name: "Pandal B", zone: "South", neighbourhood: null, latitude: 22.5, longitude: 88.36 },
    ],
  };
  const foodResp = { data: [{ id: "f-a", name: "Food Stop", category: "Rolls", latitude: 22.55, longitude: 88.365 }] };
  const routes: FetchHandler = (u) =>
    u.startsWith("/api/pandals?ids=") ? { body: pandalsResp } : u.startsWith("/api/food?ids=") ? { body: foodResp } : undefined;

  it("shows the empty state", async () => {
    render(<MyListPage />, { wrapper: wrap });
    expect(await screen.findByText("Your Puja route is empty")).toBeInTheDocument();
  });

  it("lists pandal and food stops with count and estimates, and removes stops", async () => {
    localStorage.setItem("thakurdekha:hopping-list", JSON.stringify(["p-a", "f-a", "p-b"]));
    mockFetch(routes);
    render(<MyListPage />, { wrapper: wrap });
    expect(await screen.findByText(/Food Stop/)).toBeInTheDocument();
    expect(screen.getByTestId("route-summary")).toHaveTextContent("3 stops");
    expect(screen.getByTestId("route-summary")).toHaveTextContent(/straight-line estimate/);
    await userEvent.click(screen.getByRole("button", { name: "Remove Pandal A" }));
    await waitFor(() => expect(screen.getByTestId("route-summary")).toHaveTextContent("2 stops"));
  });

  it("only reorders when the user presses Optimize Route", async () => {
    localStorage.setItem("thakurdekha:hopping-list", JSON.stringify(["p-a", "p-b", "f-a"]));
    mockFetch(routes, (u) =>
      u === "/api/routes/optimize"
        ? { body: { data: { orderedStops: [{ id: "p-a" }, { id: "f-a" }, { id: "p-b" }] } } }
        : undefined
    );
    render(<MyListPage />, { wrapper: wrap });
    await screen.findByText("Pandal A");
    const order = () => screen.getAllByRole("link").map((l) => l.textContent).filter((t) => /Pandal|Food/.test(t ?? ""));
    expect(order()).toEqual(["Pandal A", "Pandal B", "🍴 Food Stop"]);
    expect(calls.some((c) => c.url === "/api/routes/optimize")).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: /Optimize Route/ }));
    await waitFor(() => expect(order()).toEqual(["Pandal A", "🍴 Food Stop", "Pandal B"]));
  });
});
