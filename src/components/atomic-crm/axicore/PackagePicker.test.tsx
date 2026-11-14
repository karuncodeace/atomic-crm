import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { PackageChoices } from "./PackagePicker";
import { packageForCategory } from "./packages";

describe("PackageChoices", () => {
  it("offers the six packages and returns the one clicked", async () => {
    // Arrange
    const onChange = vi.fn();
    const screen = await render(
      <PackageChoices value={null} onChange={onChange} />,
    );

    // Assert: every package the owner asked for is offered
    for (const label of [
      "Business website",
      "E-commerce store",
      "Shopify store",
      "SEO + Business website",
      "SEO + E-commerce store",
      "Branding",
    ]) {
      await expect.element(screen.getByText(label)).toBeVisible();
    }

    // Act
    await screen.getByText("SEO + E-commerce store").click();

    // Assert
    expect(onChange).toHaveBeenCalledWith("ecommerce-seo");
  });

  it("keeps the category pairs used by the database sync", () => {
    expect(packageForCategory("ecommerce")).toBe("ecommerce-store");
    expect(packageForCategory("branding")).toBe("branding");
    expect(packageForCategory("not_categorized")).toBeNull();
  });
});
