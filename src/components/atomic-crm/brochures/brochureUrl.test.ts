import { describe, expect, it } from "vitest";

import { formatBrochureUrl } from "./brochureUrl";

describe("formatBrochureUrl", () => {
  it("decodes a percent-encoded URL and shows the file name", () => {
    expect(
      formatBrochureUrl(
        "https://cdn.example.com/files/Acme%20Brochure%20Q1.pdf",
      ),
    ).toEqual({
      href: "https://cdn.example.com/files/Acme%20Brochure%20Q1.pdf",
      label: "Acme Brochure Q1.pdf",
    });
  });

  it("fully decodes a double-encoded URL", () => {
    expect(
      formatBrochureUrl("https://cdn.example.com/files/Acme%2520Brochure.pdf"),
    ).toEqual({
      href: "https://cdn.example.com/files/Acme%20Brochure.pdf",
      label: "Acme Brochure.pdf",
    });
  });

  it("adds https when the scheme is missing", () => {
    expect(formatBrochureUrl("cdn.example.com/pack.pdf")).toEqual({
      href: "https://cdn.example.com/pack.pdf",
      label: "pack.pdf",
    });
  });
});
