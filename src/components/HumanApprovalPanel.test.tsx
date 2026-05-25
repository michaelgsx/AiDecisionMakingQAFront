import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HumanApprovalPanel } from "./HumanApprovalPanel";

describe("HumanApprovalPanel", () => {
  afterEach(() => cleanup());

  const approval = {
    requestId: "req-1",
    stepKey: "s3",
    prompt: "Accept freeze?",
    proposal: "Recommend freeze pending review.",
  };

  it("renders prompt and proposal", () => {
    render(
      <HumanApprovalPanel approval={approval} loading={false} onRespond={vi.fn()} />,
    );
    expect(screen.getByText("Accept freeze?")).toBeInTheDocument();
    expect(screen.getByText("Recommend freeze pending review.")).toBeInTheDocument();
  });

  it("calls onRespond with accept or reject", async () => {
    const user = userEvent.setup();
    const onRespond = vi.fn();
    render(
      <HumanApprovalPanel approval={approval} loading={false} onRespond={onRespond} />,
    );

    const region = screen.getByRole("region", { name: "Human approval required" });
    await user.click(within(region).getByRole("button", { name: "Accept" }));
    expect(onRespond).toHaveBeenCalledWith("accept");

    await user.click(within(region).getByRole("button", { name: "Reject" }));
    expect(onRespond).toHaveBeenCalledWith("reject");
  });

  it("disables buttons while loading", () => {
    render(
      <HumanApprovalPanel approval={approval} loading onRespond={vi.fn()} />,
    );
    const region = screen.getByRole("region", { name: "Human approval required" });
    expect(within(region).getByRole("button", { name: "Accept" })).toBeDisabled();
    expect(within(region).getByRole("button", { name: "Reject" })).toBeDisabled();
  });
});
