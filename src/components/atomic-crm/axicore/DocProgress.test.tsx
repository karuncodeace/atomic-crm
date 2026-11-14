import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { DocProgress, type Progress } from "./DocProgress";

const ago = (s: number) => new Date(Date.now() - s * 1000).toISOString();
const base: Progress = {
  steps: ["Research", "Writing", "Page check"],
  step: 1,
  state: "write",
  label: "Claude is writing it",
  started_at: ago(70),
  expected_s: 360,
  attempt: 1,
  backup: false,
};

describe("DocProgress", () => {
  it("shows the writing step against the usual time", async () => {
    // Arrange + Act: writing for 70 s of a usual 6 min
    const screen = await render(<DocProgress progress={base} />);

    // Assert: all three steps are named, the current one is said, and the time is shown against the usual time
    await expect.element(screen.getByText("Research")).toBeVisible();
    await expect.element(screen.getByText("Page check")).toBeVisible();
    await expect
      .element(screen.getByText(/Claude is writing it · 1:1\d of about 6 min/))
      .toBeVisible();
    await expect
      .element(screen.getByRole("progressbar"))
      .toHaveAttribute("aria-label", "Claude is writing it: step 2 of 3");
  });

  it("says when writing takes longer than usual", async () => {
    // Arrange + Act: 9 min spent on a usual 6 min
    const screen = await render(
      <DocProgress progress={{ ...base, started_at: ago(540) }} />,
    );

    // Assert
    await expect
      .element(screen.getByText(/taking longer than usual \(about 6 min\)/))
      .toBeVisible();
  });

  it("shows until when it waits for the usage limit", async () => {
    // Arrange: the limit resets at 3:45 pm today
    const reset = new Date();
    reset.setHours(15, 45, 0, 0);
    const time = reset.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });

    // Act
    const screen = await render(
      <DocProgress
        progress={{
          ...base,
          state: "wait",
          label: "Waiting for the AI usage limit to reset",
          hold_until: reset.toISOString(),
        }}
      />,
    );

    // Assert
    await expect
      .element(
        screen.getByText(
          `Waiting for the AI usage limit to reset · until ${time}`,
        ),
      )
      .toBeVisible();
  });

  it("marks the check as the third step once the answer is in", async () => {
    // Arrange + Act
    const screen = await render(
      <DocProgress
        progress={{
          ...base,
          step: 2,
          state: "check",
          label: "Laying out and checking the pages",
          started_at: ago(12),
        }}
      />,
    );

    // Assert
    await expect
      .element(screen.getByRole("progressbar"))
      .toHaveAttribute(
        "aria-label",
        "Laying out and checking the pages: step 3 of 3",
      );
    await expect
      .element(screen.getByText(/Laying out and checking the pages · 0:1\d/))
      .toBeVisible();
  });
});
