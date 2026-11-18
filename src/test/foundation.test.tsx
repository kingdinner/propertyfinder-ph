import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { PropertyCard } from "@/components/property/PropertyCard";
import { AsyncRegion } from "@/components/states/AsyncRegion";
import { TextField } from "@/components/ui/Fields";
import { colors } from "@/design/tokens";
import { filterListings, listings } from "@/data/listings";
import { formatPeso } from "@/lib/format";

describe("design tokens", () => {
  it("keeps the Stitch ink, amber, and surface colors", () => {
    expect(colors.primaryContainer).toBe("#131b2e");
    expect(colors.secondary).toBe("#904d00");
    expect(colors.secondaryContainer).toBe("#fe932c");
    expect(colors.surface).toBe("#f8f9ff");
    expect(colors.onSurface).toBe("#0b1c30");
    expect(colors.error).toBe("#ba1a1a");
  });
});

describe("formatPeso", () => {
  it("formats sale and rent prices in pesos", () => {
    expect(formatPeso(1_480_000_000)).toMatch(/14,800,000/);
    expect(formatPeso(6_500_000, "rent")).toMatch(/\/mo$/);
  });
});

describe("filterListings", () => {
  it("filters the demo set by transaction and bedrooms", () => {
    expect(filterListings(listings, { transaction: "rent" })).toHaveLength(1);
    expect(filterListings(listings, { minBedrooms: 4 })).toHaveLength(1);
    expect(filterListings(listings, { city: "Nowhere" })).toHaveLength(0);
  });
});

describe("PropertyCard", () => {
  it("shows the peso price, title, and details link", () => {
    render(<PropertyCard listing={listings[0]} />);
    expect(screen.getByText("Modern 4-bedroom villa with garden")).toBeInTheDocument();
    expect(screen.getByText(/14,800,000/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Details" })).toHaveAttribute("href", "/listings/pf-lipa-4br");
  });
});

describe("TextField", () => {
  it("connects the label and exposes an error", () => {
    render(<TextField label="Email address" error="Enter a valid email" />);
    const field = screen.getByLabelText("Email address");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email");
  });
});

describe("SiteHeader", () => {
  it("opens the mobile navigation", async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);
    const mobile = document.getElementById("mobile-nav");
    expect(mobile).not.toBeNull();
    expect(mobile).toHaveAttribute("hidden");
    await user.click(screen.getByRole("button", { name: "Menu" }));
    expect(mobile).not.toHaveAttribute("hidden");
    expect(within(mobile as HTMLElement).getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login?next=%2Fdashboard",
    );
  });

  it("shows the signed-in portal links", () => {
    render(<SiteHeader authenticated initialUser={{ fullName: "Alex Mercado", roles: ["CUSTOMER"] }} />);
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute("href", "/profile");
    expect(screen.getAllByRole("button", { name: "Sign out" }).length).toBeGreaterThan(0);
  });
});

describe("AsyncRegion", () => {
  it("renders loading, empty, and error states", () => {
    const { rerender } = render(
      <AsyncRegion status="loading" emptyTitle="None" emptyBody="Nothing" errorBody="Failed">
        <p>Ready</p>
      </AsyncRegion>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Loading listings");

    rerender(
      <AsyncRegion status="empty" emptyTitle="No sample listings" emptyBody="Try another filter" errorBody="Failed">
        <p>Ready</p>
      </AsyncRegion>,
    );
    expect(screen.getByRole("heading", { name: "No sample listings" })).toBeInTheDocument();

    rerender(
      <AsyncRegion status="error" emptyTitle="None" emptyBody="Nothing" errorBody="Search failed">
        <p>Ready</p>
      </AsyncRegion>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Search failed");

    rerender(
      <AsyncRegion status="ready" emptyTitle="None" emptyBody="Nothing" errorBody="Failed">
        <p>Ready</p>
      </AsyncRegion>,
    );
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });
});
