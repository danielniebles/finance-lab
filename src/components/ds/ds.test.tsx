import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Meter, Money, StatusChip } from "@/components/ds";

describe("Money", () => {
  it("renders COP in mono with a real minus sign", () => {
    render(<Money value={-14380899} />);
    const el = screen.getByText(/14\.380\.899/);
    expect(el.textContent?.startsWith("−")).toBe(true);
    expect(el.className).toContain("font-mono");
  });

  it("compacts and signs on request", () => {
    render(<Money value={14_400_000} compact signed />);
    expect(screen.getByText("+$ 14.4M")).toBeInTheDocument();
  });
});

describe("StatusChip", () => {
  it("applies the tone's soft classes", () => {
    render(<StatusChip tone="caution">Underfunded</StatusChip>);
    expect(screen.getByText("Underfunded").className).toContain("bg-warning/10");
  });
});

describe("Meter", () => {
  it("exposes value semantics and clamps the fill", () => {
    const { container } = render(<Meter label="Savings rate" value={60} max={40} target={20} />);
    const meter = screen.getByRole("meter", { name: "Savings rate" });
    expect(meter).toHaveAttribute("aria-valuenow", "60");
    const fill = meter.firstElementChild?.firstElementChild as HTMLElement;
    expect(fill.style.width).toBe("100%");
    const tick = container.querySelector('[data-slot="meter-target"]') as HTMLElement;
    expect(tick.style.left).toBe("50%");
  });
});
