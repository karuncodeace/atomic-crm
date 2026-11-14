import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { MakeProposal } from "./MakeProposal";

describe("MakeProposal", () => {
  it("starts a first proposal", async () => {
    // Arrange
    const onMake = vi.fn();
    const screen = await render(
      <MakeProposal
        hasProposal={false}
        working={false}
        starting={false}
        onMake={onMake}
      />,
    );

    // Act
    await screen.getByRole("button", { name: "Make proposal" }).click();

    // Assert
    expect(onMake).toHaveBeenCalledOnce();
  });

  it("offers a new version once one exists", async () => {
    const screen = await render(
      <MakeProposal
        hasProposal
        working={false}
        starting={false}
        onMake={() => {}}
      />,
    );
    await expect
      .element(screen.getByRole("button", { name: "Make a new proposal" }))
      .toBeVisible();
  });

  it("is hidden while a proposal is being made", async () => {
    const screen = await render(
      <MakeProposal hasProposal working starting={false} onMake={() => {}} />,
    );
    await expect.element(screen.getByRole("button")).not.toBeInTheDocument();
  });

  it("cannot be clicked twice while it starts", async () => {
    const screen = await render(
      <MakeProposal
        hasProposal={false}
        working={false}
        starting
        onMake={() => {}}
      />,
    );
    await expect
      .element(screen.getByRole("button", { name: "Starting…" }))
      .toBeDisabled();
  });
});
