import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { createMockRoom } from "@baditaflorin/mesh-common/testing";
import { Feature } from "../../src/Feature";
import { config } from "../../src/config";

describe("Feature (component)", () => {
  it("renders a live cost surface with an honest pre-rate action", () => {
    const room = createMockRoom();
    render(<Feature room={room} config={config} />);
    expect(screen.getByTestId("meeting-cost-surface")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Meeting cost" })).toBeInTheDocument();
    expect(screen.getByText("Current meeting cost")).toBeInTheDocument();
    expect(screen.getByText("$0.00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start meeting" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add to team total" })).toBeDisabled();
  });

  it("shows a connecting state when room is null", () => {
    render(<Feature room={null} config={config} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Opening the cost meter" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Connecting to the shared ledger")).toBeInTheDocument();
  });
});
